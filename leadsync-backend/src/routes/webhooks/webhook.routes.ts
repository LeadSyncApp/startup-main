import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { OrderStatus, Channel, MessageSender } from "@prisma/client";
import { emitToConversation, safeEmitConversationUpdate } from "../../lib/socket";
import { queueProvider } from "../../services/infrastructure/queue-provider/queue-provider.factory";
import instagramRoutes from "./instagram.routes";
import { orderWorkflowService } from "../../services/workflow/orderWorkflow.service";
import { PDF_JOB_NAME } from "../../services/infrastructure/pgboss/jobs/pdf.job";


const router = Router();

/**
 * 📸 INSTAGRAM WEBHOOK gateway
 * Secure perimeter resolution via PageID-to-Tenant map
 */
router.use("/instagram", instagramRoutes);

/**
 * 💳 RAZORPAY WEBHOOK
 * Handlers for payment events
 */
router.post("/razorpay", async (req: Request, res: Response) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "razorpay_secret";
    const signature = req.headers["x-razorpay-signature"] as string;

    try {
        // 1️⃣ Verify Signature with raw body to guarantee deterministic checksums
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
            console.error("❌ Razorpay Verification Error: rawBody is missing");
            return res.status(400).json({ error: "rawBody is missing" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        const signatureBuf = Buffer.from(signature || "", "utf8");
        const expectedSignatureBuf = Buffer.from(expectedSignature, "utf8");

        if (
            signatureBuf.length !== expectedSignatureBuf.length ||
            !crypto.timingSafeEqual(signatureBuf, expectedSignatureBuf)
        ) {
            console.error("❌ Razorpay Invalid Signature");
            return res.status(403).json({ error: "Invalid signature" });
        }
        const event = req.body;
        console.log(`💳 Razorpay Webhook received: ${event.event}`);

        // 2️⃣ Handle Payment Success
        if (event.event === "payment_link.paid" || event.event === "order.paid") {
            const paymentLink = event.payload.payment_link?.entity || event.payload.payment?.entity;
            const notes = paymentLink.notes || {};
            const orderId = notes.order_id;
            const paymentId = paymentLink.payment_id || paymentLink.id || "PAY_" + Date.now();

            let targetOrder: any = null;

            if (orderId) {
                targetOrder = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { lead: true }
                });
            }

            if (targetOrder) {
                // Existing order: Transition status to PAID
                const conv = targetOrder.leadId ? await prisma.conversation.findFirst({
                    where: { leadId: targetOrder.leadId, lifecycleStatus: 'active', companyId: targetOrder.companyId }
                }) : null;

                const { order: updatedOrder } = await orderWorkflowService.transitionStatus(
                    targetOrder.companyId,
                    targetOrder.id,
                    "PAID" as any,
                    { id: "SYSTEM", name: "Razorpay Webhook", role: "SYSTEM" }
                );

                await queueProvider.enqueue(PDF_JOB_NAME, { orderId: targetOrder.id, paymentRef: paymentId });

                if (targetOrder.leadId) {
                    const { recalculateLeadCRM } = require("../../services/integrations/crm.service");
                    await recalculateLeadCRM(targetOrder.leadId, targetOrder.companyId);
                }

                if (conv) {
                    const sysMsg = await prisma.message.create({
                        data: {
                            content: "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.",
                            sender: MessageSender.SYSTEM,
                            conversationId: conv.id,
                            companyId: targetOrder.companyId
                        }
                    });
                    emitToConversation(conv.id, "new_message", sysMsg);
                }

                console.log(`✅ Existing Order ${targetOrder.id} marked as PAID via Razorpay webhook.`);
            } else if (notes.conversation_id || notes.company_id) {
                // Deferred Order Creation: Create PAID order in DB upon real payment confirmation
                const companyId = notes.company_id;
                const conversationId = notes.conversation_id;
                const amount = paymentLink.amount ? paymentLink.amount / 100 : parseFloat(notes.amount || "0");
                
                const conv = await prisma.conversation.findFirst({
                    where: { id: conversationId }
                });

                if (conv) {
                    const createdOrder = await prisma.order.create({
                        data: {
                            companyId: conv.companyId,
                            conversationId: conv.id,
                            leadId: conv.leadId!,
                            amount,
                            status: OrderStatus.PAID,
                            completedAt: null,
                            summary: notes.summary || "Paid Order (Razorpay)",
                            source: "MANUAL",
                            metadata: {
                                paymentId,
                                razorpayLinkId: paymentLink.id,
                                isPaymentRequest: true
                            }
                        }
                    });

                    const { decrementStockForOrder } = require("../../services/knowledge/inventory.service");
                    await decrementStockForOrder(createdOrder.id, conv.companyId).catch((e: any) => console.error(e));

                    await queueProvider.enqueue(PDF_JOB_NAME, { orderId: createdOrder.id, paymentRef: paymentId });

                    if (conv.leadId) {
                        const { recalculateLeadCRM } = require("../../services/integrations/crm.service");
                        await recalculateLeadCRM(conv.leadId, conv.companyId);
                    }

                    const sysMsg = await prisma.message.create({
                        data: {
                            content: "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.",
                            sender: MessageSender.SYSTEM,
                            conversationId: conv.id,
                            companyId: conv.companyId
                        }
                    });
                    emitToConversation(conv.id, "new_message", sysMsg);

                    console.log(`✅ Deferred Order ${createdOrder.id} created as PAID via Razorpay webhook.`);
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
