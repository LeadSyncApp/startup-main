export interface CreatePaymentLinkParams {
    amountInSubunits: bigint | number;
    currency: string;
    customerContact?: string;
    callbackUrl?: string;
    notes?: Record<string, string>;
}

export interface PaymentLinkResult {
    providerPaymentLinkId: string;
    shortUrl: string;
}

export interface CreateRefundParams {
    providerTransactionId: string;
    amountInSubunits: bigint | number;
    reason?: string;
    notes?: Record<string, string>;
}

export interface RefundResult {
    providerRefundId: string;
    status: string;
    rawPayload?: any;
}

export interface PaymentStatusResult {
    id: string;
    amountInSubunits: bigint;
    currency: string;
    status: string;
    method?: string;
    email?: string;
    contact?: string;
    createdAt?: Date;
    rawPayload?: any;
}

export interface SettledPaymentRecord {
    providerTransactionId: string;
    providerPaymentLinkId?: string;
    amountInSubunits: bigint;
    currency: string;
    status: string;
    createdAt: Date;
    orderId?: string;
    paymentIntentId?: string;
    companyId?: string;
    rawPayload?: any;
}

export interface IPaymentGateway {
    createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
    verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean;
    createRefund(params: CreateRefundParams): Promise<RefundResult>;
    getPaymentStatus(providerTransactionId: string): Promise<PaymentStatusResult>;
    fetchSettledPayments(startDate: Date, endDate: Date): Promise<SettledPaymentRecord[]>;
}
