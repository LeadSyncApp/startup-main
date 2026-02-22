"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramAdapter = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const socket_1 = require("../lib/socket");
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
            this.sendTyping(psid).catch(() => { });
            try {
                const { handleBotMessage } = await Promise.resolve().then(() => __importStar(require("../bot/bot.logic")));
                const aiReply = await handleBotMessage(conversation.id, text, "text", "en-IN", // Simplified for IG for now
                "normal_message");
                if (!aiReply)
                    return;
                // Parse and send parts
                const parts = aiReply.split(/(?=MESSAGE:)/g).filter(p => p.trim());
                for (const part of parts) {
                    const lines = part.split("\n").map(l => l.trim());
                    let messageText = "";
                    let msgLines = [];
                    for (const line of lines) {
                        if (line.startsWith("BUTTON:") || line.startsWith("CALLBACK:")) {
                            // IG buttons are a bit different, for MVP we'll just send the text
                            // and maybe add button support later if needed.
                            continue;
                        }
                        else {
                            msgLines.push(line.replace(/^MESSAGE:/i, "").trim());
                        }
                    }
                    messageText = msgLines.filter(l => l !== "").join("\n");
                    if (messageText) {
                        await this.saveAndSendMessage(psid, conversation, messageText);
                    }
                }
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
