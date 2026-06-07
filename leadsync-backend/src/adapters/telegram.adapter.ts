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
import { generateBotReply } from "../services/ai/ai.service";
import { aiQueue } from "../services/infrastructure/queue.service";
import { cacheService } from "../services/infrastructure/cache.service";
import { intelligenceService } from "../services/ai/intelligence.service";
import { orderParserService } from "../services/ai/orderParser.service";
import { notificationService } from "../services/infrastructure/notification.service";
import { sarvamService } from "../services/ai/sarvam.service";
import { assignmentService } from "../services/workflow/assignment.service";
import { handleBotMessage } from "../bot/bot.logic";
import { recalculateLeadCRM } from "../services/integrations/crm.service";

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

export function escapeHtmlForTelegram(text: string): string {
    if (!text) return "";
    
    // First escape all '&' that are not already part of an HTML entity
    let escaped = text.replace(/&(?!(amp|lt|gt|quot|apos|#\d+);)/g, "&amp;");
    
    // Valid allowed Telegram HTML tags (opening and closing)
    const allowedTags = /<\/?(b|strong|i|em|u|ins|s|strike|del|code|pre|a\s+href="[^"]*"\s*|a)>/g;
    
    // Replace allowed tags with a unique placeholder, escape the rest, then restore placeholders
    const placeholders: string[] = [];
    escaped = escaped.replace(allowedTags, (match) => {
        placeholders.push(match);
        return `__TG_HTML_TAG_PLACEHOLDER_${placeholders.length - 1}__`;
    });
    
    // Escape standard XML/HTML tags
    escaped = escaped.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Restore placeholders
    escaped = escaped.replace(/__TG_HTML_TAG_PLACEHOLDER_(\d+)__/g, (_, index) => {
        return placeholders[parseInt(index, 10)];
    });
    
    return escaped;
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
        const filePath = (fileRes.data as any)?.result?.file_path;
        if (!filePath) return null;

        const audioRes = await axios.get(
            `https://api.telegram.org/file/bot${botToken}/${filePath}`,
            { responseType: "arraybuffer", timeout: 15000 }
        );
        return Buffer.from(audioRes.data as ArrayBuffer);
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
            text: escapeHtmlForTelegram(text),
            parse_mode: "HTML",
        };
        await sendTelegramApi(url, payload);
    }

    /** Send message with inline Voice/Text reply choice buttons */
    async sendMessageWithVoiceButtons(to: string, text: string) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await sendTelegramApi(url, {
            chat_id: to,
            text: escapeHtmlForTelegram(text),
            parse_mode: "HTML",
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

        if (data.startsWith("lang_set:")) {
            const langCode = data.split(":")[1];
            try {
                const lead = await prisma.lead.findFirst({
                    where: { contact: chatId, channel: Channel.TELEGRAM } // Add companyId constraint if necessary, but contact is usually unique enough for this or findMany. Using findFirst.
                });
                if (lead) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { preferredLanguage: langCode }
                    });
                    
                    const responseMap: any = {
                        "ta-IN": "மொழி தமிழுக்கு மாற்றப்பட்டது. நான் உங்களுக்கு எவ்வாறு உதவலாம்?",
                        "hi-IN": "भाषा हिंदी में सेट हो गई है। मैं आपकी कैसे मदद कर सकता हूँ?",
                        "te-IN": "భాష తెలుగుకు సెట్ చేయబడింది. నేను మీకు ఎలా సహాయం చేయగలను?",
                        "ml-IN": "ഭാഷ മലയാളമായി സജ്ജീകരിച്ചു. നിങ്ങൾക്ക് എങ്ങനെ സഹായം ചെയ്യാം?",
                        "kn-IN": "ಭಾಷೆ ಕನ್ನಡಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
                        "en-IN": "Language set to English. How can I help you today?"
                    };
                    const responseMsg = responseMap[langCode] || responseMap["en-IN"];
                    
                    const messageId = callbackQuery.message?.message_id;
                    if (messageId) {
                        const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;
                        const payload = {
                            chat_id: chatId,
                            message_id: messageId,
                            text: responseMsg,
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: []
                            }
                        };
                        try {
                            await sendTelegramApi(url, payload);
                        } catch (e) {
                            console.error("❌ editMessageText failed, falling back to sendMessage", e);
                            await this.sendMessage(chatId, responseMsg);
                        }
                    } else {
                        await this.sendMessage(chatId, responseMsg);
                    }
                }
            } catch (err) {
                 console.error("❌ lang_set callback failed:", err);
            }
            return;
        }

        if (data === "lang_selection_prompt") {
            try {
                const welcomeText = "🌐 Please select your preferred language / உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்:";
                const messageId = callbackQuery.message?.message_id;
                
                if (messageId) {
                    const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;
                    const payload = {
                        chat_id: chatId,
                        message_id: messageId,
                        text: welcomeText,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "English", callback_data: "lang_set:en-IN" },
                                    { text: "தமிழ் (Tamil)", callback_data: "lang_set:ta-IN" }
                                ],
                                [
                                    { text: "हिंदी (Hindi)", callback_data: "lang_set:hi-IN" },
                                    { text: "తెలుగు (Telugu)", callback_data: "lang_set:te-IN" }
                                ],
                                [
                                    { text: "ಕನ್ನಡ (Kannada)", callback_data: "lang_set:kn-IN" },
                                    { text: "മലയാളం (Malayalam)", callback_data: "lang_set:ml-IN" }
                                ]
                            ]
                        }
                    };
                    try {
                        await sendTelegramApi(url, payload);
                    } catch (e) {
                        console.error("❌ editMessageText failed for lang_selection_prompt, falling back to sendMessage", e);
                        await sendTelegramApi(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: welcomeText,
                            parse_mode: "HTML",
                            reply_markup: payload.reply_markup
                        });
                    }
                } else {
                    await sendTelegramApi(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: welcomeText,
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "English", callback_data: "lang_set:en-IN" },
                                    { text: "தமிழ் (Tamil)", callback_data: "lang_set:ta-IN" }
                                ],
                                [
                                    { text: "हिंदी (Hindi)", callback_data: "lang_set:hi-IN" },
                                    { text: "తెలుగు (Telugu)", callback_data: "lang_set:te-IN" }
                                ],
                                [
                                    { text: "ಕನ್ನಡ (Kannada)", callback_data: "lang_set:kn-IN" },
                                    { text: "മലയാളം (Malayalam)", callback_data: "lang_set:ml-IN" }
                                ]
                            ]
                        }
                    });
                }
            } catch (err) {
                console.error("❌ lang_selection_prompt callback failed:", err);
            }
            return;
        }

        if (data === "TODAY_SPECIAL") {
            try {
                const specMsg = "☕️ <b>Today's Special Offer</b>:\ncoffee is 15% discount today";
                const dbMsg = "☕️ Today's Special Offer:\ncoffee is 15% discount today";
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" }
                });
                if (conversation) {
                    const botMsg = await prisma.message.create({
                        data: {
                            content: dbMsg,
                            sender: MessageSender.SYSTEM,
                            conversationId: conversation.id,
                        }
                    });
                    emitToConversation(conversation.id, "new_message", botMsg);
                }
                const companyId = conversation?.companyId;
                if (companyId) {
                    let company: any = cacheService.get(cacheService.getCompanyKey(companyId));
                    if (!company) {
                        company = await prisma.company.findUnique({
                            where: { id: companyId }
                        });
                        if (company) cacheService.set(cacheService.getCompanyKey(companyId), company);
                    }
                    if (company && company.telegramBotToken) {
                        this.botToken = company.telegramBotToken;
                    }
                }
                await this.sendMessage(chatId, specMsg);
            } catch (err) {
                console.error("❌ TODAY_SPECIAL callback failed:", err);
            }
            return;
        }

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

        } else if (data === "CONFIRM_ORDER") {
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" },
                    include: { lead: true }
                });
                if (conversation) {
                    const sessionState = conversation.sessionState as any;
                    const cartItems = sessionState?.cart?.items || [];
                    
                    if (cartItems.length > 0) {
                        const summaryText = cartItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", ");
                        const totalAmount = cartItems.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0);

                        let existingOrder = await prisma.order.findFirst({
                            where: {
                                conversationId: conversation.id,
                                status: { in: [OrderStatus.NEW, OrderStatus.BOT_CREATED_ORDER, OrderStatus.PENDING] },
                                isDeleted: false
                            },
                            orderBy: { createdAt: "desc" }
                        });

                        let newOrder;
                        if (existingOrder) {
                            newOrder = await prisma.order.update({
                                where: { id: existingOrder.id },
                                data: {
                                    summary: summaryText,
                                    amount: totalAmount,
                                    status: OrderStatus.PENDING,
                                    items: cartItems,
                                    approvalStatus: "PENDING",
                                }
                            });
                        } else {
                            newOrder = await prisma.order.create({
                                data: {
                                    companyId: conversation.companyId,
                                    conversationId: conversation.id,
                                    leadId: conversation.leadId,
                                    summary: summaryText,
                                    amount: totalAmount,
                                    status: OrderStatus.PENDING,
                                    items: cartItems,
                                    approvalStatus: "PENDING",
                                    source: "BOT_DETECTED",
                                },
                            });
                        }

                        await prisma.orderLog.create({
                            data: {
                                orderId: newOrder.id,
                                actorId: "SYSTEM",
                                actorName: "SYSTEM_BOT",
                                actorRole: "SYSTEM",
                                action: "STATUS_CHANGE",
                                metadata: { to: OrderStatus.PENDING, version: 1 },
                            }
                        });

                        const updatedState = { ...sessionState, cart: { items: [], total: 0 } };
                        await prisma.conversation.update({
                            where: { id: conversation.id },
                            data: { sessionState: updatedState }
                        });

                        // Dynamic CRM metrics recalculation
                        await recalculateLeadCRM(conversation.leadId, conversation.companyId);

                        const replyMsg = "Your order has been confirmed successfully. Waiting for agent manual confirmation to process further.";
                        
                        const botMsg = await prisma.message.create({
                            data: {
                                content: replyMsg,
                                sender: MessageSender.SYSTEM,
                                conversationId: conversation.id,
                            }
                        });

                        safeEmitConversationUpdate(conversation, "order_updated", newOrder);
                        emitToConversation(conversation.id, "new_message", botMsg);
                        emitToCompany(conversation.companyId, "order_updated", newOrder);

                        await this.sendMessage(chatId, replyMsg);
                    } else {
                        await this.sendMessage(chatId, "No active order items in your cart to confirm. Please add items first!");
                    }
                }
            } catch (err) {
                console.error("❌ CONFIRM_ORDER callback failed:", err);
            }
        } else if (data === "CANCEL_ORDER") {
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" }
                });
                if (conversation) {
                    const sessionState = conversation.sessionState as any;
                    const updatedState = { ...sessionState, cart: { items: [], total: 0 } };
                    await prisma.conversation.update({
                        where: { id: conversation.id },
                        data: { sessionState: updatedState }
                    });

                    const replyMsg = "Your order has been cancelled successfully.";

                    const botMsg = await prisma.message.create({
                        data: {
                            content: replyMsg,
                            sender: MessageSender.SYSTEM,
                            conversationId: conversation.id,
                        }
                    });

                    emitToConversation(conversation.id, "new_message", botMsg);

                    await this.sendMessage(chatId, replyMsg);
                }
            } catch (err) {
                console.error("❌ CANCEL_ORDER callback failed:", err);
            }
        } else if (data === "MENU" || data === "VIEW_MENU") {
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
                        "en-IN",
                        "button_click",
                        "/menu",
                        data
                    );
                    if (aiReply) await this.parseAndSendResponse(chatId, conversation, aiReply);
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
        } else {
            // 🆕 GENERIC FALLBACK: Pass custom button callbacks to the AI as a text query
            // This allows buttons like "Today Discount" to be handled by the conversation engine
            try {
                const conversation = await prisma.conversation.findFirst({
                    where: { lead: { contact: chatId } },
                    orderBy: { updatedAt: "desc" }
                });
                if (conversation) {
                    await this.sendTyping(chatId);
                    // Convert slug like "today_discount" back to "today discount"
                    const searchPhrase = data.replace(/_/g, " ");
                    const aiReply = await handleBotMessage(
                        conversation.id,
                        searchPhrase,
                        "text",
                        "en-IN",
                        "button_click"
                    );
                    if (aiReply) await this.parseAndSendResponse(chatId, conversation, aiReply);
                }
            } catch (err) {
                console.error(`❌ Custom callback ${data} failed:`, err);
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

            // ... (cache and token logic) ...
            let company: any = cacheService.get(cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma.company.findUnique({
                    where: { id: companyId },
                    include: { botConfiguration: true }
                });
                if (company) cacheService.set(cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.telegramBotToken) return;

            this.botToken = company.telegramBotToken;

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

            this.sendTyping(chatId).catch(() => { });

            let detectedLanguage = lead.preferredLanguage || "en-IN";

            // 🎙️ VOICE INPUT: Download and transcribe if voice message
            if (isVoiceMsg && message.voice) {
                const { file_id } = message.voice;
                const audioBuffer = await downloadTelegramVoice(this.botToken, file_id);
                if (audioBuffer) {
                    const sttResult = await sarvamService.speechToText(audioBuffer, "voice.ogg");
                    if (sttResult) {
                        text = sttResult.transcript;
                        if (!lead.preferredLanguage) {
                            detectedLanguage = await sarvamService.detectLanguage(text);
                        }
                    } else {
                        await this.sendMessage(chatId, "Sorry, I had trouble hearing that. Could you try again?");
                        return;
                    }
                } else {
                    await this.sendMessage(chatId, "The voice message couldn't be received. Please try again.");
                    return;
                }
            } else if (text) {
                if (!lead.preferredLanguage) {
                    detectedLanguage = await sarvamService.detectLanguage(text);
                }
            }

            if (!text) return;

            /* FIND / CREATE CONVERSATION (Safe against race conditions) */
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

                // Trigger Auto-Assignment strategy for a newly created conversation
                try {
                    const assignedAgentId = await assignmentService.autoAssignConversation(companyId, conversation.id);
                    if (assignedAgentId) {
                        conversation.assignedToId = assignedAgentId;
                    }
                } catch (err) {
                    console.error("[AUTO-ASSIGN-ERROR] Telegram auto assign failed:", err);
                }
            } else if (!conversation.assignedToId) {
                // Trigger Auto-Assignment strategy if the existing conversation has no assigned agent
                try {
                    console.log(`[TELEGRAM] Existing conversation ${conversation.id} has no agent. Triggering auto-assignment.`);
                    const assignedAgentId = await assignmentService.autoAssignConversation(companyId, conversation.id);
                    if (assignedAgentId) {
                        conversation.assignedToId = assignedAgentId;
                    }
                } catch (err) {
                    console.error("[AUTO-ASSIGN-ERROR] Existing Telegram conversation auto assign failed:", err);
                }
            }

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

            const fullConversation = await prisma.conversation.findUnique({
                where: { id: conversation.id },
                include: {
                    lead: { select: { id: true, name: true, contact: true, channel: true } },
                    assignedTo: { select: { id: true, name: true } }
                }
            });

            safeEmitConversationUpdate(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
                conversation: fullConversation || undefined
            });
            emitToConversation(conversation.id, "new_message", clientMsg);

            // 🧠 BACKGROUND TASKS
            intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch(() => { });
            orderParserService.processPotentialOrder(companyId, conversation.id, lead.id, text, company.botConfiguration?.botStructuredMenu).catch(() => { });

            // 🔔 NOTIFICATION: Notify Assigned Agent & All Agents (if unclaimed)
            const notifyBody = `${name}: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            } else {
                notificationService.notifyCompany(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }

            const isStartCommand = text.toLowerCase().trim() === "/start" || text.toLowerCase().trim() === "start";

            if (conversation.mode === ConversationMode.HUMAN) {
                if (isStartCommand) {
                    conversation = await prisma.conversation.update({
                        where: { id: conversation.id },
                        data: { mode: ConversationMode.BOT }
                    });
                } else {
                    return;
                }
            }

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
                await this.sendMessage(chatId, "I am experiencing some technical issues right now. My system is taking too long to respond. Please try your request again.");
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
        // 1. Split AI output into blocks (in case AI sends multiple MESSAGE: parts)
        const parts = aiReply.split(/(?=MESSAGE:)/g).filter(p => p.trim());

        for (const part of parts) {
            const lines = part.split("\n").map(l => l.trim());
            let messageText = "";
            let buttonsList: {text: string, callback_data: string}[] = [];
            let currentButton = "";
            let msgLines: string[] = [];

            for (const line of lines) {
                if (line.startsWith("BUTTON:")) {
                    currentButton = line.replace("BUTTON:", "").trim();
                } else if (line.startsWith("CALLBACK:")) {
                    const callbackVal = line.replace("CALLBACK:", "").trim();
                    if (currentButton) {
                        buttonsList.push({ text: currentButton, callback_data: callbackVal });
                        currentButton = "";
                    }
                } else {
                    // Collect all lines that are not buttons/callbacks
                    msgLines.push(line.replace(/^MESSAGE:/i, "").trim());
                }
            }
            messageText = msgLines.filter(l => l !== "").join("\n");

            if (!messageText) continue;

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
                text: escapeHtmlForTelegram(messageText),
                parse_mode: "HTML",
            };

            const buttons: any[] = [];
            if (buttonsList.length > 0) {
                buttonsList.forEach(b => buttons.push([{ text: b.text, callback_data: b.callback_data }]));
            }

            if (isVoiceMsg) {
                buttons.push([
                    { text: "🔊 Voice Reply", callback_data: `voice_reply:${chatId}` }
                ]);
            }

            if (buttons.length > 0) {
                payload.reply_markup = { inline_keyboard: buttons };
            }

            await sendTelegramApi(url, payload);

            // 4. Pre-generate voice and cache text (background)
            cacheService.set(cacheService.getPendingTextKey(chatId), messageText, 300);
            if (isVoiceMsg) {
                sarvamService.textToSpeech(messageText, detectedLanguage)
                    .then(audioBuffer => {
                        if (audioBuffer) cacheService.set(cacheService.getPendingVoiceKey(chatId), audioBuffer, 300);
                    })
                    .catch(() => { });
            }
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
