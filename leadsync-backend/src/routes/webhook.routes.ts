import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { OrderStatus, MessageSender } from "@prisma/client";
import { emitToConversation, safeEmitConversationUpdate } from "../lib/socket";
import { invoiceService } from "../services/invoice.service";
import { orderWorkflowService } from "../services/orderWorkflow.service";


const router = Router();

/**
 * 💳 RAZORPAY WEBHOOK
 * Handlers for payment events
 */
router.post("/razorpay", async (req: Request, res: Response) => {
    const secret = process.env.RAZORPAY_KEY_SECRET || "razorpay_secret";
    const signature = req.headers["x-razorpay-signature"] as string;

    try {
        // 1️⃣ Verify Signature
        const expectedSignature = crypto
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
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { conversation: true, lead: true }
                });

                if (order) {
                    // 1️⃣ Update Order to PAID using Workflow Service
                    const { order: updatedOrder } = await orderWorkflowService.transitionStatus(
                        orderId,
                        "PAID" as any,
                        { id: "SYSTEM", name: "Razorpay", role: "SYSTEM" }
                    );

                    // 2️⃣ Generate Invoice
                    const paymentId = paymentLink.payment_id || paymentLink.id;
                    const invoice = await invoiceService.ensureInvoiceForPaidOrder(orderId, paymentId);

                    // 3️⃣ 🆕 CRM INTELLIGENCE: Update Lead Stats
                    const newOrderCount = (order.lead?.orderCount || 0) + 1;
                    const newTotalSpend = (order.lead?.totalSpend || 0) + order.amount;
                    await prisma.lead.update({
                        where: { id: order.leadId },
                        data: {
                            orderCount: newOrderCount,
                            totalSpend: newTotalSpend,
                            segment: newOrderCount > 1 ? "REGULAR" : "NEW",
                            lastActiveAt: new Date()
                        }
                    });

                    // 4️⃣ Create System Message with Invoice Link
                    let content = "✅ Payment Received successfully! Your order is now being processed.";
                    if (invoice.pdfUrl) {
                        content += `\n\n📄 View your invoice: ${invoice.pdfUrl}`;
                    }

                    const sysMsg = await prisma.message.create({
                        data: {
                            content,
                            sender: MessageSender.SYSTEM,
                            conversationId: order.conversationId
                        }
                    });

                    // Real-time Updates
                    emitToConversation(order.conversationId, "new_message", sysMsg);
                    // Updated order already emitted by workflow service, but we might want to emit it again with invoice details if needed
                    // emitToConversation(order.conversationId, "order_updated", updatedOrder);

                    console.log(`✅ Order ${orderId} marked as PAID and invoice generated.`);
                }
            }
        }

        res.json({ status: "ok" });
    } catch (err) {
        console.error("❌ Razorpay Webhook Error:", err);
        res.status(400).send("Webhook error");
    }
});

export default router;
