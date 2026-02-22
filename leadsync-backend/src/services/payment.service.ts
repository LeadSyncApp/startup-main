import Razorpay from "razorpay";
import { prisma } from "../lib/prisma";

class PaymentService {
    private razorpay: any;

    constructor() {
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            this.razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        }
    }

    async createPaymentLink(orderId: string, amount: number, contact: string, description: string) {
        if (!this.razorpay) {
            console.warn("⚠️ Razorpay not configured. Skipping payment link generation.");
            return null;
        }

        try {
            // Amount in paise for Razorpay
            const amountInPaise = Math.round(amount * 100);

            const response = await this.razorpay.paymentLink.create({
                amount: amountInPaise,
                currency: "INR",
                accept_partial: false,
                description: `Order #${orderId.slice(0, 8)} - ${description}`,
                customer: {
                    contact: contact,
                },
                notify: {
                    sms: true,
                    email: false
                },
                reminder_enable: true,
                notes: {
                    order_id: orderId
                },
                callback_url: `${process.env.API_BASE_URL}/api/webhook/razorpay`,
                callback_method: "get"
            });

            // Update order with payment link ID
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    // You might want to store this in a specific field or metadata
                    logs: {
                        create: {
                            actorName: "System",
                            actorRole: "BOT",
                            action: "PAYMENT_LINK_CREATED",
                            metadata: { paymentLinkId: response.id, shortUrl: response.short_url }
                        }
                    }
                }
            });

            return response.short_url;
        } catch (error) {
            console.error("❌ Razorpay Link Creation Error:", error);
            return null;
        }
    }
}

export const paymentService = new PaymentService();
