"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderParserService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const notification_service_1 = require("./notification.service");
const geminiService_1 = require("./geminiService");
const sarvam_service_1 = require("./sarvam.service");
class OrderParserService {
    /**
     * Main entry point: Parses text for orders, creates them if found, and handles notifications.
     */
    async processPotentialOrder(companyId, conversationId, leadId, text, menu) {
        try {
            // 1. Parse content (Regex First)
            let items = this.parseItemsRegex(text, menu);
            // 2. AI Fallback: Sarvam.ai (Optimized for Hindi/Mixed & Intent)
            if (items.length === 0) {
                const sarvamResult = await sarvam_service_1.sarvamService.analyzeIntent(text);
                if (sarvamResult && sarvamResult.intent === "ORDER" && sarvamResult.entities?.product) {
                    items.push({
                        name: sarvamResult.entities.product,
                        quantity: sarvamResult.entities.quantity || 1,
                        price: 0 // Will be matched by catalog or agent
                    });
                }
            }
            // 3. AI Deep extraction (Groq) if still no items but looks like order
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
            if (items.length === 0)
                return; // No order detected
            const summary = items.map(i => `${i.quantity} x ${i.name}`).join(", ");
            const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
            // 🍔 DE-DUPLICATION: Check if ANY active order with the same summary exists in last 15 mins
            // This prevents duplicate cards if the customer repeats themselves or AI re-triggers.
            const recentOrder = await prisma_1.prisma.order.findFirst({
                where: {
                    conversationId,
                    summary,
                    status: {
                        in: [
                            client_1.OrderStatus.BOT_CREATED_ORDER,
                            client_1.OrderStatus.PROCESSING,
                            client_1.OrderStatus.PREPARING,
                            client_1.OrderStatus.READY,
                            client_1.OrderStatus.SHIPPED,
                            client_1.OrderStatus.NEW,
                            client_1.OrderStatus.PENDING,
                            client_1.OrderStatus.CONFIRMED
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
            console.log(`🍔 [OrderParser] Detected ${items.length} items for Conv ${conversationId}`);
            const isUrgent = totalAmount > 0; // Alert on ANY amount > 0, not just > 500
            // 4. Create Order
            const order = await prisma_1.prisma.order.create({
                data: {
                    companyId,
                    conversationId,
                    leadId,
                    summary,
                    amount: totalAmount,
                    status: client_1.OrderStatus.BOT_CREATED_ORDER, // 🆕 Created as Ghost order
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
            (0, socket_1.safeEmitConversationUpdate)(order.conversation, "order_detected", order);
            // 7. System Message (Order Card Indicator) - ONLY for Human agents or if not in BOT mode
            // Stop redundant "Order Detected" messages if the BOT is already handling the conversation
            if (order.conversation.mode !== "BOT") {
                const sysMsg = await prisma_1.prisma.message.create({
                    data: {
                        conversationId,
                        sender: client_1.MessageSender.SYSTEM,
                        content: `📝 Order Detected: ${summary} (Total: ₹${totalAmount}). Waiting for confirmation.`
                    }
                });
                (0, socket_1.emitToConversation)(conversationId, "new_message", sysMsg);
            }
            else {
                console.log(`🤖 [OrderParser] Bot is active. Skipping redundant system message for Conv ${conversationId}.`);
            }
        }
        catch (error) {
            console.error("❌ Order Parser Error:", error);
        }
    }
    looksLikeOrder(text) {
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
        // 1. DATA SYNC: Send 'order_detected' to conversation participants
        // Use 'order_detected' so dashboard doesn't show it immediately
        (0, socket_1.emitToCompanyAdmin)(companyId, "order_detected", order); // Admins can audit
        // 2. ALERT: Notify Assigned Agent (Primary)
        if (order.conversation?.assignedToId) {
            (0, socket_1.emitToAgent)(order.conversation.assignedToId, "order_detected", order);
            await notification_service_1.notificationService.notifyUser(order.conversation.assignedToId, `New Order Detected: ₹${order.amount}`, `Check conversation with ${order.conversation?.lead?.contact}`, "ORDER");
        }
        else {
            // Fallback: Notify Admins if unassigned
            await notification_service_1.notificationService.notifyCompanyAdmins(companyId, `New Order (Unassigned): ₹${order.amount}`, `From ${order.conversation?.lead?.contact}`, "ORDER");
        }
    }
}
exports.orderParserService = new OrderParserService();
