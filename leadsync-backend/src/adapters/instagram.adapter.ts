import { ChannelAdapter } from "./channel.adapter";
import { prisma } from "../lib/prisma";
import {
    Channel,
    MessageSender,
    ConversationMode,
} from "@prisma/client";
import axios from "axios";
import { emitToCompany, emitToConversation, safeEmitConversationUpdate } from "../lib/socket";
import { generateBotReply } from "../services/ai.service";
import { aiQueue } from "../services/queue.service";
import { cacheService } from "../services/cache.service";
import { intelligenceService } from "../services/intelligence.service";
import { orderParserService } from "../services/orderParser.service";
import { notificationService } from "../services/notification.service";

/* ===============================
   TYPES
 =============================== */
interface IGWebhookEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text: string;
    };
}

/* ===============================
   INSTAGRAM ADAPTER
 =============================== */
export class InstagramAdapter implements ChannelAdapter {
    private readonly GRAPH_URL = "https://graph.facebook.com/v17.0";

    constructor(private pageAccessToken: string) { }

    async verifyWebhook(req: any): Promise<boolean> {
        // Facebook verification is handled in the GET /webhook route
        return true;
    }

    async sendMessage(to: string, text: string, options?: any) {
        if (!this.pageAccessToken) return;

        try {
            await axios.post(`${this.GRAPH_URL}/me/messages?access_token=${this.pageAccessToken}`, {
                recipient: { id: to },
                message: { text }
            });
        } catch (error: any) {
            console.error("❌ Instagram API error:", error?.response?.data || error.message);
        }
    }

    async sendTyping(to: string) {
        if (!this.pageAccessToken) return;
        try {
            await axios.post(`${this.GRAPH_URL}/me/messages?access_token=${this.pageAccessToken}`, {
                recipient: { id: to },
                sender_action: "typing_on"
            });
        } catch (e) { }
    }

    /**
     * Entry Point from Instagram Webhook
     */
    async processWebhook(event: IGWebhookEvent, companyId: string) {
        try {
            const psid = event.sender.id;
            const text = event.message?.text?.trim();

            if (!text) return;

            // 1. Fetch Company
            let company: any = cacheService.get(cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma.company.findUnique({ where: { id: companyId } });
                if (company) cacheService.set(cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !(company as any).instagramPageAccessToken) return;

            this.pageAccessToken = (company as any).instagramPageAccessToken;

            this.sendTyping(psid).catch(() => { });

            /* FIND / CREATE LEAD */
            let lead = await prisma.lead.findFirst({
                where: { contact: psid, channel: (Channel as any).INSTAGRAM, companyId },
            });

            if (!lead) {
                // For Instagram, we might need a separate call to FB Graph API to get the user's name
                // For now, defaulting to "Instagram User"
                lead = await prisma.lead.create({
                    data: { name: "Instagram User", contact: psid, channel: (Channel as any).INSTAGRAM, companyId },
                });
                emitToCompany(companyId, "lead_created", lead);
            }

            /* FIND / CREATE CONVERSATION */
            let conversation = await prisma.conversation.findUnique({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: (Channel as any).INSTAGRAM,
                    },
                },
            });

            if (!conversation) {
                conversation = await prisma.conversation.create({
                    data: {
                        leadId: lead.id,
                        companyId,
                        channel: (Channel as any).INSTAGRAM,
                        mode: ConversationMode.BOT,
                    },
                });
            }

            /* DEDUPLICATE */
            const existingMessage = await prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: text,
                    sender: MessageSender.CLIENT,
                    createdAt: { gt: new Date(Date.now() - 1000 * 10) } // 10s dedupe
                },
            });
            if (existingMessage) return;

            /* SAVE CLIENT MESSAGE */
            const clientMsg = await prisma.message.create({
                data: {
                    content: text,
                    sender: MessageSender.CLIENT,
                    conversationId: conversation.id,
                },
            });

            safeEmitConversationUpdate(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            emitToConversation(conversation.id, "new_message", clientMsg);

            // 🧠 INTELLIGENCE
            intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch(() => { });

            // 🔔 NOTIFICATION
            const notifyBody = `IG: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            } else {
                notificationService.notifyCompanyAdmins(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }

            // 🍔 ORDER DETECTION
            orderParserService.processPotentialOrder(
                companyId,
                conversation.id,
                lead.id,
                text,
                company.botStructuredMenu
            ).catch(() => { });

            if (conversation.mode === ConversationMode.HUMAN) return;

            /* AI REPLY */
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            });

            const historyContext = history.reverse().map(m => ({
                role: m.sender === MessageSender.CLIENT ? "user" : "assistant",
                content: m.content
            }));

            try {
                const aiReply = await aiQueue.add(() => generateBotReply(
                    text,
                    company.name,
                    company.botBusinessType || "general business",
                    company.botStructuredMenu,
                    historyContext
                ));

                // 🚨 PARSE RESPONSE (TEXT_REPLY: / VOICE_TTS:)
                let displayMessage = aiReply;

                if (aiReply.includes("TEXT_REPLY:")) {
                    const lines = aiReply.split("\n");
                    const textLine = lines.find(l => l.startsWith("TEXT_REPLY:"));
                    if (textLine) {
                        displayMessage = textLine.replace("TEXT_REPLY:", "").trim();
                    }
                } else if (aiReply.trim().startsWith('{')) {
                    // Legacy JSON fallback
                    try {
                        const parsed = JSON.parse(aiReply);
                        displayMessage = parsed.message_to_customer || parsed.response_text || aiReply;
                    } catch (e) { }
                }

                // Final mode check
                const freshConv = await prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    select: { mode: true }
                });

                if (freshConv?.mode === "HUMAN") return;

                await this.saveAndSendMessage(psid, conversation, displayMessage);
            } catch (err) {
                console.error("AI Error (IG):", err);
            }

        } catch (err) {
            console.error("Instagram Process Error:", err);
        }
    }

    private async saveAndSendMessage(psid: string, conversation: any, text: string) {
        const botMsgPromise = prisma.message.create({
            data: {
                content: text,
                sender: MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        }).then(botMsg => {
            safeEmitConversationUpdate(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            emitToConversation(conversation.id, "new_message", botMsg);
        });

        const igPromise = this.sendMessage(psid, text);
        await Promise.all([botMsgPromise, igPromise]);
    }
}
