import { getTenantContext } from "../context/tenantContext.provider";
import { getPaymentGateway } from "./payment/paymentGateway.factory";

export class PaymentService {
    /**
     * Dispatches contextualized checkout payment payloads via IPaymentGateway.
     */
    public async createPaymentLink(orderId: string, amount: number, contact: string): Promise<string> {
        const context = getTenantContext();
        const resolvedCurrency = (context?.currencyCode || "USD").toUpperCase();

        const isZeroDecimal = ["JPY", "KRW", "CLP"].includes(resolvedCurrency);
        const amountInSubunits = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);

        const gateway = getPaymentGateway();
        const result = await gateway.createPaymentLink({
            amountInSubunits,
            currency: resolvedCurrency,
            customerContact: contact,
            callbackUrl: `${process.env.API_BASE_URL}/api/public/payment-success`,
            notes: { order_id: orderId }
        });

        return result.shortUrl;
    }
}

export const paymentService = new PaymentService();
