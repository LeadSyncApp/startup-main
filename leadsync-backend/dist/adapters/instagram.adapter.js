"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramAdapter = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const socket_1 = require("../lib/socket");
const geminiService_1 = require("../services/geminiService");
const queue_service_1 = require("../services/queue.service");
const cache_service_1 = require("../services/cache.service");
const intelligence_service_1 = require("../services/intelligence.service");
const orderParser_service_1 = require("../services/orderParser.service");
const notification_service_1 = require("../services/notification.service");
/* ===============================
   INSTAGRAM ADAPTER
 =============================== */
class InstagramAdapter {
    constructor(pageAccessToken) {
        this.pageAccessToken = pageAccessToken;
        this.GRAPH_URL = "https://graph.facebook.com/v17.0";
    }
    async verifyWebhook(req) {
        // Facebook verification is handled in the GET /webhook route
        return true;
    }
    async sendMessage(to, text, options) {
        if (!this.pageAccessToken)
            return;
        try {
            await axios_1.default.post(`${this.GRAPH_URL}/me/messages?access_token=${this.pageAccessToken}`, {
                recipient: { id: to },
                message: { text }
            });
        }
        catch (error) {
            console.error("❌ Instagram API error:", error?.response?.data || error.message);
        }
    }
    async sendTyping(to) {
        if (!this.pageAccessToken)
            return;
        try {
            await axios_1.default.post(`${this.GRAPH_URL}/me/messages?access_token=${this.pageAccessToken}`, {
                recipient: { id: to },
                sender_action: "typing_on"
            });
        }
        catch (e) { }
    }
    /**
     * Entry Point from Instagram Webhook
     */
    async processWebhook(event, companyId) {
        try {
            const psid = event.sender.id;
            const text = event.message?.text?.trim();
            if (!text)
                return;
            // 1. Fetch Company
            let company = cache_service_1.cacheService.get(cache_service_1.cacheService.getCompanyKey(companyId));
            if (!company) {
                company = await prisma_1.prisma.company.findUnique({ where: { id: companyId } });
                if (company)
                    cache_service_1.cacheService.set(cache_service_1.cacheService.getCompanyKey(companyId), company);
            }
            if (!company || !company.instagramPageAccessToken)
                return;
            this.pageAccessToken = company.instagramPageAccessToken;
            this.sendTyping(psid).catch(() => { });
            /* FIND / CREATE LEAD */
            let lead = await prisma_1.prisma.lead.findFirst({
                where: { contact: psid, channel: client_1.Channel.INSTAGRAM, companyId },
            });
            if (!lead) {
                // For Instagram, we might need a separate call to FB Graph API to get the user's name
                // For now, defaulting to "Instagram User"
                lead = await prisma_1.prisma.lead.create({
                    data: { name: "Instagram User", contact: psid, channel: client_1.Channel.INSTAGRAM, companyId },
                });
                (0, socket_1.emitToCompany)(companyId, "lead_created", lead);
            }
            /* FIND / CREATE CONVERSATION */
            let conversation = await prisma_1.prisma.conversation.findUnique({
                where: {
                    leadId_companyId_channel: {
                        leadId: lead.id,
                        companyId,
                        channel: client_1.Channel.INSTAGRAM,
                    },
                },
            });
            if (!conversation) {
                conversation = await prisma_1.prisma.conversation.create({
                    data: {
                        leadId: lead.id,
                        companyId,
                        channel: client_1.Channel.INSTAGRAM,
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
                    createdAt: { gt: new Date(Date.now() - 1000 * 10) } // 10s dedupe
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
            // 🧠 INTELLIGENCE
            intelligence_service_1.intelligenceService.analyzeMessage(companyId, lead.id, conversation.id, text).catch(() => { });
            // 🔔 NOTIFICATION
            const notifyBody = `IG: ${text.length > 50 ? text.slice(0, 50) + "..." : text}`;
            if (conversation.assignedToId) {
                notification_service_1.notificationService.notifyUser(conversation.assignedToId, "New Message", notifyBody, "MESSAGE");
            }
            else {
                notification_service_1.notificationService.notifyCompanyAdmins(companyId, "New Unassigned Message", notifyBody, "MESSAGE");
            }
            // 🍔 ORDER DETECTION
            orderParser_service_1.orderParserService.processPotentialOrder(companyId, conversation.id, lead.id, text, company.botStructuredMenu).catch(() => { });
            if (conversation.mode === client_1.ConversationMode.HUMAN)
                return;
            /* AI REPLY */
            const history = await prisma_1.prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: 5,
            });
            const historyContext = history.reverse().map(m => ({
                role: m.sender === client_1.MessageSender.CLIENT ? "user" : "assistant",
                content: m.content
            }));
            try {
                const aiReply = await queue_service_1.aiQueue.add(() => (0, geminiService_1.generateBotReply)(text, company.name, company.botBusinessType || "general business", company.botStructuredMenu, historyContext));
                // 🚨 PARSE RESPONSE (TEXT_REPLY: / VOICE_TTS:)
                let displayMessage = aiReply;
                if (aiReply.includes("TEXT_REPLY:")) {
                    const lines = aiReply.split("\n");
                    const textLine = lines.find(l => l.startsWith("TEXT_REPLY:"));
                    if (textLine) {
                        displayMessage = textLine.replace("TEXT_REPLY:", "").trim();
                    }
                }
                else if (aiReply.trim().startsWith('{')) {
                    // Legacy JSON fallback
                    try {
                        const parsed = JSON.parse(aiReply);
                        displayMessage = parsed.message_to_customer || parsed.response_text || aiReply;
                    }
                    catch (e) { }
                }
                // Final mode check
                const freshConv = await prisma_1.prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    select: { mode: true }
                });
                if (freshConv?.mode === "HUMAN")
                    return;
                await this.saveAndSendMessage(psid, conversation, displayMessage);
            }
            catch (err) {
                console.error("AI Error (IG):", err);
            }
        }
        catch (err) {
            console.error("Instagram Process Error:", err);
        }
    }
    async saveAndSendMessage(psid, conversation, text) {
        const botMsgPromise = prisma_1.prisma.message.create({
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
        const igPromise = this.sendMessage(psid, text);
        await Promise.all([botMsgPromise, igPromise]);
    }
}
exports.InstagramAdapter = InstagramAdapter;
