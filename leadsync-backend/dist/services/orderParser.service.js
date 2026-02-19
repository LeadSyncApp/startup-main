"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderParserService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const notification_service_1 = require("./notification.service");
const geminiService_1 = require("./geminiService");
class OrderParserService {
    /**
     * Main entry point: Parses text for orders, creates them if found, and handles notifications.
     */
    async processPotentialOrder(companyId, conversationId, leadId, text, menu) {
        try {
            // 1. Parse content (Regex First)
            let items = this.parseItemsRegex(text, menu);
            // 2. AI Fallback (If Regex failed but text looks like an order)
            if (items.length === 0 && this.looksLikeOrder(text)) {
                const aiResult = await (0, geminiService_1.generateStructuredOrder)(text, menu);
                if (aiResult.items && aiResult.items.length > 0) {
                    items = aiResult.items.map(i => ({
                        name: i.name,
                        quantity: i.quantity,
                        price: i.price || 0
                    }));
                }
            }
            if (items.length === 0)
                return; // No order detected
            console.log(`🍔 [OrderParser] Detected ${items.length} items for Conv ${conversationId}`);
            // 3. Calculate Value
            const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
            const summary = items.map(i => `${i.quantity} x ${i.name}`).join(", ");
            const isUrgent = totalAmount > 0; // Alert on ANY amount > 0, not just > 500
            // 4. Create Order
            const order = await prisma_1.prisma.order.create({
                data: {
                    companyId,
                    conversationId,
                    leadId,
                    summary,
                    amount: totalAmount,
                    status: client_1.OrderStatus.PENDING, // 🆕 Created as Pending/Ghost order
                    source: client_1.OrderSource.BOT_DETECTED,
                    priority: isUrgent ? client_1.OrderPriority.URGENT : client_1.OrderPriority.NORMAL,
                    priorityScore: isUrgent ? 100 : 50,
                    predictedValue: totalAmount
                },
                include: { conversation: { include: { lead: true } } }
            });
            // 5. Update Conversation & Lead Stats (CRITICAL FOR CRM VALUE)
            await this.updateStats(conversationId, leadId, totalAmount);
            // 6. Notify & Emit
            await this.notifyNewOrder(companyId, order);
            // 7. System Message
            await prisma_1.prisma.message.create({
                data: {
                    conversationId,
                    sender: client_1.MessageSender.SYSTEM,
                    content: `📝 Order Detected: ${summary} (Total: ₹${totalAmount}). Waiting for confirmation.`
                }
            });
        }
        catch (error) {
            console.error("❌ Order Parser Error:", error);
        }
    }
    looksLikeOrder(text) {
        const lower = text.toLowerCase();
        return lower.includes("order") || lower.includes("buy") || lower.includes("want") || lower.includes("amount") || lower.includes("rupees") || lower.match(/\d+/) !== null;
    }
    /**
     * Regex + Menu Matching Logic
     */
    parseItemsRegex(text, menu) {
        const items = [];
        const normalize = (s) => s.toLowerCase().trim();
        // 1. Get Menu Items for fuzzy match
        const menuItems = menu?.categories?.flatMap((c) => c.items) || [];
        // 2. Regex Pattern: "2 burgers", "1 x pizza"
        const regex = /(\d+)\s*(?:x\s*)?([a-zA-Z\s]+)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const quantity = parseInt(match[1]);
            const rawName = match[2].trim();
            // Filter out common non-item words if short
            if (rawName.length < 3 && !['tea', 'pie'].includes(rawName.toLowerCase()))
                continue;
            let matchedPrice = 0;
            let finalName = rawName;
            if (menuItems.length > 0) {
                const menuItem = menuItems.find((i) => normalize(i.name).includes(normalize(rawName)) ||
                    normalize(rawName).includes(normalize(i.name)));
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
    async updateStats(conversationId, leadId, newOrderValue) {
        // Conversation Priority
        await prisma_1.prisma.conversation.update({
            where: { id: conversationId },
            data: {
                priorityScore: { increment: Math.floor(newOrderValue * 0.1) },
                intent: "ORDERING"
            }
        });
        // Lead Stats (Updates "Value (CRM)" column)
        await prisma_1.prisma.lead.update({
            where: { id: leadId },
            data: {
                totalSpend: { increment: newOrderValue },
                orderCount: { increment: 1 },
                lastActiveAt: new Date()
            }
        });
    }
    async notifyNewOrder(companyId, order) {
        // 1. DATA SYNC: Update Dashboard/Board immediately
        (0, socket_1.emitToCompanyAdmin)(companyId, "order_created", order);
        // 2. ALERT: Create persistent notification for Admins
        await notification_service_1.notificationService.notifyCompanyAdmins(companyId, `New Order: ₹${order.amount}`, `From ${order.conversation?.lead?.contact}: ${order.summary}`, "ORDER");
        // 3. User Notification if assigned
        if (order.conversation?.assignedToId) {
            (0, socket_1.emitToAgent)(order.conversation.assignedToId, "order_created", order);
            await notification_service_1.notificationService.notifyUser(order.conversation.assignedToId, `New Order Assigned: ₹${order.amount}`, `You have a new order: ${order.summary}`, "ORDER");
        }
    }
}
exports.orderParserService = new OrderParserService();
