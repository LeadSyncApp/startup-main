"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const socket_1 = require("../lib/socket");
const cache_service_1 = require("../services/cache.service");
const intelligence_service_1 = require("../services/intelligence.service");
const orderParser_service_1 = require("../services/orderParser.service");
const notification_service_1 = require("../services/notification.service");
const sarvam_service_1 = require("../services/sarvam.service");
const bot_logic_1 = require("../bot/bot.logic");
/* ===============================
   HELPER
=============================== */
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
function buildWelcomeMessage(company, name) {
    const customWelcome = company?.botWelcomeMessage?.trim()?.length > 0
        ? company.botWelcomeMessage
        : `Welcome to ${company?.name || "our store"}! We are happy to assist you.`;
    return `👋 Hello ${name}!\n\n${customWelcome}`;
}
const sendTelegramApi = async (url, payload) => {
    try {
        await axios_1.default.post(url, payload, { timeout: 5000 });
    }
    catch (error) {
        console.error("❌ Telegram API error:", error?.message);
    }
};
/** Download a Telegram voice file into a Buffer */
async function downloadTelegramVoice(botToken, fileId) {
    try {
        const fileRes = await axios_1.default.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const filePath = fileRes.data?.result?.file_path;
        if (!filePath)
            return null;
        const audioRes = await axios_1.default.get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, { responseType: "arraybuffer", timeout: 15000 });
        return Buffer.from(audioRes.data);
    }
    catch (err) {
        console.error("❌ Voice download error:", err.message);
        return null;
    }
}
/* ===============================
   TELEGRAM ADAPTER
=============================== */
class TelegramAdapter {
    constructor(botToken) {
        this.botToken = botToken;
    }
    async verifyWebhook(req) {
        return !!(req.body && (req.body.message || req.body.callback_query));
    }
    async sendMessage(to, text, options) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const payload = {
            chat_id: to,
            text,
            parse_mode: "HTML",
        };
        await sendTelegramApi(url, payload);
    }
    /** Send message with inline Voice/Text reply choice buttons */
    async sendMessageWithVoiceButtons(to, text) {
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
    async answerCallbackQuery(callbackQueryId) {
        await sendTelegramApi(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, { callback_query_id: callbackQueryId });
    }
    /** Handle button press from inline keyboard */
    async handleCallbackQuery(callbackQuery) {
        const chatId = String(callbackQuery.message?.chat?.id);
        const data = callbackQuery.data;
        const queryId = callbackQuery.id;
        await this.answerCallbackQuery(queryId); // dismiss spinner immediately
        if (data.startsWith("voice_reply:")) {
            // Fast path: use pre-cached audio
            const cachedAudio = cache_service_1.cacheService.get(cache_service_1.cacheService.getPendingVoiceKey(chatId));
            if (cachedAudio) {
                await this.sendVoice(chatId, cachedAudio);
                return;
            }
            // Slow path: cache expired — regenerate TTS from last bot message in DB
            try {
                const conversation = await prisma_1.prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" },
                    include: { messages: { where: { sender: client_1.MessageSender.SYSTEM }, orderBy: { createdAt: "desc" }, take: 1 } }
                });
                const lastText = conversation?.messages?.[0]?.content;
                if (lastText) {
                    await this.sendTyping(chatId);
                    // Simple detection for fallback
                    let langCode = "en-IN";
                    if (/[\u0B80-\u0BFF]/.test(lastText))
                        langCode = "ta-IN";
                    else if (/[\u0900-\u097F]/.test(lastText))
                        langCode = "hi-IN";
                    const audio = await sarvam_service_1.sarvamService.textToSpeech(lastText, langCode);
                    if (audio)
                        await this.sendVoice(chatId, audio);
                }
            }
            catch (err) {
                console.error("❌ Voice reply regeneration failed:", err);
            }
        }
        else if (data === "MENU" || data.startsWith("MENU") || data === "VIEW_MENU") {
            // Handle the dynamic MENU button from the AI
            try {
                const conversation = await prisma_1.prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" }
                });
                if (conversation) {
                    await this.sendTyping(chatId);
                    const aiReply = await (0, bot_logic_1.handleBotMessage)(conversation.id, "/menu", "text", "en-IN", // generic fallback, AI will redetect
                    "button_click", "/menu", data);
                    if (aiReply) {
                        await this.parseAndSendResponse(chatId, conversation, aiReply);
                    }
                }
            }
            catch (err) {
                console.error("❌ MENU callback failed:", err);
            }
        }
        else if (data.startsWith("text_reply:")) {
            // Fast path: use cached text
            const pendingText = cache_service_1.cacheService.get(cache_service_1.cacheService.getPendingTextKey(chatId));
            if (pendingText) {
                await this.sendMessage(chatId, pendingText);
                return;
            }
            // Slow path: fallback to DB
            try {
                const conversation = await prisma_1.prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" },
                    include: { messages: { where: { sender: client_1.MessageSender.SYSTEM }, orderBy: { createdAt: "desc" }, take: 1 } }
                });
                const lastText = conversation?.messages?.[0]?.content;
                if (lastText) {
                    await this.sendMessage(chatId, lastText);
                }
            }
            catch (err) {
                console.error("❌ Text reply fallback failed:", err);
            }
        }
    }
    /** Send a pre-generated voice audio buffer as a Telegram voice message */
    async sendVoice(to, audioBuffer) {
        try {
            const FormData = require("form-data");
            const form = new FormData();
            form.append("chat_id", to);
            form.append("voice", audioBuffer, {
                filename: "reply.ogg",
                contentType: "audio/ogg",
            });
            await axios_1.default.post(`https://api.telegram.org/bot${this.botToken}/sendVoice`, form, { headers: form.getHeaders(), timeout: 15000 });
            console.log(`🔊 Voice message sent to ${to}`);
        }
        catch (err) {
            console.error("❌ sendVoice error:", err.message);
        }
    }
    async sendTyping(to) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendChatAction`;
        await sendTelegramApi(url, { chat_id: to, action: "typing" });
    }
    /* -------------------------------
       MAIN PROCESSING LOGIC
    -------------------------------- */
    async processWebhook(body, companyId) {
        try {
            // 🔘 ROUTE: Handle inline button presses (callback queries)
            if (body.callback_query) {
                await this.handleCallbackQuery(body.callback_query);
                return;
            }
            const message = body.message;
            if (!message || !message.message_id)
                return;
            const chatId = String(message.chat.id);
            const messageId = String(message.message_id);
            // 🛡️ IDEMPOTENCY: Stop duplicate processing of the same message (retries)
            const idempotencyKey = `tg_msg_${chatId}_${messageId}`;
            if (cache_service_1.cacheService.get(idempotencyKey)) {
                console.log(`🛡️ Duplicate Telegram message ${messageId} skipped for ${chatId}`);
                return;
            }
            cache_service_1.cacheService.set(idempotencyKey, true, 300); // Lock for 5 mins
            const name = message.from?.first_name || "Customer";
            let text = message.text?.trim() || "";
            const isVoiceMsg = !!message.voice;
            let detectedLanguage = "en-IN"; // Default
            // 🎙️ VOICE INPUT: Download and transcribe if voice message
            if (isVoiceMsg && message.voice) {
                const { file_id, duration, mime_type } = message.voice;
                const audioBuffer = await downloadTelegramVoice(this.botToken, file_id);
                if (audioBuffer) {
                    const sttResult = await sarvam_service_1.sarvamService.speechToText(audioBuffer, "voice.ogg");
                    if (sttResult) {
                        text = sttResult.transcript;
                        // Voice transcription already detects language, but we can refine it
                        detectedLanguage = await sarvam_service_1.sarvamService.detectLanguage(text);
                    }
                    else {
                        await this.sendMessage(chatId, "Sorry, I had trouble hearing that. Could you try again?");
                        return;
                    }
                }
                else {
                    await this.sendMessage(chatId, "The voice message couldn't be received. Please try again.");
                    return;
                }
            }
            else if (text) {
                detectedLanguage = await sarvam_service_1.sarvamService.detectLanguage(text);
            }
            if (!text)
                return;
            // ... (cache and token logic) ...
            let company = cache_service_1.cacheService.get(cache_service_1.cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
                if (company)
                    cache_service_1.cacheService.set(cache_service_1.cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.telegramBotToken)
                return;
            this.botToken = company.telegramBotToken;
            this.sendTyping(chatId).catch(() => { });
            /* FIND / CREATE LEAD (Safe against race conditions) */
            const lead = await prisma_1.prisma.lead.upsert({
                where: {
                    contact_channel_companyId: {
                        contact: chatId,
                        channel: client_1.Channel.TELEGRAM,
                        companyId
                    }
                },
                update: { name },
                create: { name, contact: chatId, channel: client_1.Channel.TELEGRAM, companyId },
            });
            /* FIND / CREATE CONVERSATION (Safe against race conditions) */
            const conversation = await prisma_1.prisma.conversation.upsert({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: client_1.Channel.TELEGRAM,
                    },
                },
                update: {},
                create: {
                    leadId: lead.id,
                    companyId,
                    channel: client_1.Channel.TELEGRAM,
                    mode: client_1.ConversationMode.BOT,
                },
            });
            /* DEDUPLICATE CLIENT MESSAGE (Logic DB check) */
            const existingMessage = await prisma_1.prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: text,
                    sender: client_1.MessageSender.CLIENT,
                    createdAt: { gt: new Date(Date.now() - 1000 * 30) }
                },
            });
            if (existingMessage)
                return;
            /* SAVE CLIENT MESSAGE */
            const clientMsg = await prisma_1.prisma.message.create({
                data: {
                    content: text,
                    sender: client_1.MessageSender.CLIENT,
                    messageType: isVoiceMsg ? "VOICE" : "TEXT",
                    conversationId: conversation.id,
                },
            });
            (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            (0, socket_1.emitToConversation)(conversation.id, "new_message", clientMsg);
            // 🧠 BACKGROUND TASKS
            intelligence_service_1.intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch(() => { });
            orderParser_service_1.orderParserService.processPotentialOrder(companyId, conversation.id, lead.id, text, company.botStructuredMenu).catch(() => { });
            // 🔔 NOTIFICATION: Notify Assigned Agent & Admins
            const notifyBody = `${name}: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notification_service_1.notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            }
            else {
                notification_service_1.notificationService.notifyCompanyAdmins(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }
            if (conversation.mode === client_1.ConversationMode.HUMAN)
                return;
            /* AI REPLY */
            this.sendTyping(chatId).catch(() => { });
            try {
                const modality = isVoiceMsg ? "voice" : "text";
                const isCommand = text.startsWith("/");
                const triggerSource = isCommand ? "typed_command" : "normal_message";
                const command = isCommand ? text.split(" ")[0] : undefined;
                const aiReply = await (0, bot_logic_1.handleBotMessage)(conversation.id, text, modality, detectedLanguage, triggerSource, command);
                if (!aiReply)
                    return;
                await this.parseAndSendResponse(chatId, conversation, aiReply, detectedLanguage, isVoiceMsg);
            }
            catch (err) {
                console.error("Bot Logic Error:", err);
            }
        }
        catch (err) {
            console.error("Telegram Process Error:", err);
        }
    }
    async parseAndSendResponse(chatId, conversation, aiReply, detectedLanguage = "en-IN", isVoiceMsg = false) {
        // 1. Split AI output into blocks (in case AI sends multiple MESSAGE: parts)
        const parts = aiReply.split(/(?=MESSAGE:)/g).filter(p => p.trim());
        for (const part of parts) {
            const lines = part.split("\n").map(l => l.trim());
            let messageText = "";
            let buttonLabel = "";
            let callbackData = "";
            let msgLines = [];
            for (const line of lines) {
                if (line.startsWith("BUTTON:")) {
                    buttonLabel = line.replace("BUTTON:", "").trim();
                }
                else if (line.startsWith("CALLBACK:")) {
                    callbackData = line.replace("CALLBACK:", "").trim();
                }
                else {
                    // Collect all lines that are not buttons/callbacks
                    msgLines.push(line.replace(/^MESSAGE:/i, "").trim());
                }
            }
            messageText = msgLines.filter(l => l !== "").join("\n");
            if (!messageText)
                continue;
            // 2. Save Message to DB
            const botMsg = await prisma_1.prisma.message.create({
                data: {
                    content: messageText,
                    sender: client_1.MessageSender.SYSTEM,
                    conversationId: conversation.id,
                },
            });
            (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: messageText,
                updatedAt: new Date(),
            });
            (0, socket_1.emitToConversation)(conversation.id, "new_message", botMsg);
            // 3. Send to Telegram
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const payload = {
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
            // 4. Pre-generate voice if it was a voice conversation (background)
            if (isVoiceMsg) {
                sarvam_service_1.sarvamService.textToSpeech(messageText, detectedLanguage)
                    .then(audioBuffer => {
                    if (audioBuffer)
                        cache_service_1.cacheService.set(cache_service_1.cacheService.getPendingVoiceKey(chatId), audioBuffer, 120);
                })
                    .catch(() => { });
            }
        }
    }
    async saveAndSendSystemMessage(chatId, conversation, text) {
        // OPTIMIZATION: Run DB save and Telegram Send in Parallel
        const dbPromise = prisma_1.prisma.message.create({
            data: {
                content: text,
                sender: client_1.MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        }).then(botMsg => {
            (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            (0, socket_1.emitToConversation)(conversation.id, "new_message", botMsg);
        });
        const telegramPromise = this.sendMessage(chatId, text);
        await Promise.all([dbPromise, telegramPromise]);
    }
}
exports.TelegramAdapter = TelegramAdapter;
