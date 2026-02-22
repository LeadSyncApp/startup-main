"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerMessagingService = exports.CustomerMessagingService = void 0;
const prisma_1 = require("../lib/prisma");
const telegram_sender_1 = require("../bot/telegram.sender");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const axios_1 = __importDefault(require("axios"));
class CustomerMessagingService {
    /**
     * Sends an automated status update to the customer via their preferred channel.
     */
    async sendStatusUpdate(order) {
        const { lead, companyId, status, conversationId } = order;
        if (!lead || !lead.contact)
            return;
        // 1. Construct Message
        const message = this.getStatusMessage(status, order.id, lead.name);
        if (!message)
            return; // No message for this status
        // 2. Send via Channel
        try {
            const company = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
            if (lead.channel === client_1.Channel.TELEGRAM) {
                if (company?.telegramBotToken) {
                    await (0, telegram_sender_1.sendTelegramMessage)(company.telegramBotToken, lead.contact, message);
                }
            }
            else if (lead.channel === client_1.Channel.INSTAGRAM) {
                const igCompany = company;
                if (igCompany?.instagramPageAccessToken) {
                    const GRAPH_URL = "https://graph.facebook.com/v17.0";
                    await axios_1.default.post(`${GRAPH_URL}/me/messages?access_token=${igCompany.instagramPageAccessToken}`, {
                        recipient: { id: lead.contact },
                        message: { text: message },
                        // 🔒 COMPLIANCE: Use Message Tags for delivery outside 24h window
                        messaging_type: "MESSAGE_TAG",
                        tag: "POST_PURCHASE_UPDATE"
                    });
                }
            }
            // 3. Log to Conversation (Database)
            const savedMsg = await prisma_1.prisma.message.create({
                data: {
                    content: message,
                    sender: client_1.MessageSender.SYSTEM,
                    conversationId: conversationId
                }
            });
            // 4. Emit to Agent UI (Real-time)
            (0, socket_1.emitToConversation)(conversationId, "new_message", savedMsg);
        }
        catch (error) {
            console.error(`Failed to send status update to ${lead.contact}:`, error);
        }
    }
    getStatusMessage(status, orderId, customerName) {
        const name = customerName || "Customer";
        const shortId = orderId.slice(0, 8);
        switch (status) {
            case "PROCESSING":
                return `Hi ${name}, your order #${shortId} has been accepted and is now being processed! 🚀`;
            case "PREPARING":
                return `Hi ${name}, your order #${shortId} is now being prepared! 👨‍🍳`;
            case "READY":
                return `Hi ${name}, your order #${shortId} is ready! 🎁`;
            case "SHIPPED":
                return `Great news ${name}! Your order #${shortId} is out for delivery. 🚚`;
            case "DELIVERED":
                return `Your order #${shortId} has been delivered. Enjoy! 🎉`;
            case "CANCELLED":
                return `Hi ${name}, your order #${shortId} has been cancelled. Please contact support if this is a mistake.`;
            default:
                return null;
        }
    }
}
exports.CustomerMessagingService = CustomerMessagingService;
exports.customerMessagingService = new CustomerMessagingService();
