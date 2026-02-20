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
import { sarvamService } from "../services/sarvam.service";

/* ===============================
   TYPES
=============================== */
interface TelegramMessage {
    message_id: number;
    chat: { id: number };
    from: { first_name: string };
    text?: string;
    voice?: {
        file_id: string;
        duration: number;
        mime_type: string;
    };
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


/** Download a Telegram voice file into a Buffer */
async function downloadTelegramVoice(botToken: string, fileId: string): Promise<Buffer | null> {
    try {
        const fileRes = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const filePath = fileRes.data?.result?.file_path;
        if (!filePath) return null;

        const audioRes = await axios.get(
            `https://api.telegram.org/file/bot${botToken}/${filePath}`,
            { responseType: "arraybuffer", timeout: 15000 }
        );
        return Buffer.from(audioRes.data);
    } catch (err: any) {
        console.error("❌ Voice download error:", err.message);
        return null;
    }
}


/* ===============================
   TELEGRAM ADAPTER
=============================== */
export class TelegramAdapter implements ChannelAdapter {
    constructor(private botToken: string) { }

    async verifyWebhook(req: any): Promise<boolean> {
        return !!(req.body && (req.body.message || req.body.callback_query));
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

    /** Send message with inline Voice/Text reply choice buttons */
    async sendMessageWithVoiceButtons(to: string, text: string) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await sendTelegramApi(url, {
            chat_id: to,
            text,
            reply_markup: {
                inline_keyboard: [[
                    { text: "🔊 Voice Reply", callback_data: `voice_reply:${to}` },
                    { text: "💬 Text Reply", callback_data: `text_reply:${to}` },
                ]]
            }
        });
    }

    /** Dismiss Telegram button loading spinner */
    async answerCallbackQuery(callbackQueryId: string) {
        await sendTelegramApi(
            `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`,
            { callback_query_id: callbackQueryId }
        );
    }

