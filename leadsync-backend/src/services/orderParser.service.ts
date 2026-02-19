import { prisma } from "../lib/prisma";
import { OrderSource, OrderStatus, OrderPriority, MessageSender } from "@prisma/client";
import { emitToCompany, emitToConversation, emitToAgent, emitToCompanyAdmin, safeEmitConversationUpdate } from "../lib/socket";
import { notificationService } from "./notification.service";

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
            // 1. Parse content
            const items = this.parseItems(text, menu);

            if (items.length === 0) return; // No order detected

            console.log(`🍔 [OrderParser] Detected ${items.length} items for Conv ${conversationId}`);

            // 2. Calculate Value
            const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
            const summary = items.map(i => `${i.quantity} x ${i.name}`).join(", ");
            const isUrgent = totalAmount > 500; // Example threshold

            // 3. Create Order
            const order = await prisma.order.create({
                data: {
                    companyId,
                    conversationId,
                    leadId,
                    summary,
                    amount: totalAmount,
                    status: OrderStatus.NEW,
                    source: OrderSource.BOT_DETECTED,
                    priority: isUrgent ? OrderPriority.URGENT : OrderPriority.NORMAL,
                    priorityScore: isUrgent ? 100 : 50, // Initial score
                    predictedValue: totalAmount
                },
                include: { conversation: { include: { lead: true } } } // Include lead for notification
            });

            // 4. Update Conversation Priority Calculation
            await this.updateConversationPriority(conversationId, totalAmount);

            // 5. Notify & Emit
            await this.notifyNewOrder(companyId, order);

            // 6. System Message
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

    /**
     * Regex + Menu Matching Logic
     */
    private parseItems(text: string, menu: any): ParsedItem[] {
        const items: ParsedItem[] = [];
        const normalize = (s: string) => s.toLowerCase().trim();

        // 1. Get Menu Items for fuzzy match
        const menuItems = menu?.categories?.flatMap((c: any) => c.items) || [];

        // 2. Regex Pattern: "2 burgers", "1 x pizza", "two cokes"
        // Simple numeric matcher first
        const regex = /(\d+)\s*(?:x\s*)?([a-zA-Z\s]+)/gi;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const quantity = parseInt(match[1]);
            const rawName = match[2].trim();

            // 3. Validation against menu (if available)
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
                } else {
                    // Skip unknown items if strict mode? No, capture potential custom items.
                    // But for revenue calc, price is 0.
                }
            }

            items.push({ name: finalName, quantity, price: matchedPrice });
        }

        return items;
    }

    /**
     * Recalculates and updates the conversation's priority score.
     */
    async updateConversationPriority(conversationId: string, newOrderValue: number) {
        // Simple formula: Existing Sentiment + New Order Value
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                priorityScore: { increment: Math.floor(newOrderValue * 0.1) }, // 10% of value added to score
                intent: "ORDERING"
            }
        });
    }

    async notifyNewOrder(companyId: string, order: any) {
        // 1. DATA SYNC: Update Dashboard/Board immediately
        emitToCompanyAdmin(companyId, "order_created", order);

        // 2. ALERT: Create persistent notification for Admins
        await notificationService.notifyCompanyAdmins(
            companyId,
            `New Order - ₹${order.amount}`,
            `New order from ${order.conversation?.lead?.contact || 'Customer'} detected.`,
            "ORDER"
        );

        // 3. User Notification if assigned
        if (order.conversation?.assignedToId) {
            emitToAgent(order.conversation.assignedToId, "order_created", order);

            await notificationService.notifyUser(
                order.conversation.assignedToId,
                `New Order Assigned - ₹${order.amount}`,
                `You have a new order in your assigned conversation.`,
                "ORDER"
            );
        }
    }
}

export const orderParserService = new OrderParserService();
