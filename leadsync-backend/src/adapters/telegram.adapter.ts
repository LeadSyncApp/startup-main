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
import { emitToCompany, emitToConversation, safeEmitConversationUpdate } from "../lib/socket";
import { generateBotReply } from "../services/geminiService";
import { aiQueue } from "../services/queue.service";
import { cacheService } from "../services/cache.service";
import { intelligenceService } from "../services/intelligence.service";
import { orderParserService } from "../services/orderParser.service";
import { notificationService } from "../services/notification.service";

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

            this.sendTyping(chatId).catch(() => { });

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

            safeEmitConversationUpdate(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            emitToConversation(conversation.id, "new_message", clientMsg);

            // 🧠 INTELLIGENCE: Analyze message in background (Fire-and-forget)
            // This updates Sentiment, Intent, and LastActiveAt without blocking the bot reply.
            intelligenceService.analyzeMessage(
                companyId,
                lead.id,
                conversation.id,
                text
            ).catch((err: any) => console.error("Intelligence Error:", err));

            // 🔔 NOTIFICATION: Notify Assigned Agent & Admins
            const notifyBody = `${name}: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            } else {
                notificationService.notifyCompanyAdmins(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }

            // 🍔 ORDER DETECTION: Check for orders in background
            orderParserService.processPotentialOrder(
                companyId,
                conversation.id,
                lead.id,
                text,
                company.botStructuredMenu
            ).catch((err: any) => console.error("OrderParser Error:", err));

            if (conversation.mode === ConversationMode.HUMAN) return;

            /* COMMAND HANDLING */
            if (text === "/start") {
                await this.saveAndSendSystemMessage(chatId, conversation, buildWelcomeMessage(company, name));
                return;
            }

            /* MENU LOGIC */
            /* DYNAMIC TERMINOLOGY (Industry Aware) */
            const businessType = (company.botBusinessType || "business").toLowerCase();

            // Regex Matchers
            const isFood = businessType.match(/(restaurant|food|cafe|bakery|kitchen|dining|bistro|grill|pizza|burger)/);
            const isRetail = businessType.match(/(retail|clothing|fashion|boutique|wear|store|shop|mart|apparel)/);
            const isElectronics = businessType.match(/(electronics|mobile|tech|gadgets|computer|laptop|devices)/);
            const isService = businessType.match(/(service|consulting|agency|salon|spa|repair|gym|fitness)/);

            let catalogTerm = "Catalog";
            if (isFood) catalogTerm = "Menu";
            else if (isRetail) catalogTerm = "Collection";
            else if (isElectronics) catalogTerm = "Inventory";
            else if (isService) catalogTerm = "Services";

            const structuredMenu = company.botStructuredMenu as StructuredMenu | null;
            const categories = structuredMenu?.categories || [];

            const input = text.toLowerCase();
            const isMenuRequest =
                input === "menu" ||
                input === "/menu" ||
                input.includes("menu") ||
                input.includes("catalog") ||
                input.includes("products") ||
                input.includes("services") ||
                input.includes("collection") || // Retail
                input.includes("inventory") || // Electronics
                (input.includes("orders") && (input.includes("have") || input.includes("list") || input.includes("show") || input.includes("what"))) ||
                input.includes("options") ||
                input.includes("available");

            if (isMenuRequest) {
                if (!categories.length) {
                    await this.saveAndSendSystemMessage(chatId, conversation, `⚠️ Our ${catalogTerm} is currently empty.`);
                    return;
                }

                let menuMsg = `📜 *Our ${catalogTerm}*\n\n`;

                categories.forEach((cat) => {
                    menuMsg += `*${cat.name.toUpperCase()}*\n`;
                    cat.items.forEach((item: any) => {
                        const price = item.price ? `₹${item.price}` : "Contact for Price";
                        menuMsg += `- ${item.name}: ${price}\n`;
                        if (item.description && item.description.length < 50) {
                            menuMsg += `  _${item.description}_\n`;
                        }
                    });
                    menuMsg += "\n";
                });

                await this.saveAndSendSystemMessage(chatId, conversation, menuMsg);
                return;
            }

            // Keyword detection ... (Truncated for brevity, focusing on structure. Can add back if requested. 
            // Actually, user wants FULL plan implementation. I should include it.)

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

                await this.saveAndSendSystemMessage(chatId, conversation, catMsg);
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
                let aiReply = await aiQueue.add(() => generateBotReply(
                    text,
                    company.name,
                    company.botBusinessType || "general business",
                    structuredMenu,
                    historyContext
                ));

                // 🚨 JSON HANDLING: If AI returned a structured order JSON, extract the display message
                let displayMessage = aiReply;
                try {
                    // Check if it looks like JSON before parsing to save resources
                    if (aiReply.trim().startsWith('{')) {
                        const parsed = JSON.parse(aiReply);
                        if (parsed.message_to_customer) {
                            displayMessage = parsed.message_to_customer;
                        }
                    }
                } catch (e) {
                    // Fallback to raw string if parsing fails
                }

                // 🚨 CONCURRENCY FIX: Re-fetch conversation mode before sending!
                const freshConv = await prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    select: { mode: true }
                });

                if (freshConv?.mode === "HUMAN") {
                    console.log(`⚠️ Skiping AI reply for ${chatId} - Mode switched to HUMAN during generation.`);
                    return;
                }

                await this.saveAndSendSystemMessage(chatId, conversation, displayMessage);
            } catch (err) {
                console.error("AI Queue Error:", err);
            }

        } catch (err) {
            console.error("Telegram Process Error:", err);
        }
    }

    private async saveAndSendSystemMessage(chatId: string, conversation: any, text: string) {
        // OPTIMIZATION: Run DB save and Telegram Send in Parallel
        const dbPromise = (async () => {
            const botMsg = await prisma.message.create({
                data: {
                    content: text,
                    sender: MessageSender.SYSTEM,
                    conversationId: conversation.id,
                },
            });

            safeEmitConversationUpdate(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            emitToConversation(conversation.id, "new_message", botMsg);
        })();

        const telegramPromise = this.sendMessage(chatId, text);

        // Await both to ensure completion, but they run concurrently
        await Promise.all([dbPromise, telegramPromise]);
    }
}
