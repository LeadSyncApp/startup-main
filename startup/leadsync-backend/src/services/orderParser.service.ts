import { prisma } from "../lib/prisma";
import { OrderSource, OrderStatus, OrderPriority, MessageSender } from "@prisma/client";
import { emitToCompany, emitToConversation, emitToAgent, emitToCompanyAdmin, safeEmitConversationUpdate } from "../lib/socket";
import { notificationService } from "./notification.service";
import { generateStructuredOrder } from "./ai.service";
import { sarvamService } from "./sarvam.service";

interface ParsedItem {
    name: string;
    quantity: number;
    price?: number;
}

class OrderParserService {

    /**
     * Main entry point: Parses text for orders, creates them if found, and handles notifications.
     */
    async processPotentialOrder(
        companyId: string,
        conversationId: string,
        leadId: string,
        text: string,
        menu?: any
    ) {
        try {
            // 0️⃣ Check if there's already an active order session
            const existingActiveOrder = await prisma.order.findFirst({
                where: {
                    conversationId,
                    isDeleted: false,
                    status: {
                        in: ['BOT_CREATED_ORDER', 'PENDING', 'NEW', 'PROCESSING', 'PREPARING', 'READY', 'SHIPPED']
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (existingActiveOrder) {
                console.log(`🚫 [OrderParser] Active order already exists for Conv ${conversationId}. Skipping new detection.`);
                return;
            }
            // 1. Parse content (Regex First)
            let items: ParsedItem[] = this.parseItemsRegex(text, menu);

            // 2. AI Deep extraction (Groq) if regex fails and it looks like an order
            if (items.length === 0 && this.looksLikeOrder(text)) {
                const aiResult = await generateStructuredOrder(text, menu);
                if (aiResult.items && aiResult.items.length > 0) {
                    items = aiResult.items.map(i => ({
                        name: i.name,
                        quantity: i.quantity,
                        price: i.price || 0
                    }));
                }
            }

            if (items.length === 0) return; // No order detected

            if (items.length === 0) return; // No order detected

            const summary = items.map(i => `${i.quantity} x ${i.name}`).join(", ");
            const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

            // 🍔 DE-DUPLICATION: Check if ANY active order with the same summary exists in last 15 mins
            // This prevents duplicate cards if the customer repeats themselves or AI re-triggers.
            const recentOrder = await prisma.order.findFirst({
                where: {
                    conversationId,
                    summary,
                    status: {
                        in: [
                            OrderStatus.BOT_CREATED_ORDER,
                            OrderStatus.PROCESSING,
                            OrderStatus.PREPARING,
                            OrderStatus.READY,
                            OrderStatus.SHIPPED,
                            OrderStatus.NEW,
                            OrderStatus.PENDING,
                            OrderStatus.CONFIRMED
                        ]
                    },
                    isDeleted: false,
                    createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) }
                }
            });

            if (recentOrder) {
                console.log(`🚫 [OrderParser] Duplicate detected for Conv ${conversationId}. Skipping.`);
                return;
            }

            console.log(`🍔 [OrderParser] Detected ${items.length} items for Conv ${conversationId} (fresh order)`);

            const isUrgent = totalAmount > 0; // Alert on ANY amount > 0, not just > 500

            // 4. Create Order
            const order = await prisma.order.create({
                data: {
                    companyId,
                    conversationId,
                    leadId,
                    summary,
                    amount: totalAmount,
                    status: OrderStatus.BOT_CREATED_ORDER, // 🆕 Created as Ghost order
                    source: OrderSource.BOT_DETECTED,
                    priority: isUrgent ? OrderPriority.URGENT : OrderPriority.NORMAL,
                    priorityScore: isUrgent ? 100 : 50,
                    predictedValue: totalAmount
                },
                include: { conversation: { include: { lead: true } } }
            });

            // 5. Update Conversation & Lead Stats (CRITICAL FOR CRM VALUE)
            await this.updateStats(conversationId, leadId, totalAmount);

            // 6. Notify & Emit
            await this.notifyNewOrder(companyId, order);
            safeEmitConversationUpdate(order.conversation, "order_detected", order);

            // 7. System Message (Order Card Indicator) - ONLY for Human agents or if not in BOT mode
            // Stop redundant "Order Detected" messages if the BOT is already handling the conversation
            if (order.conversation.mode !== "BOT") {
                const sysMsg = await prisma.message.create({
                    data: {
                        conversationId,
                        sender: MessageSender.SYSTEM,
                        content: `📝 Order Detected: ${summary} (Total: ₹${totalAmount}). Waiting for confirmation.`
                    }
                });
                emitToConversation(conversationId, "new_message", sysMsg);
            } else {
                console.log(`🤖 [OrderParser] Bot is active. Skipping redundant system message for Conv ${conversationId}.`);
            }

        } catch (error) {
            console.error("❌ Order Parser Error:", error);
        }
    }

    private looksLikeOrder(text: string): boolean {
        const lower = text.toLowerCase();
        const orderKeywords = ["order", "buy", "want", "amount", "rupees", "venum", "chahiye", "book", "dena", "vangi"];
        const hasKeyword = orderKeywords.some(kw => lower.includes(kw));
        const hasQuantity = /\d+/.test(lower);

        // Strict Priority: Quantity + keyword or just keyword
        return hasKeyword || (hasQuantity && lower.length > 3);
    }

    /**
     * Regex + Menu Matching Logic
     */
    private parseItemsRegex(text: string, menu: any): ParsedItem[] {
        const items: ParsedItem[] = [];
        const normalize = (s: string) => s.toLowerCase().trim();

        // 1. Get Menu Items for fuzzy match
        const menuItems = menu?.categories?.flatMap((c: any) => c.items) || [];

        // 2. Regex Pattern: "2 burgers", "1 x pizza"
        const regex = /(\d+)\s*(?:x\s*)?([a-zA-Z\s]+)/gi;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const quantity = parseInt(match[1]);
            const rawName = match[2].trim();
            // Filter out common non-item words if short
            if (rawName.length < 3 && !['tea', 'pie'].includes(rawName.toLowerCase())) continue;

            let matchedPrice = 0;
            let finalName = rawName;

            if (menuItems.length > 0) {
                const menuItem = menuItems.find((i: any) =>
                    normalize(i.name).includes(normalize(rawName)) ||
                    normalize(rawName).includes(normalize(i.name))
                );

                if (menuItem) {
                    finalName = menuItem.name;
                    matchedPrice = menuItem.price;
                    items.push({ name: finalName, quantity, price: matchedPrice });
                } else {
                    // Item not found in menu - skip it
                    console.log(`🚫 [OrderParser] Item "${rawName}" not found in menu. Skipping.`);
                    continue;
                }
            } else {
                // No menu available - add item (legacy behavior)
                items.push({ name: finalName, quantity, price: matchedPrice });
            }
        }

        return items;
    }

    /**
     * Updates Conversation Priority AND Lead Stats
     */
    async updateStats(conversationId: string, leadId: string, newOrderValue: number) {
        // Conversation Priority
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                priorityScore: { increment: Math.floor(newOrderValue * 0.1) },
                intent: "ORDERING"
            }
        });

        // Lead Stats (Updates "Value (CRM)" column)
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                totalSpend: { increment: newOrderValue },
                orderCount: { increment: 1 },
                lastActiveAt: new Date()
            }
        });
    }

    async notifyNewOrder(companyId: string, order: any) {
        // 1. DATA SYNC: Send 'order_detected' to conversation participants
        // Use 'order_detected' so dashboard doesn't show it immediately
        emitToCompanyAdmin(companyId, "order_detected", order); // Admins can audit

        // 2. ALERT: Notify Assigned Agent (Primary)
        if (order.conversation?.assignedToId) {
            emitToAgent(order.conversation.assignedToId, "order_detected", order);

            await notificationService.notifyUser(
                order.conversation.assignedToId,
                `New Order Detected: ₹${order.amount}`,
                `Check conversation with ${order.conversation?.lead?.contact}`,
                "ORDER"
            );
        } else {
            // Fallback: Notify Admins if unassigned
            await notificationService.notifyCompanyAdmins(
                companyId,
                `New Order (Unassigned): ₹${order.amount}`,
                `From ${order.conversation?.lead?.contact}`,
                "ORDER"
            );
        }
    }
}

export const orderParserService = new OrderParserService();