    /** Handle button press from inline keyboard */
    async handleCallbackQuery(callbackQuery: any) {
        const chatId = String(callbackQuery.message?.chat?.id);
        const data = callbackQuery.data as string;
        const queryId = callbackQuery.id;

        await this.answerCallbackQuery(queryId); // dismiss spinner immediately

        if (data.startsWith("voice_reply:")) {
            // Fast path: use pre-cached audio
            const cachedAudio = cacheService.get<Buffer>(cacheService.getPendingVoiceKey(chatId));
            if (cachedAudio) {
                await this.sendVoice(chatId, cachedAudio);
                return;
            }

            // Slow path: cache expired — regenerate TTS from last bot message in DB
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" },
                    include: { messages: { where: { sender: MessageSender.SYSTEM }, orderBy: { createdAt: "desc" }, take: 1 } }
                });
                const lastText = conversation?.messages?.[0]?.content;
                if (lastText) {
                    await this.sendTyping(chatId);
                    const audio = await sarvamService.textToSpeech(lastText, "en-IN");
                    if (audio) await this.sendVoice(chatId, audio);
                }
            } catch (err) {
                console.error("❌ Voice reply regeneration failed:", err);
            }

        } else if (data.startsWith("text_reply:")) {
            // Fast path: use cached text
            const pendingText = cacheService.get<string>(cacheService.getPendingTextKey(chatId));
            if (pendingText) {
                await this.sendMessage(chatId, pendingText);
                return;
            }

            // Slow path: fallback to DB
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" },
                    include: { messages: { where: { sender: MessageSender.SYSTEM }, orderBy: { createdAt: "desc" }, take: 1 } }
                });
                const lastText = conversation?.messages?.[0]?.content;
                if (lastText) {
                    await this.sendMessage(chatId, lastText);
                }
            } catch (err) {
                console.error("❌ Text reply fallback failed:", err);
            }
        }
    }

    /** Send a pre-generated voice audio buffer as a Telegram voice message */
    async sendVoice(to: string, audioBuffer: Buffer) {
        try {
            const FormData = require("form-data");
            const form = new FormData();
            form.append("chat_id", to);
            form.append("voice", audioBuffer, {
                filename: "reply.ogg",
                contentType: "audio/ogg",
            });
            await axios.post(
                `https://api.telegram.org/bot${this.botToken}/sendVoice`,
                form,
                { headers: form.getHeaders(), timeout: 15000 }
            );
            console.log(`🔊 Voice message sent to ${to}`);
        } catch (err: any) {
            console.error("❌ sendVoice error:", err.message);
        }
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
            // 🔘 ROUTE: Handle inline button presses (callback queries)
            if (body.callback_query) {
                await this.handleCallbackQuery(body.callback_query);
                return;
            }

            const message = body.message as TelegramMessage;
            if (!message || !message.message_id) return;

            const chatId = String(message.chat.id);
            const name = message.from?.first_name || "Customer";
            let text = message.text?.trim() || "";
            const isVoiceMsg = !!message.voice;

            // 🎙️ VOICE INPUT: Download and transcribe if voice message
            if (isVoiceMsg && message.voice) {
                const { file_id, duration, mime_type } = message.voice;
                console.log(`🎙️ Voice received: file_id=${file_id}, duration=${duration}s, mime=${mime_type}`);

                const audioBuffer = await downloadTelegramVoice(this.botToken, file_id);
                if (audioBuffer) {
                    console.log(`✅ Voice downloaded: ${audioBuffer.length} bytes`);
                    const transcript = await sarvamService.speechToText(audioBuffer, "voice.ogg");
                    if (transcript) {
                        text = transcript;
                        console.log(`✅ Voice transcribed for ${chatId}: "${text}"`);
                    } else {
                        await this.sendMessage(chatId, "Sorry, I had trouble hearing that. Could you send the voice message again or type your message?");
                        return;
                    }
                } else {
                    await this.sendMessage(chatId, "The voice message couldn't be received. Please try again in a moment.");
                    return;
                }
            }

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
                    messageType: isVoiceMsg ? "VOICE" : "TEXT",
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

            // Fire typing indicator
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

                // 🔊 JSON HANDLING: Extract message_to_customer if AI returned structured JSON
                let displayMessage = aiReply;
                try {
                    if (aiReply.trim().startsWith('{')) {
                        const parsed = JSON.parse(aiReply);
                        if (parsed.message_to_customer) displayMessage = parsed.message_to_customer;
                    }
                } catch (e) { /* fallback to raw string */ }

                // 🔊 CONCURRENCY CHECK: Skip if agent took over
                const freshConv = await prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    select: { mode: true }
                });
                if (freshConv?.mode === "HUMAN") {
                    console.log(`⚠️ AI reply skipped for ${chatId} - HUMAN mode active.`);
                    return;
                }

                // 🎤 PRE-GENERATE VOICE IN PARALLEL (Fire-and-forget, cache for 2 min)
                sarvamService.textToSpeech(displayMessage, "en-IN")
                    .then(audioBuffer => {
                        if (audioBuffer) {
                            cacheService.set(cacheService.getPendingVoiceKey(chatId), audioBuffer, 120);
                            console.log(`🔊 Voice pre-cached for ${chatId}`);
                        }
                    })
                    .catch(err => console.error("TTS pre-gen error:", err));

                // 🔘 If triggered by voice input, hide text behind buttons. Otherwise send clean text.
                if (isVoiceMsg) {
                    // Cache the text for the callback button
                    cacheService.set(cacheService.getPendingTextKey(chatId), displayMessage, 600);

                    // Save to DB so CRM sees it, but don't send to Telegram yet
                    await prisma.message.create({
                        data: {
                            content: displayMessage,
                            sender: MessageSender.SYSTEM,
                            conversationId: conversation.id,
                            messageType: "TEXT",
                        },
                    });

                    // Update CRM UI
                    safeEmitConversationUpdate(conversation, "conversation_updated", {
                        conversationId: conversation.id,
                        lastMessage: displayMessage,
                        updatedAt: new Date(),
                    });

                    // Send buttons with generic intro
                    await this.sendMessageWithVoiceButtons(chatId, "I've prepared a reply for you:");
                } else {
                    await this.saveAndSendSystemMessage(chatId, conversation, displayMessage);
                }
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
