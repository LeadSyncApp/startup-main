import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { OrderStatus, OrderApprovalStatus, PaymentIntentStatus, AttemptStatus, RefundStatus } from "@prisma/client";
import instagramRoutes from "./instagram.routes";
import { getPaymentGateway } from "../../services/integrations/payment/paymentGateway.factory";
import { outboxWorker } from "../../services/infrastructure/outbox.worker";

const router = Router();

/**
 * 📸 INSTAGRAM WEBHOOK gateway
 * Secure perimeter resolution via PageID-to-Tenant map
 */
router.use("/instagram", instagramRoutes);

/**
 * 💳 RAZORPAY WEBHOOK
 * Handlers for payment, refund, and dispute events with signature verification,
 * atomic event deduplication, and Transactional Outbox pattern
 */
router.post("/razorpay", async (req: Request, res: Response) => {
    // 1️⃣ Verify secret configuration fast
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        console.error("❌ Razorpay Verification Error: Webhook secret missing on server");
        return res.status(500).json({ error: "Webhook secret missing on server" });
    }

    const signature = req.headers["x-razorpay-signature"] as string;

    try {
        // 2️⃣ Verify Signature with raw body via IPaymentGateway
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
            console.error("❌ Razorpay Verification Error: rawBody is missing");
            return res.status(400).json({ error: "rawBody is missing" });
        }

        const gateway = getPaymentGateway("razorpay");
        const isValidSignature = gateway.verifyWebhookSignature(rawBody, signature, secret);

        if (!isValidSignature) {
            console.error("❌ Razorpay Invalid Signature");
            return res.status(400).json({ error: "Invalid signature" });
        }

        const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
        const eventHash = crypto.createHash("sha256").update(rawBodyString).digest("hex");
        const event = req.body;
        const eventType = event?.event || "unknown";

        console.log(`💳 Razorpay Webhook received: ${eventType} (Hash: ${eventHash.slice(0, 10)})`);

        let isDuplicateEvent = false;

        // 3️⃣ Atomic DB Transaction: Insert event ledger row + perform order updates & write OutboxEvent
        await prisma.$transaction(async (tx) => {
            // Direct insert into ProcessedWebhookEvent table
            try {
                await tx.processedWebhookEvent.create({
                    data: {
                        id: eventHash,
                        provider: "razorpay",
                        eventType: eventType
                    }
                });
            } catch (err: any) {
                if (
                    err.code === "P2002" || 
                    err.message?.includes("Unique constraint failed") || 
                    err.message?.includes("processedWebhookEvent_pkey")
                ) {
                    isDuplicateEvent = true;
                    return; // Exit transaction block cleanly
                }
                throw err;
            }

            // 4️⃣ Handle Payment Success
            if (event.event === "payment_link.paid" || event.event === "order.paid") {
                const paymentLink = event.payload?.payment_link?.entity || event.payload?.payment?.entity;
                const notes = paymentLink?.notes || {};
                const orderId = notes.order_id;
                const paymentIntentId = notes.payment_intent_id;
                const paymentId = paymentLink?.payment_id || paymentLink?.id || "PAY_" + Date.now();
                const rawAmount = paymentLink?.amount || (parseFloat(notes.amount || "0") * 100);
                const amountInSubunits = BigInt(Math.round(rawAmount));

                let targetOrder: any = null;

                if (orderId) {
                    targetOrder = await tx.order.findUnique({
                        where: { id: orderId },
                        include: { lead: true }
                    });
                }

                if (targetOrder) {
                    const conv = targetOrder.leadId ? await tx.conversation.findFirst({
                        where: { leadId: targetOrder.leadId, lifecycleStatus: 'active', companyId: targetOrder.companyId }
                    }) : null;

                    const nextVersion = (targetOrder.version || 1) + 1;
                    await tx.order.update({
                        where: { id: targetOrder.id },
                        data: {
                            status: OrderStatus.PAID,
                            amountInSubunits,
                            version: nextVersion,
                            completedAt: new Date(),
                            approvalStatus: OrderApprovalStatus.APPROVED
                        }
                    });

                    await tx.orderLog.create({
                        data: {
                            companyId: targetOrder.companyId,
                            orderId: targetOrder.id,
                            actorId: "SYSTEM",
                            actorName: "Razorpay Webhook",
                            actorRole: "SYSTEM",
                            action: "STATUS_CHANGE",
                            metadata: { from: targetOrder.status, to: OrderStatus.PAID, version: nextVersion }
                        }
                    });

                    // Sync PaymentIntent & PaymentAttempt
                    let intent = paymentIntentId 
                        ? await tx.paymentIntent.findFirst({ where: { id: paymentIntentId, companyId: targetOrder.companyId } })
                        : await tx.paymentIntent.findFirst({ where: { providerPaymentLinkId: paymentLink?.id } });

                    if (!intent) {
                        intent = await tx.paymentIntent.create({
                            data: {
                                companyId: targetOrder.companyId,
                                orderId: targetOrder.id,
                                amountInSubunits,
                                currency: targetOrder.currencyCode || "INR",
                                status: PaymentIntentStatus.SUCCEEDED,
                                provider: "razorpay",
                                providerPaymentLinkId: paymentLink?.id || null,
                                idempotencyKey: `idem_webhook_${targetOrder.id}_${Date.now()}`
                            }
                        });
                    } else if (intent) {
                        await tx.paymentIntent.update({
                            where: { id: intent.id },
                            data: { status: PaymentIntentStatus.SUCCEEDED, orderId: targetOrder.id }
                        });
                    }

                    if (intent) {
                        await tx.paymentAttempt.create({
                            data: {
                                paymentIntentId: intent.id,
                                providerTransactionId: paymentId,
                                amountInSubunits,
                                status: AttemptStatus.SUCCESS,
                                rawPayload: event
                            }
                        });
                    }

                    // Write Transactional Outbox Event for Payment Success
                    await tx.outboxEvent.create({
                        data: {
                            companyId: targetOrder.companyId,
                            aggregateType: "ORDER",
                            aggregateId: targetOrder.id,
                            eventType: "PAYMENT_SUCCEEDED",
                            payload: {
                                orderId: targetOrder.id,
                                paymentId,
                                companyId: targetOrder.companyId,
                                leadId: targetOrder.leadId,
                                conversationId: conv?.id,
                                amount: Number(amountInSubunits) / 100
                            }
                        }
                    });

                    console.log(`✅ Existing Order ${targetOrder.id} marked as PAID via Razorpay webhook. Outbox event written.`);
                } else if (notes.conversation_id || notes.company_id) {
                    const companyId = notes.company_id;
                    const conversationId = notes.conversation_id;
                    const amountFloat = paymentLink?.amount ? paymentLink.amount / 100 : parseFloat(notes.amount || "0");
                    
                    const conv = await tx.conversation.findFirst({
                        where: { id: conversationId }
                    });

                    if (conv) {
                        const createdOrder = await tx.order.create({
                            data: {
                                companyId: conv.companyId,
                                conversationId: conv.id,
                                leadId: conv.leadId!,
                                amount: amountFloat,
                                amountInSubunits,
                                status: OrderStatus.PAID,
                                completedAt: null,
                                summary: notes.summary || "Paid Order (Razorpay)",
                                source: "MANUAL",
                                stockDecremented: false,
                                metadata: {
                                    paymentId,
                                    razorpayLinkId: paymentLink?.id,
                                    isPaymentRequest: true
                                }
                            }
                        });

                        const { decrementStockForOrder } = require("../../services/knowledge/inventory.service");
                        await decrementStockForOrder(createdOrder.id, conv.companyId, tx).catch((e: any) => console.error("Stock decrement error in tx:", e));

                        // Sync PaymentIntent
                        const intent = await tx.paymentIntent.create({
                            data: {
                                companyId: conv.companyId,
                                orderId: createdOrder.id,
                                amountInSubunits,
                                currency: "INR",
                                status: PaymentIntentStatus.SUCCEEDED,
                                provider: "razorpay",
                                providerPaymentLinkId: paymentLink?.id || null,
                                idempotencyKey: `idem_webhook_def_${createdOrder.id}_${Date.now()}`
                            }
                        });

                        await tx.paymentAttempt.create({
                            data: {
                                paymentIntentId: intent.id,
                                providerTransactionId: paymentId,
                                amountInSubunits,
                                status: AttemptStatus.SUCCESS,
                                rawPayload: event
                            }
                        });

                        // Write Transactional Outbox Event for Deferred Order Creation
                        await tx.outboxEvent.create({
                            data: {
                                companyId: conv.companyId,
                                aggregateType: "ORDER",
                                aggregateId: createdOrder.id,
                                eventType: "PAYMENT_SUCCEEDED",
                                payload: {
                                    orderId: createdOrder.id,
                                    paymentId,
                                    companyId: conv.companyId,
                                    leadId: conv.leadId,
                                    conversationId: conv.id,
                                    amount: Number(amountInSubunits) / 100
                                }
                            }
                        });

                        console.log(`✅ Deferred Order ${createdOrder.id} created as PAID via Razorpay webhook. Outbox event written.`);
                    }
                }
            } else if (event.event === "refund.processed" || event.event === "refund.created") {
                // 5️⃣ Handle Refund Processed Event
                const refundEntity = event.payload?.refund?.entity;
                const refundId = refundEntity?.id;
                const paymentId = refundEntity?.payment_id;
                const refundSubunits = BigInt(refundEntity?.amount || 0);

                if (refundId && refundSubunits > 0n) {
                    const attempt = await tx.paymentAttempt.findFirst({
                        where: { providerTransactionId: paymentId },
                        include: { paymentIntent: true }
                    });

                    if (attempt && attempt.paymentIntent) {
                        const intent = attempt.paymentIntent;

                        await tx.refund.upsert({
                            where: { providerRefundId: refundId },
                            create: {
                                companyId: intent.companyId,
                                paymentIntentId: intent.id,
                                amountInSubunits: refundSubunits,
                                status: RefundStatus.PROCESSED,
                                providerRefundId: refundId,
                                reason: refundEntity?.notes?.reason || "Razorpay webhook refund processed"
                            },
                            update: {
                                status: RefundStatus.PROCESSED
                            }
                        });

                        const allProcessedRefunds = await tx.refund.findMany({
                            where: { paymentIntentId: intent.id, status: RefundStatus.PROCESSED }
                        });
                        const totalRefunded = allProcessedRefunds.reduce((sum, r) => sum + r.amountInSubunits, 0n);

                        const newIntentStatus = totalRefunded >= intent.amountInSubunits 
                            ? PaymentIntentStatus.REFUNDED 
                            : PaymentIntentStatus.PARTIALLY_REFUNDED;

                        await tx.paymentIntent.update({
                            where: { id: intent.id },
                            data: { status: newIntentStatus }
                        });

                        // Write Transactional Outbox Event for Refund
                        await tx.outboxEvent.create({
                            data: {
                                companyId: intent.companyId,
                                aggregateType: "PAYMENT_INTENT",
                                aggregateId: intent.id,
                                eventType: newIntentStatus === PaymentIntentStatus.REFUNDED ? "PAYMENT_REFUNDED" : "PAYMENT_PARTIALLY_REFUNDED",
                                payload: {
                                    companyId: intent.companyId,
                                    paymentIntentId: intent.id,
                                    orderId: intent.orderId,
                                    refundId,
                                    refundAmount: refundSubunits.toString(),
                                    newIntentStatus
                                }
                            }
                        });

                        console.log(`💸 [Webhook] Refund ${refundId} processed for PaymentIntent ${intent.id}. Outbox event written.`);
                    }
                }
            } else if (event.event === "refund.failed") {
                const refundEntity = event.payload?.refund?.entity;
                const refundId = refundEntity?.id;
                if (refundId) {
                    await tx.refund.updateMany({
                        where: { providerRefundId: refundId },
                        data: { status: RefundStatus.FAILED }
                    });
                }
            } else if (event.event === "payment.dispute.created") {
                const disputeEntity = event.payload?.dispute?.entity;
                await tx.outboxEvent.create({
                    data: {
                        companyId: disputeEntity?.company_id || disputeEntity?.notes?.company_id || null,
                        aggregateType: "PAYMENT_INTENT",
                        aggregateId: disputeEntity?.id || "unknown",
                        eventType: "PAYMENT_DISPUTED",
                        payload: disputeEntity || {}
                    }
                });
            } else if (event.event === "payment_link.cancelled" || event.event === "payment.failed") {
                const paymentEntity = event.payload?.payment_link?.entity || event.payload?.payment?.entity;
                const notes = paymentEntity?.notes || {};
                const companyId = notes.company_id || notes.companyId;
                const orderId = notes.order_id || notes.orderId || "N/A";
                const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : parseFloat(notes.amount || "0");

                if (companyId) {
                    await tx.outboxEvent.create({
                        data: {
                            companyId,
                            aggregateType: "ORDER",
                            aggregateId: orderId,
                            eventType: "PAYMENT_FAILED",
                            payload: {
                                companyId,
                                orderId,
                                amount,
                                reason: event.event === "payment_link.cancelled" ? "Payment link cancelled" : "Payment failed"
                            }
                        }
                    });
                }
            }
        });

        if (isDuplicateEvent) {
            console.log(`ℹ️ Razorpay webhook event ${eventHash.slice(0, 10)} already processed. Returning 200 OK.`);
            return res.status(200).json({ status: "already_processed", message: "Duplicate webhook ignored" });
        }

        // Trigger Outbox worker asynchronously after successful DB commit
        outboxWorker.processPendingEvents().catch((err) => {
            console.error("❌ OutboxWorker async execution error:", err);
        });

        return res.status(200).json({ status: "ok" });
    } catch (err: any) {
        console.error("❌ Razorpay Webhook Error:", err);
        return res.status(500).json({ error: "Webhook error", details: err.message });
    }
});

export default router;
