"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const prisma_1 = require("../lib/prisma");
class PaymentService {
    constructor() {
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
            this.razorpay = new razorpay_1.default({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });
        }
    }
    async createPaymentLink(orderId, amount, contact, description) {
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
            await prisma_1.prisma.order.update({
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
        }
        catch (error) {
            console.error("❌ Razorpay Link Creation Error:", error);
            return null;
        }
    }
}
exports.paymentService = new PaymentService();
