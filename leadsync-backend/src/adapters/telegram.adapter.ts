import { ChannelAdapter } from "./channel.adapter";
import { prisma } from "../lib/prisma";
import {
    Channel,
    MessageSender,
    ConversationMode,
    OrderSource,
    OrderApprovalStatus,
    OrderStatus,
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
import { handleBotMessage } from "../bot/bot.logic";

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

                    // Simple detection for fallback
                    let langCode = "en-IN";
                    if (/[\u0B80-\u0BFF]/.test(lastText)) langCode = "ta-IN";
                    else if (/[\u0900-\u097F]/.test(lastText)) langCode = "hi-IN";

                    const audio = await sarvamService.textToSpeech(lastText, langCode);
                    if (audio) await this.sendVoice(chatId, audio);
                }
            } catch (err) {
                console.error("❌ Voice reply regeneration failed:", err);
            }

        } else if (data === "MENU" || data.startsWith("MENU")) {
            // Handle the dynamic MENU button from the AI
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" }
                });
                if (conversation) {
                    await this.sendTyping(chatId);
                    const aiReply = await handleBotMessage(
                        conversation.id,
                        "/menu",
                        "text",
                        "en-IN", // generic fallback, AI will redetect
                        "button_click",
                        "/menu",
                        data
                    );
                    if (aiReply) {
                        await this.parseAndSendResponse(chatId, conversation, aiReply);
                    }
                }
            } catch (err) {
                console.error("❌ MENU callback failed:", err);
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
            const messageId = String(message.message_id);

            // 🛡️ IDEMPOTENCY: Stop duplicate processing of the same message (retries)
            const idempotencyKey = `tg_msg_${chatId}_${messageId}`;
            if (cacheService.get(idempotencyKey)) {
                console.log(`🛡️ Duplicate Telegram message ${messageId} skipped for ${chatId}`);
                return;
            }
            cacheService.set(idempotencyKey, true, 300); // Lock for 5 mins

            const name = message.from?.first_name || "Customer";
            let text = message.text?.trim() || "";
            const isVoiceMsg = !!message.voice;

            let detectedLanguage = "en-IN"; // Default

            // 🎙️ VOICE INPUT: Download and transcribe if voice message
            if (isVoiceMsg && message.voice) {
                const { file_id, duration, mime_type } = message.voice;
                const audioBuffer = await downloadTelegramVoice(this.botToken, file_id);
                if (audioBuffer) {
                    const sttResult = await sarvamService.speechToText(audioBuffer, "voice.ogg");
                    if (sttResult) {
                        text = sttResult.transcript;
                        detectedLanguage = sttResult.languageCode;

                        // 🔍 Local Language Correction (Sarvam auto-detect is sometimes wrong for Tanglish/Hinglish)
                        const lowerText = text.toLowerCase();
                        const tamilKeywords = ["venum", "vendum", "moonu", "naalu", "onnu", "rendu", "kodu", "engo", "eppo"];
                        const hindiKeywords = ["chahiye", "kitna", "dena", "lelo", "mangwana", "khareedna"];

                        if (tamilKeywords.some(kw => lowerText.includes(kw))) {
                            detectedLanguage = "ta-IN";
                        } else if (hindiKeywords.some(kw => lowerText.includes(kw))) {
                            detectedLanguage = "hi-IN";
                        }
                    } else {
                        await this.sendMessage(chatId, "Sorry, I had trouble hearing that. Could you try again?");
                        return;
                    }
                } else {
                    await this.sendMessage(chatId, "The voice message couldn't be received. Please try again.");
                    return;
                }
            }

            if (!text) return;

            // ... (cache and token logic) ...
            let company: any = cacheService.get(cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma.company.findUnique({ where: { id: companyId } });
                if (company) cacheService.set(cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.telegramBotToken) return;

            this.botToken = company.telegramBotToken;
            this.sendTyping(chatId).catch(() => { });

            /* FIND / CREATE LEAD (Safe against race conditions) */
            const lead = await prisma.lead.upsert({
                where: {
                    contact_channel_companyId: {
                        contact: chatId,
                        channel: Channel.TELEGRAM,
                        companyId
                    }
                },
                update: { name },
                create: { name, contact: chatId, channel: Channel.TELEGRAM, companyId },
            });

            /* FIND / CREATE CONVERSATION (Safe against race conditions) */
            const conversation = await prisma.conversation.upsert({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: Channel.TELEGRAM,
                    },
                },
                update: {},
                create: {
                    leadId: lead.id,
                    companyId,
                    channel: Channel.TELEGRAM,
                    mode: ConversationMode.BOT,
                },
            });

            /* DEDUPLICATE CLIENT MESSAGE (Logic DB check) */
            const existingMessage = await prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: text,
                    sender: MessageSender.CLIENT,
                    createdAt: { gt: new Date(Date.now() - 1000 * 30) }
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

            // 🧠 BACKGROUND TASKS
            intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch(() => { });
            orderParserService.processPotentialOrder(companyId, conversation.id, lead.id, text, company.botStructuredMenu).catch(() => { });

            // 🔔 NOTIFICATION: Notify Assigned Agent & Admins
            const notifyBody = `${name}: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            } else {
                notificationService.notifyCompanyAdmins(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }

            if (conversation.mode === ConversationMode.HUMAN) return;

            /* AI REPLY */
            this.sendTyping(chatId).catch(() => { });

            try {
                const modality = isVoiceMsg ? "voice" : "text";
                const isCommand = text.startsWith("/");
                const triggerSource = isCommand ? "typed_command" : "normal_message";
                const command = isCommand ? text.split(" ")[0] : undefined;

                const aiReply = await handleBotMessage(
                    conversation.id,
                    text,
                    modality,
                    detectedLanguage,
                    triggerSource,
                    command
                );

                if (!aiReply) return;

                await this.parseAndSendResponse(chatId, conversation, aiReply, detectedLanguage, isVoiceMsg);
            } catch (err) {
                console.error("Bot Logic Error:", err);
            }

        } catch (err) {
            console.error("Telegram Process Error:", err);
        }
    }

    private async parseAndSendResponse(
        chatId: string,
        conversation: any,
        aiReply: string,
        detectedLanguage: string = "en-IN",
        isVoiceMsg: boolean = false
    ) {
        // 1. Parse structured format
        const lines = aiReply.split("\n").map(l => l.trim());
        let messageText = "";
        let buttonLabel = "";
        let callbackData = "";

        for (const line of lines) {
            if (line.startsWith("MESSAGE:")) messageText = line.replace("MESSAGE:", "").trim();
            if (line.startsWith("BUTTON:")) buttonLabel = line.replace("BUTTON:", "").trim();
            if (line.startsWith("CALLBACK:")) callbackData = line.replace("CALLBACK:", "").trim();
        }

        // Fallback if AI forgot headers
        if (!messageText) messageText = aiReply.split("BUTTON:")[0].trim();

        // 2. Save Message to DB
        const botMsg = await prisma.message.create({
            data: {
                content: messageText,
                sender: MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        });

        safeEmitConversationUpdate(conversation, "conversation_updated", {
            conversationId: conversation.id,
            lastMessage: messageText,
            updatedAt: new Date(),
        });
        emitToConversation(conversation.id, "new_message", botMsg);

        // 3. Send to Telegram
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const payload: any = {
            chat_id: chatId,
            text: messageText,
            parse_mode: "HTML",
        };

        if (buttonLabel && callbackData) {
            payload.reply_markup = {
                inline_keyboard: [[{ text: buttonLabel, callback_data: callbackData }]]
            };
        }

        await sendTelegramApi(url, payload);

        // 4. Pre-generate voice if it was a voice conversation (Optional background task)
        if (isVoiceMsg) {
            sarvamService.textToSpeech(messageText, detectedLanguage)
                .then(audioBuffer => {
                    if (audioBuffer) cacheService.set(cacheService.getPendingVoiceKey(chatId), audioBuffer, 120);
                })
                .catch(() => { });
        }
    }

    private async saveAndSendSystemMessage(chatId: string, conversation: any, text: string) {
        // OPTIMIZATION: Run DB save and Telegram Send in Parallel
        const dbPromise = prisma.message.create({
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

        const telegramPromise = this.sendMessage(chatId, text);
        await Promise.all([dbPromise, telegramPromise]);
    }
}
