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
const geminiService_1 = require("../services/geminiService");
const queue_service_1 = require("../services/queue.service");
const cache_service_1 = require("../services/cache.service");
const intelligence_service_1 = require("../services/intelligence.service");
const orderParser_service_1 = require("../services/orderParser.service");
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
/* ===============================
   TELEGRAM ADAPTER
=============================== */
class TelegramAdapter {
    constructor(botToken) {
        this.botToken = botToken;
    }
    async verifyWebhook(req) {
        // Verification is done in controller via secret_token header usually, 
        // but adapter could validate payload structure.
        return !!(req.body && req.body.message);
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
    async sendTyping(to) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendChatAction`;
        await sendTelegramApi(url, { chat_id: to, action: "typing" });
    }
    /* -------------------------------
       MAIN PROCESSING LOGIC
    -------------------------------- */
    async processWebhook(body, companyId) {
        try {
            const message = body.message;
            if (!message || !message.message_id)
                return;
            const chatId = String(message.chat.id);
            const name = message.from?.first_name || "Customer";
            const text = message.text?.trim();
            if (!text)
                return;
            // 1. Try Cache
            let company = cache_service_1.cacheService.get(cache_service_1.cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
                if (company)
                    cache_service_1.cacheService.set(cache_service_1.cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.telegramBotToken)
                return;
            // Update token if needed (though adapter instance might be short-lived)
            this.botToken = company.telegramBotToken;
            this.sendTyping(chatId).catch(() => { });
            /* FIND / CREATE LEAD */
            let lead = await prisma_1.prisma.lead.findFirst({
                where: { contact: chatId, channel: client_1.Channel.TELEGRAM, companyId },
            });
            if (!lead) {
                lead = await prisma_1.prisma.lead.create({
                    data: { name, contact: chatId, channel: client_1.Channel.TELEGRAM, companyId },
                });
                (0, socket_1.emitToCompany)(companyId, "lead_created", lead);
            }
            /* FIND / CREATE CONVERSATION */
            let conversation = await prisma_1.prisma.conversation.findUnique({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: client_1.Channel.TELEGRAM,
                    },
                },
            });
            if (!conversation) {
                conversation = await prisma_1.prisma.conversation.create({
                    data: {
                        leadId: lead.id,
                        companyId,
                        channel: client_1.Channel.TELEGRAM,
                        mode: client_1.ConversationMode.BOT,
                    },
                });
            }
            /* DEDUPLICATE */
            const existingMessage = await prisma_1.prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: text,
                    sender: client_1.MessageSender.CLIENT,
                    // Check recently created to dedupe retries
                    createdAt: { gt: new Date(Date.now() - 1000 * 60) }
                },
            });
            if (existingMessage)
                return;
            /* SAVE CLIENT MESSAGE */
            const clientMsg = await prisma_1.prisma.message.create({
                data: {
                    content: text,
                    sender: client_1.MessageSender.CLIENT,
                    conversationId: conversation.id,
                },
            });
            (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            (0, socket_1.emitToConversation)(conversation.id, "new_message", clientMsg);
            // 🧠 INTELLIGENCE: Analyze message in background (Fire-and-forget)
            // This updates Sentiment, Intent, and LastActiveAt without blocking the bot reply.
            intelligence_service_1.intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch((err) => console.error("Intelligence Error:", err));
            // 🍔 ORDER DETECTION: Check for orders in background
            orderParser_service_1.orderParserService.processPotentialOrder(companyId, conversation.id, lead.id, text, company.botStructuredMenu).catch((err) => console.error("OrderParser Error:", err));
            if (conversation.mode === client_1.ConversationMode.HUMAN)
                return;
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
            if (isFood)
                catalogTerm = "Menu";
            else if (isRetail)
                catalogTerm = "Collection";
            else if (isElectronics)
                catalogTerm = "Inventory";
            else if (isService)
                catalogTerm = "Services";
            const structuredMenu = company.botStructuredMenu;
            const categories = structuredMenu?.categories || [];
            const input = text.toLowerCase();
            const isMenuRequest = input === "menu" ||
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
                    cat.items.forEach((item) => {
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
            const matchedCategory = categories.find(cat => input === cat.name.toLowerCase() ||
                input === cat.name.toLowerCase() + "s" ||
                (input.length > 3 && cat.name.toLowerCase().includes(input)));
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
            const history = await prisma_1.prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            });
            // Reverse history for AI context
            const historyContext = history.reverse().map(m => ({
                role: m.sender === client_1.MessageSender.CLIENT ? "user" : "assistant",
                content: m.content
            }));
            // SPEED OPTIMIZATION: Fire typing indicator immediately (fire-and-forget)
            this.sendTyping(chatId).catch(() => { });
            try {
                // Execute AI request with higher concurrency
                const aiReply = await queue_service_1.aiQueue.add(() => (0, geminiService_1.generateBotReply)(text, company.botBusinessType || "general business", structuredMenu, historyContext));
                // 🚨 CONCURRENCY FIX: Re-fetch conversation mode before sending!
                // If an Agent took over while AI was thinking, DO NOT SEND.
                const freshConv = await prisma_1.prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    select: { mode: true }
                });
                if (freshConv?.mode === "HUMAN") {
                    console.log(`⚠️ Skiping AI reply for ${chatId} - Mode switched to HUMAN during generation.`);
                    return;
                }
                await this.saveAndSendSystemMessage(chatId, conversation, aiReply);
            }
            catch (err) {
                console.error("AI Queue Error:", err);
            }
        }
        catch (err) {
            console.error("Telegram Process Error:", err);
        }
    }
    async saveAndSendSystemMessage(chatId, conversation, text) {
        // OPTIMIZATION: Run DB save and Telegram Send in Parallel
        const dbPromise = (async () => {
            const botMsg = await prisma_1.prisma.message.create({
                data: {
                    content: text,
                    sender: client_1.MessageSender.SYSTEM,
                    conversationId: conversation.id,
                },
            });
            (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
                conversationId: conversation.id,
                lastMessage: text,
                updatedAt: new Date(),
            });
            (0, socket_1.emitToConversation)(conversation.id, "new_message", botMsg);
        })();
        const telegramPromise = this.sendMessage(chatId, text);
        // Await both to ensure completion, but they run concurrently
        await Promise.all([dbPromise, telegramPromise]);
    }
}
exports.TelegramAdapter = TelegramAdapter;
