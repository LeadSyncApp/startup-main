import { prisma } from "../lib/prisma";
import { OrderSource, OrderStatus, OrderPriority, MessageSender } from "@prisma/client";
import { emitToCompany, emitToConversation, emitToAgent, emitToCompanyAdmin, safeEmitConversationUpdate } from "../lib/socket";
import { notificationService } from "./notification.service";
import { generateStructuredOrder } from "./geminiService";

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
            // 1. Parse content (Regex First)
            let items: ParsedItem[] = this.parseItemsRegex(text, menu);

            // 2. AI Fallback (If Regex failed but text looks like an order)
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

            console.log(`🍔 [OrderParser] Detected ${items.length} items for Conv ${conversationId}`);

            // 3. Calculate Value
            const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
            const summary = items.map(i => `${i.quantity} x ${i.name}`).join(", ");
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

            // 7. System Message (Order Card Indicator)
            // We use a specific content marker or relying on the socket event to render the UI
            await prisma.message.create({
                data: {
                    conversationId,
                    sender: MessageSender.SYSTEM,
                    content: `📝 Order Detected: ${summary} (Total: ₹${totalAmount}). Waiting for confirmation.`
                }
            });

        } catch (error) {
            console.error("❌ Order Parser Error:", error);
        }
    }

    private looksLikeOrder(text: string): boolean {
        const lower = text.toLowerCase();
        return lower.includes("order") || lower.includes("buy") || lower.includes("want") || lower.includes("amount") || lower.includes("rupees") || lower.match(/\d+/) !== null;
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
                }
            }

            items.push({ name: finalName, quantity, price: matchedPrice });
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
