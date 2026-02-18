import { ChannelAdapter } from "./channel.adapter";
import { prisma } from "../lib/prisma";
import {
    Channel,
    MessageSender,
    ConversationMode,
    OrderSource,
    OrderApprovalStatus,
} from "@prisma/client";
import axios from "axios";
import { emitToCompany, emitToConversation } from "../lib/socket";
import { generateBotReply } from "../services/geminiService";
import { aiQueue } from "../services/queue.service";
import { cacheService } from "../services/cache.service";

/* ===============================
   TYPES
=============================== */
interface TelegramMessage {
    message_id: number;
    chat: { id: number };
    from: { first_name: string };
    text: string;
}

interface StructuredMenu {
    categories: {
        name: string;
        items: { name: string; price: number }[];
    }[];
}

/* ===============================
   HELPER
=============================== */
function normalize(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function buildWelcomeMessage(company: any, name: string) {
    const customWelcome =
        company?.botWelcomeMessage?.trim()?.length > 0
            ? company.botWelcomeMessage
            : `Welcome to ${company?.name || "our store"}! We are happy to assist you.`;

    return `👋 Hello ${name}!\n\n${customWelcome}`;
}

const sendTelegramApi = async (url: string, payload: any) => {
    try {
        await axios.post(url, payload, { timeout: 5000 });
    } catch (error: any) {
        console.error("❌ Telegram API error:", error?.message);
    }
}


/* ===============================
   TELEGRAM ADAPTER
=============================== */
export class TelegramAdapter implements ChannelAdapter {
    constructor(private botToken: string) { }

    async verifyWebhook(req: any): Promise<boolean> {
        // Verification is done in controller via secret_token header usually, 
        // but adapter could validate payload structure.
        return !!(req.body && req.body.message);
    }

    async sendMessage(to: string, text: string, options?: any) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const payload: any = {
            chat_id: to,
            text,
            parse_mode: "HTML",
        };
        await sendTelegramApi(url, payload);
    }

    async sendTyping(to: string) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendChatAction`;
        await sendTelegramApi(url, { chat_id: to, action: "typing" });
    }

    /* -------------------------------
       MAIN PROCESSING LOGIC
    -------------------------------- */
    async processWebhook(body: any, companyId: string) {
        try {
            const message = body.message as TelegramMessage;
            if (!message || !message.message_id) return;

            const chatId = String(message.chat.id);
            const name = message.from?.first_name || "Customer";
            const text = message.text?.trim();

            if (!text) return;

            // 1. Try Cache
            let company: any = cacheService.get(cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma.company.findUnique({ where: { id: companyId } });
                if (company) cacheService.set(cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.telegramBotToken) return;

            // Update token if needed (though adapter instance might be short-lived)
            this.botToken = company.telegramBotToken;

            await this.sendTyping(chatId);

            /* FIND / CREATE LEAD */
            let lead = await prisma.lead.findFirst({
                where: { contact: chatId, channel: Channel.TELEGRAM, companyId },
            });

            if (!lead) {
                lead = await prisma.lead.create({
                    data: { name, contact: chatId, channel: Channel.TELEGRAM, companyId },
                });
                emitToCompany(companyId, "lead_created", lead);
            }

            /* FIND / CREATE CONVERSATION */
            let conversation = await prisma.conversation.findUnique({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: Channel.TELEGRAM,
                    },
                },
            });

            if (!conversation) {
                conversation = await prisma.conversation.create({
                    data: {
                        leadId: lead.id,
                        companyId,
                        channel: Channel.TELEGRAM,
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
                    // Check recently created to dedupe retries
                    createdAt: { gt: new Date(Date.now() - 1000 * 60) }
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

            emitToCompany(companyId, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            emitToConversation(conversation.id, "new_message", clientMsg);

            if (conversation.mode === ConversationMode.HUMAN) return;

            /* COMMAND HANDLING */
            if (text === "/start") {
                await this.sendMessage(chatId, buildWelcomeMessage(company, name));
                return;
            }

            /* MENU LOGIC */
            const structuredMenu = company.botStructuredMenu as StructuredMenu | null;
            const categories = structuredMenu?.categories || [];

            if (text.toLowerCase() === "menu" || text.toLowerCase() === "/menu") {
                if (!categories.length) {
                    await this.sendMessage(chatId, "Menu is currently unavailable.");
                    return;
                }
                let menuMsg = "📜 *Our Menu*\n\n";
                categories.forEach((cat) => {
                    menuMsg += `*${cat.name}*\n`;
                    cat.items.forEach((item) => {
                        menuMsg += `- ${item.name}: ₹${item.price}\n`;
                    });
                    menuMsg += "\n";
                });
                await this.sendMessage(chatId, menuMsg);
                return;
            }

            // Keyword detection ... (Truncated for brevity, focusing on structure. Can add back if requested. 
            // Actually, user wants FULL plan implementation. I should include it.)

            const input = text.toLowerCase();
            const matchedCategory = categories.find(cat =>
                input === cat.name.toLowerCase() ||
                input === cat.name.toLowerCase() + "s" ||
                (input.length > 3 && cat.name.toLowerCase().includes(input))
            );

            if (matchedCategory) {
                let catMsg = `📜 *${matchedCategory.name}*\n\n`;
                matchedCategory.items.forEach(item => {
                    catMsg += `- ${item.name}: ₹${item.price}\n`;
                });

                await this.saveAndSendSystemMessage(chatId, conversation.id, catMsg, companyId);
                return;
            }

            /* AI REPLY */
            // 1. Fetch History (Last 5 messages)
            const history = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            });

            // Reverse history for AI context
            const historyContext = history.reverse().map(m => ({
                role: m.sender === MessageSender.CLIENT ? "user" : "assistant",
                content: m.content
            }));

            // SPEED OPTIMIZATION: Fire typing indicator immediately (fire-and-forget)
            this.sendTyping(chatId).catch(() => { });

            try {
                // Execute AI request with higher concurrency
                const aiReply = await aiQueue.add(() => generateBotReply(
                    text,
                    company.botBusinessType || "general business",
                    structuredMenu,
                    historyContext
                ));

                await this.saveAndSendSystemMessage(chatId, conversation.id, aiReply, companyId);
            } catch (err) {
                console.error("AI Queue Error:", err);
            }

        } catch (err) {
            console.error("Telegram Process Error:", err);
        }
    }

    private async saveAndSendSystemMessage(chatId: string, convId: string, text: string, companyId: string) {
        const botMsg = await prisma.message.create({
            data: {
                content: text,
                sender: MessageSender.SYSTEM,
                conversationId: convId,
            },
        });

        emitToCompany(companyId, "conversation_updated", {
            conversationId: convId,
            lastMessage: text,
            updatedAt: new Date(),
        });
        emitToConversation(convId, "new_message", botMsg);

        await this.sendMessage(chatId, text);
    }
}
