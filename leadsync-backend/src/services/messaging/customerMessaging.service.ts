import { prisma } from "../../lib/prisma";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { Channel, MessageSender } from "@prisma/client";
import { emitToConversation } from "../../lib/socket";
import axios from "axios";

export class CustomerMessagingService {

    /**
     * Sends an automated status update to the customer via their preferred channel.
     */
    async sendStatusUpdate(order: any) {
        const { lead, companyId, status, conversationId } = order;

        if (!lead || !lead.contact) return;

        // Fetch company prefix
        let companyName = "our store";
        try {
            const company = await prisma.company.findUnique({ where: { id: companyId } });
            if (company?.name) {
                companyName = company.name;
            }
        } catch (e) {
            console.error("Failed to read company details", e);
        }

        // 1. Construct Message
        const message = this.getStatusMessageWithDetails(status, order, lead.name, companyName);
        if (!message) return; // No message for this status

        // 2. Send via Channel
        try {
            const company = await prisma.company.findUnique({ where: { id: companyId } });

            if (lead.channel === Channel.TELEGRAM) {
                if (company?.telegramBotToken) {
                    await sendTelegramMessage(company.telegramBotToken, lead.contact, message);
                }
            }
            else if (lead.channel === (Channel as any).INSTAGRAM) {
                const igCompany = company as any;
                if (igCompany?.instagramPageAccessToken) {
                    const GRAPH_URL = "https://graph.facebook.com/v17.0";
                    await axios.post(`${GRAPH_URL}/me/messages?access_token=${igCompany.instagramPageAccessToken}`, {
                        recipient: { id: lead.contact },
                        message: { text: message },
                        // 🔒 COMPLIANCE: Use Message Tags for delivery outside 24h window
                        messaging_type: "MESSAGE_TAG",
                        tag: "POST_PURCHASE_UPDATE"
                    });
                }
            }

            // 3. Log to Conversation (Database)
            const savedMsg = await prisma.message.create({
                data: {
                    content: message,
                    sender: MessageSender.SYSTEM,
                    conversationId: conversationId
                }
            });

            // 4. Emit to Agent UI (Real-time)
            emitToConversation(conversationId, "new_message", savedMsg);

        } catch (error) {
            console.error(`Failed to send status update to ${lead.contact}:`, error);
        }
    }

    private getStatusMessageWithDetails(status: string, order: any, customerName: string | null, companyName: string): string | null {
        const name = customerName || "Customer";
        const shortId = order.id.slice(0, 8);

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
            case "COMPLETED":
                return `Thank you for choosing ${companyName}! ❤️\n\n` +
                       `Here is the summary of your order (Order #${shortId}):\n` +
                       `----------------------------------\n` +
                       `Items:\n${order.summary}\n\n` +
                       `Total Amount: ₹${(order.amount ?? 0).toLocaleString("en-IN")}\n` +
                       `----------------------------------\n\n` +
                       `We look forward to serving you again! Have a wonderful day! ✨`;
            case "CANCELLED":
                return `Hi ${name}, your order #${shortId} has been cancelled. Please contact support if this is a mistake.`;
            default:
                return null;
        }
    }
}

export const customerMessagingService = new CustomerMessagingService();
