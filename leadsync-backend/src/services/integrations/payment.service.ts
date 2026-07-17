import Razorpay from "razorpay";
import { prisma } from "../../lib/prisma";
import { getTenantContext } from "../context/tenantContext.provider";

export class PaymentService {
    private razorpay: any;

    constructor() {
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            this.razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        }
    }

    /**
     * Dispatches contextualized checkout payment payloads.
     * Utilizes an explicit, index-backed currencyCode directly from the transactional context.
     */
    public async createPaymentLink(orderId: string, amount: number, contact: string): Promise<string> {
        const context = getTenantContext();
        
        // Explicit, validated database parameter tracking — no more structural symbol guessing
        const resolvedCurrency = (context?.currencyCode || "USD").toUpperCase();

        if (!this.razorpay) {
            return `${process.env.API_BASE_URL}/api/public/mock-payment/${orderId}`;
        }

        const isZeroDecimal = ["JPY", "KRW", "CLP"].includes(resolvedCurrency);
        const amountInSubunits = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);

        const response = await this.razorpay.paymentLink.create({
            amount: amountInSubunits,
            currency: resolvedCurrency,
            customer: { contact },
            callback_url: `${process.env.API_BASE_URL}/api/webhook/razorpay`,
            callback_method: "get"
        });

        return response.short_url;
    }
}

export const paymentService = new PaymentService();
