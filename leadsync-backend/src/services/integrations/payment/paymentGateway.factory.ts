import { IPaymentGateway } from "./paymentGateway.interface";
import { RazorpayGateway } from "./razorpayGateway";

class PaymentGatewayFactory {
    private static instance: PaymentGatewayFactory;
    private gateways: Map<string, IPaymentGateway> = new Map();
    private overrideGateway: IPaymentGateway | null = null;

    private constructor() {
        this.gateways.set("razorpay", new RazorpayGateway());
    }

    public static getInstance(): PaymentGatewayFactory {
        if (!PaymentGatewayFactory.instance) {
            PaymentGatewayFactory.instance = new PaymentGatewayFactory();
        }
        return PaymentGatewayFactory.instance;
    }

    public getGateway(provider: string = "razorpay"): IPaymentGateway {
        if (this.overrideGateway) {
            return this.overrideGateway;
        }

        const gateway = this.gateways.get(provider.toLowerCase());
        if (!gateway) {
            // Default to Razorpay if unknown provider
            return this.gateways.get("razorpay")!;
        }

        return gateway;
    }

    public setOverrideGateway(gateway: IPaymentGateway | null) {
        this.overrideGateway = gateway;
    }
}

export const paymentGatewayFactory = PaymentGatewayFactory.getInstance();
export const getPaymentGateway = (provider?: string) => paymentGatewayFactory.getGateway(provider);
