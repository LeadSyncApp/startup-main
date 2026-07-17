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
            const orderId = paymentLink.notes?.order_id;

            if (orderId) {
                const order = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { lead: true }
                });

                if (order) {
                    // Find conversation via lead (Order no longer has direct conversation relation)
                    const conv = order.leadId ? await prisma.conversation.findFirst({
                        where: { leadId: order.leadId, lifecycleStatus: 'active', companyId: order.companyId }
                    }) : null;
                    const conversationId = conv?.id;

                    // 1️⃣ Update Order to PAID using Workflow Service
                    const { order: updatedOrder } = await orderWorkflowService.transitionStatus(
                        order.companyId,
                        orderId,
                        "PAID" as any,
                        { id: "SYSTEM", name: "Razorpay", role: "SYSTEM" }
                    );

                    // 2️⃣ Generate Invoice
                    const paymentId = paymentLink.payment_id || paymentLink.id;
                    await queueProvider.enqueue(PDF_JOB_NAME, { orderId, paymentRef: paymentId });

                    // 3️⃣ 🆕 CRM INTELLIGENCE: Update Lead Stats
                    if (order.leadId) {
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
                    }

                    // 4️⃣ Create System Message
                    let sysMsgText = "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.";

                    const sysMsg = conversationId ? await prisma.message.create({
                        data: {
                            content: sysMsgText,
                            sender: MessageSender.SYSTEM,
                            conversationId,
                            companyId: order.companyId
                        }
                    }) : null;

                    // Real-time Updates
                    if (sysMsg && conversationId) {
                        emitToConversation(conversationId, "new_message", sysMsg);
                    }
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
