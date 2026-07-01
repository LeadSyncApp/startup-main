import { prisma } from "../../lib/prisma";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { Channel, MessageSender } from "@prisma/client";
import { emitToConversation } from "../../lib/socket";
import axios from "axios";
import { decryptSecret } from "../../utils/encryption";

export class CustomerMessagingService {

    /**
     * Sends an automated status update to the customer via their preferred channel.
     */
    async sendStatusUpdate(order: any) {
        const { lead, companyId, status, conversationId } = order;

        if (!lead || !lead.contact) return;

        // Fetch company prefix and custom templates
        let companyName = "our store";
        let company: any = null;
        let templates: Record<string, string> = {};

        try {
            company = await prisma.company.findUnique({ where: { id: companyId } });
            if (company?.name) {
                companyName = company.name;
            }
            templates = (company?.botConfiguration as any)?.templates || {};
        } catch (e) {
            console.error("Failed to read company details", e);
        }

        // 1. Construct Message
        const message = this.getStatusMessageWithDetails(status, {
            customerName: lead.name || "Customer",
            orderId: order.id.slice(0, 8),
            brandName: companyName,
            companyId: companyId
        }, templates[status]);

        if (!message) return; // No message for this status

        // 2. Send via Channel
        try {

            if (lead.channel === Channel.TELEGRAM) {
                if (company?.telegramBotToken) {
                    await sendTelegramMessage(decryptSecret(company.telegramBotToken)!, lead.contact, message);
                }
            }
            else if (lead.channel === (Channel as any).INSTAGRAM) {
                const igCompany = company as any;
                if (igCompany?.instagramPageAccessToken) {
                    const GRAPH_URL = "https://graph.facebook.com/v17.0";
                    await axios.post(`${GRAPH_URL}/me/messages?access_token=${decryptSecret(igCompany.instagramPageAccessToken)!}`, {
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

    public getStatusMessageWithDetails(
        status: string, 
        context: { customerName: string; orderId: string; brandName: string; companyId: string }, 
        customTemplate?: string
    ): string {
        if (customTemplate) {
            return customTemplate
                .replace(/{name}/g, context.customerName)
                .replace(/{orderId}/g, context.orderId)
                .replace(/{brand}/g, context.brandName);
        }

        // Fail-fast architecture: Throw a clear configuration error instead of guessing the brand's voice
        throw new Error(`TenantConfigurationException: No localized message template defined for status "${status}" under company ${context.companyId}.`);
    }
}

export const customerMessagingService = new CustomerMessagingService();

import { getTenantContext } from "../context/tenantContext.provider";

/**
 * Universal Dynamic Template Registry Router.
 * Completely decoupled from specific dialect names or hardcoded regional definitions.
 */
export async function fetchAutomatedNotificationTemplate(templateIdentifier: string, targetLocale: string): Promise<string> {
  const context = getTenantContext();

  const activeTemplate = await prisma.notificationTemplate.findFirst({
    where: {
      companyId: context.companyId,
      keyIdentifier: templateIdentifier,
      localeCode: targetLocale // E.g., "en-US", "hi-IN", "ar-AE"
    }
  });

  if (!activeTemplate) {
    throw new Error(`TemplateConfigurationException: Operational template [${templateIdentifier}] missing for locale [${targetLocale}] under tenant ${context.companyId}.`);
  }

  return activeTemplate.templateBodyString;
}
