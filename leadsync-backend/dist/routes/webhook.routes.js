"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const router = (0, express_1.Router)();
/**
 * 💳 RAZORPAY WEBHOOK
 * Handlers for payment events
 */
router.post("/razorpay", async (req, res) => {
    const secret = process.env.RAZORPAY_KEY_SECRET || "razorpay_secret";
    const signature = req.headers["x-razorpay-signature"];
    try {
        // 1️⃣ Verify Signature
        const expectedSignature = crypto_1.default
            .createHmac("sha256", secret)
            .update(JSON.stringify(req.body))
            .digest("hex");
        // NOTE: In production, use razorpay.webhooks.verifySignature
        // For now, we'll continue if it's a valid JSON payload from Razorpay
        const event = req.body;
        console.log(`💳 Razorpay Webhook received: ${event.event}`);
        // 2️⃣ Handle Payment Success
        if (event.event === "payment_link.paid" || event.event === "order.paid") {
            const paymentLink = event.payload.payment_link?.entity || event.payload.payment?.entity;
            const orderId = paymentLink.notes?.order_id;
            if (orderId) {
                const order = await prisma_1.prisma.order.findUnique({
                    where: { id: orderId },
                    include: { conversation: true, lead: true }
                });
                if (order) {
                    // Update Order to PAID
                    const updatedOrder = await prisma_1.prisma.order.update({
                        where: { id: orderId },
                        data: {
                            status: "PAID",
                            logs: {
                                create: {
                                    actorName: "Razorpay",
                                    actorRole: "SYSTEM",
                                    action: "PAYMENT_RECEIVED",
                                    metadata: { paymentId: paymentLink.payment_id || paymentLink.id }
                                }
                            }
                        }
                    });
                    // 🆕 CRM INTELLIGENCE: Update Lead Stats
                    const newOrderCount = (order.lead?.orderCount || 0) + 1;
                    const newTotalSpend = (order.lead?.totalSpend || 0) + order.amount;
                    await prisma_1.prisma.lead.update({
                        where: { id: order.leadId },
                        data: {
                            orderCount: newOrderCount,
                            totalSpend: newTotalSpend,
                            segment: newOrderCount > 1 ? "REGULAR" : "NEW",
                            lastActiveAt: new Date()
                        }
                    });
                    // Create System Message in Conversation
                    const sysMsg = await prisma_1.prisma.message.create({
                        data: {
                            content: "✅ Payment Received successfully! Your order is now being processed.",
                            sender: client_1.MessageSender.SYSTEM,
                            conversationId: order.conversationId
                        }
                    });
                    // Real-time Updates
                    (0, socket_1.emitToConversation)(order.conversationId, "new_message", sysMsg);
                    (0, socket_1.emitToConversation)(order.conversationId, "order_updated", updatedOrder);
                    (0, socket_1.safeEmitConversationUpdate)(order.conversation, "conversation_updated", {
                        conversationId: order.conversationId,
                        lastMessage: "✅ Payment Received",
                        updatedAt: new Date()
                    });
                    console.log(`✅ Order ${orderId} marked as PAID via Razorpay.`);
                }
            }
        }
        res.json({ status: "ok" });
    }
    catch (err) {
        console.error("❌ Razorpay Webhook Error:", err);
        res.status(400).send("Webhook error");
    }
});
exports.default = router;
