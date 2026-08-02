import { prisma } from "../../lib/prisma";
import { MessageSender } from "@prisma/client";
import { emitToConversation } from "../../lib/socket";
import { queueProvider } from "../infrastructure/queue-provider/queue-provider.factory";
import { PDF_JOB_NAME } from "../infrastructure/pgboss/jobs/pdf.job";
import { businessNotificationService } from "../infrastructure/businessNotification.service";
import { resolveTenantContext, tenantContextStorage } from "../context/tenantContext.provider";

export class OutboxWorker {
    private isProcessing = false;

    /**
     * Processes pending OutboxEvent records asynchronously.
     */
    public async processPendingEvents(): Promise<number> {
        if (this.isProcessing) {
            return 0;
        }

        this.isProcessing = true;
        let processedCount = 0;

        try {
            const events = await prisma.outboxEvent.findMany({
                where: { status: "PENDING" },
                orderBy: { createdAt: "asc" },
                take: 50
            });

            for (const event of events) {
                try {
                    const companyId = event.companyId || (event.payload as any)?.companyId;
                    if (companyId) {
                        const context = await resolveTenantContext(companyId).catch(() => null);
                        if (context) {
                            await tenantContextStorage.run(context, async () => {
                                await this.handleEvent(event);
                            });
                        } else {
                            await this.handleEvent(event);
                        }
                    } else {
                        await this.handleEvent(event);
                    }

                    await prisma.outboxEvent.update({
                        where: { id: event.id },
                        data: {
                            status: "PROCESSED",
                            processedAt: new Date(),
                            error: null
                        }
                    });
                    processedCount++;
                } catch (err: any) {
                    console.error(`❌ Outbox event ${event.id} failed:`, err);
                    const newRetryCount = event.retryCount + 1;
                    await prisma.outboxEvent.update({
                        where: { id: event.id },
                        data: {
                            retryCount: newRetryCount,
                            status: newRetryCount >= 3 ? "FAILED" : "PENDING",
                            error: err?.message || String(err)
                        }
                    });
                }
            }
        } finally {
            this.isProcessing = false;
        }

        return processedCount;
    }

    private async handleEvent(event: any): Promise<void> {
        const { eventType, payload } = event;
        console.log(`⚡ [OutboxWorker] Handling event ${event.id} (Type: ${eventType})`);

        if (eventType === "PAYMENT_SUCCEEDED" || eventType === "ORDER_PAID") {
            const { orderId, paymentId, companyId, leadId, conversationId, amount } = payload;

            if (orderId) {
                // 1. Enqueue PDF generation job
                try {
                    const { pgBossService } = require("./pgboss/pgboss.service");
                    if (pgBossService.isStarted) {
                        await queueProvider.enqueue(PDF_JOB_NAME, { orderId, paymentRef: paymentId });
                    }
                } catch (e) {
                    console.error(`⚠️ PDF Job enqueue error for order ${orderId}:`, e);
                }

                // 2. Recalculate Lead CRM
                if (leadId && companyId) {
                    try {
                        const { recalculateLeadCRM } = require("../integrations/crm.service");
                        await recalculateLeadCRM(leadId, companyId);
                    } catch (crmErr) {
                        console.error(`⚠️ Lead CRM recalculation error for lead ${leadId}:`, crmErr);
                    }
                }

                // 3. Post system message to conversation
                if (conversationId && companyId) {
                    try {
                        const sysMsg = await prisma.message.create({
                            data: {
                                content: "✅ Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.",
                                sender: MessageSender.SYSTEM,
                                conversationId,
                                companyId
                            }
                        });
                        emitToConversation(conversationId, "new_message", sysMsg);
                    } catch (msgErr) {
                        console.error(`⚠️ System message creation error for conversation ${conversationId}:`, msgErr);
                    }
                }

                // 4. Send business notification
                if (companyId) {
                    await businessNotificationService.notifyPaymentStatus({
                        companyId,
                        orderId,
                        amount: amount ? Number(amount) : 0,
                        isSuccess: true
                    }).catch((err) => console.error("❌ Payment notification error:", err));
                }
            }
        } else if (eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_PARTIALLY_REFUNDED") {
            const { companyId, orderId, refundAmount, newIntentStatus } = payload;
            if (companyId && orderId) {
                await businessNotificationService.notifyPaymentStatus({
                    companyId,
                    orderId,
                    amount: refundAmount ? Number(refundAmount) / 100 : 0,
                    isSuccess: false,
                    reason: `Payment refunded (${newIntentStatus})`
                }).catch((err) => console.error("❌ Refund notification error:", err));
            }
        } else if (eventType === "PAYMENT_FAILED" || eventType === "PAYMENT_CANCELLED") {
            const { companyId, orderId, amount, reason } = payload;
            if (companyId) {
                await businessNotificationService.notifyPaymentStatus({
                    companyId,
                    orderId: orderId || "N/A",
                    amount: amount ? Number(amount) : 0,
                    isSuccess: false,
                    reason: reason || "Payment failed or cancelled"
                }).catch((err) => console.error("❌ Payment failure notification error:", err));
            }
        } else if (eventType === "PAYMENT_DISPUTED") {
            console.log(`🚨 [OutboxWorker] Payment Dispute event logged for aggregate ${event.aggregateId}`);
        }
    }
}

export const outboxWorker = new OutboxWorker();
