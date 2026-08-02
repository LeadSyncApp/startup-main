import Razorpay from "razorpay";
import crypto from "crypto";
import {
    IPaymentGateway,
    CreatePaymentLinkParams,
    PaymentLinkResult,
    CreateRefundParams,
    RefundResult,
    PaymentStatusResult,
    SettledPaymentRecord
} from "./paymentGateway.interface";

export class RazorpayGateway implements IPaymentGateway {
    private razorpay: any = null;

    constructor() {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (keyId && keySecret) {
            this.razorpay = new Razorpay({
                key_id: keyId,
                key_secret: keySecret
            });
        }
    }

    public async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
        const amount = Number(params.amountInSubunits);
        const currency = (params.currency || "INR").toUpperCase();

        if (this.razorpay) {
            const response = await this.razorpay.paymentLink.create({
                amount,
                currency,
                customer: params.customerContact ? { contact: params.customerContact } : undefined,
                callback_url: params.callbackUrl || `${process.env.API_BASE_URL}/api/public/payment-success`,
                callback_method: "get",
                notes: params.notes || {}
            });

            return {
                providerPaymentLinkId: response.id,
                shortUrl: response.short_url
            };
        }

        // Mock fallback for local dev/testing without active API keys
        const mockId = "plink_mock_" + Date.now();
        const orderId = params.notes?.order_id || params.notes?.payment_intent_id || "mock";
        return {
            providerPaymentLinkId: mockId,
            shortUrl: `${process.env.API_BASE_URL || "http://localhost:4000"}/api/public/mock-payment/${orderId}`
        };
    }

    public verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
        if (!rawBody || !signature || !secret) {
            return false;
        }

        const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBodyString)
            .digest("hex");

        const signatureBuf = Buffer.from(signature, "utf8");
        const expectedBuf = Buffer.from(expectedSignature, "utf8");

        if (signatureBuf.length !== expectedBuf.length) {
            return false;
        }

        return crypto.timingSafeEqual(signatureBuf, expectedBuf);
    }

    public async createRefund(params: CreateRefundParams): Promise<RefundResult> {
        const amount = Number(params.amountInSubunits);

        if (this.razorpay && params.providerTransactionId && !params.providerTransactionId.startsWith("PAY_mock_")) {
            const razorpayRefund = await this.razorpay.payments.refund(params.providerTransactionId, {
                amount,
                notes: params.notes || {}
            });
            return {
                providerRefundId: razorpayRefund.id,
                status: razorpayRefund.status || "processed",
                rawPayload: razorpayRefund
            };
        }

        return {
            providerRefundId: "rfnd_mock_" + Date.now(),
            status: "processed",
            rawPayload: { mock: true, amount, reason: params.reason }
        };
    }

    public async getPaymentStatus(providerTransactionId: string): Promise<PaymentStatusResult> {
        if (this.razorpay && providerTransactionId && !providerTransactionId.startsWith("PAY_mock_")) {
            const payment = await this.razorpay.payments.fetch(providerTransactionId);
            return {
                id: payment.id,
                amountInSubunits: BigInt(payment.amount),
                currency: payment.currency,
                status: payment.status,
                method: payment.method,
                email: payment.email,
                contact: payment.contact,
                createdAt: new Date(payment.created_at * 1000),
                rawPayload: payment
            };
        }

        return {
            id: providerTransactionId,
            amountInSubunits: 1000n,
            currency: "INR",
            status: "captured",
            method: "upi",
            createdAt: new Date(),
            rawPayload: { mock: true }
        };
    }

    public async fetchSettledPayments(startDate: Date, endDate: Date): Promise<SettledPaymentRecord[]> {
        const fromUnix = Math.floor(startDate.getTime() / 1000);
        const toUnix = Math.floor(endDate.getTime() / 1000);

        if (this.razorpay) {
            try {
                const response = await this.razorpay.payments.all({
                    from: fromUnix,
                    to: toUnix,
                    count: 100
                });

                const items = response.items || [];
                return items.map((p: any) => ({
                    providerTransactionId: p.id,
                    providerPaymentLinkId: p.order_id || p.notes?.payment_link_id,
                    amountInSubunits: BigInt(p.amount),
                    currency: p.currency,
                    status: p.status,
                    createdAt: new Date(p.created_at * 1000),
                    orderId: p.notes?.order_id,
                    paymentIntentId: p.notes?.payment_intent_id,
                    rawPayload: p
                }));
            } catch (err: any) {
                console.error("⚠️ Razorpay fetchSettledPayments error:", err?.message || err);
                return [];
            }
        }

        return [];
    }
}
