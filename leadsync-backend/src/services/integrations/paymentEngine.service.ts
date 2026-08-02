import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { PaymentIntentStatus, AttemptStatus, RefundStatus } from "@prisma/client";
import { getPaymentGateway } from "./payment/paymentGateway.factory";

export class PaymentEngineService {
    /**
     * Creates a new PaymentIntent record.
     * Enforces idempotency via idempotencyKey.
     */
    public async createPaymentIntent(params: {
        companyId: string;
        amountInSubunits: bigint | number;
        currency?: string;
        orderId?: string;
        metadata?: any;
        idempotencyKey?: string;
    }) {
        const amountInSubunits = BigInt(params.amountInSubunits);
        const currency = (params.currency || "INR").toUpperCase();
        const idempotencyKey = params.idempotencyKey || `idem_${params.companyId}_${params.orderId || "direct"}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const existing = await prisma.paymentIntent.findFirst({
            where: { idempotencyKey, companyId: params.companyId }
        });
        if (existing) {
            return existing;
        }

        const intent = await prisma.paymentIntent.create({
            data: {
                companyId: params.companyId,
                orderId: params.orderId || null,
                amountInSubunits,
                currency,
                status: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
                provider: "razorpay",
                idempotencyKey,
                metadata: params.metadata || {}
            }
        });

        return intent;
    }

    /**
     * Creates a Payment Link for a PaymentIntent via IPaymentGateway and records a PaymentAttempt.
     */
    public async createPaymentLinkForIntent(paymentIntentId: string, customerContact: string, companyId?: string): Promise<{ short_url: string; paymentIntent: any }> {
        const intent = await prisma.paymentIntent.findFirst({
            where: companyId ? { id: paymentIntentId, companyId } : { id: paymentIntentId }
        });

        if (!intent) {
            throw new Error("PaymentIntent not found");
        }

        const gateway = getPaymentGateway(intent.provider);
        const linkResult = await gateway.createPaymentLink({
            amountInSubunits: intent.amountInSubunits,
            currency: intent.currency,
            customerContact,
            callbackUrl: `${process.env.API_BASE_URL}/api/public/payment-success`,
            notes: {
                payment_intent_id: intent.id,
                company_id: intent.companyId,
                order_id: intent.orderId || ""
            }
        });

        const updatedIntent = await prisma.paymentIntent.update({
            where: { id: intent.id },
            data: {
                providerPaymentLinkId: linkResult.providerPaymentLinkId,
                status: PaymentIntentStatus.PROCESSING
            }
        });

        await prisma.paymentAttempt.create({
            data: {
                paymentIntentId: intent.id,
                amountInSubunits: intent.amountInSubunits,
                status: AttemptStatus.PENDING
            }
        });

        return { short_url: linkResult.shortUrl, paymentIntent: updatedIntent };
    }

    /**
     * Processes a Refund for a PaymentIntent (supports full and partial refunds) via IPaymentGateway.
     */
    public async processRefund(params: {
        companyId: string;
        paymentIntentId: string;
        amountInSubunits: bigint | number;
        reason?: string;
        actor?: { id: string; name: string };
    }) {
        const refundAmount = BigInt(params.amountInSubunits);
        if (refundAmount <= 0n) {
            throw new Error("Refund amount must be greater than zero");
        }

        const intent = await prisma.paymentIntent.findFirst({
            where: { id: params.paymentIntentId, companyId: params.companyId },
            include: { refunds: true, attempts: true }
        });

        if (!intent) {
            throw new Error("PaymentIntent not found");
        }

        if (intent.status !== PaymentIntentStatus.SUCCEEDED && intent.status !== PaymentIntentStatus.PARTIALLY_REFUNDED) {
            throw new Error(`Cannot refund PaymentIntent in state ${intent.status}. Must be SUCCEEDED or PARTIALLY_REFUNDED.`);
        }

        const previousRefundTotal = intent.refunds
            .filter(r => r.status === RefundStatus.PROCESSED)
            .reduce((sum, r) => sum + r.amountInSubunits, 0n);

        const totalAfterRefund = previousRefundTotal + refundAmount;
        if (totalAfterRefund > intent.amountInSubunits) {
            throw new Error(`Refund amount (${refundAmount}) exceeds maximum refundable amount (${intent.amountInSubunits - previousRefundTotal}).`);
        }

        const successfulAttempt = intent.attempts.find(a => a.status === AttemptStatus.SUCCESS && a.providerTransactionId);
        const paymentId = successfulAttempt?.providerTransactionId || "PAY_mock_" + Date.now();

        const gateway = getPaymentGateway(intent.provider);
        let refundResult;
        try {
            refundResult = await gateway.createRefund({
                providerTransactionId: paymentId,
                amountInSubunits: refundAmount,
                reason: params.reason || "Customer refund",
                notes: { payment_intent_id: intent.id }
            });
        } catch (err: any) {
            console.error("❌ Gateway Refund Error:", err);
            throw new Error(`Refund failed: ${err.message || "Unknown error"}`);
        }

        const result = await prisma.$transaction(async (tx) => {
            const refundRecord = await tx.refund.create({
                data: {
                    companyId: params.companyId,
                    paymentIntentId: intent.id,
                    amountInSubunits: refundAmount,
                    reason: params.reason || "User requested refund",
                    status: RefundStatus.PROCESSED,
                    providerRefundId: refundResult.providerRefundId
                }
            });

            const newIntentStatus = totalAfterRefund >= intent.amountInSubunits 
                ? PaymentIntentStatus.REFUNDED 
                : PaymentIntentStatus.PARTIALLY_REFUNDED;

            const updatedIntent = await tx.paymentIntent.update({
                where: { id: intent.id },
                data: { status: newIntentStatus }
            });

            // Write Outbox Event for refund
            await tx.outboxEvent.create({
                data: {
                    companyId: params.companyId,
                    aggregateType: "PAYMENT_INTENT",
                    aggregateId: intent.id,
                    eventType: newIntentStatus === PaymentIntentStatus.REFUNDED ? "PAYMENT_REFUNDED" : "PAYMENT_PARTIALLY_REFUNDED",
                    payload: {
                        companyId: params.companyId,
                        paymentIntentId: intent.id,
                        orderId: intent.orderId,
                        refundId: refundRecord.id,
                        refundAmount: refundAmount.toString(),
                        newIntentStatus
                    }
                }
            });

            return { refund: refundRecord, paymentIntent: updatedIntent };
        });

        return result;
    }
}

export const paymentEngineService = new PaymentEngineService();
