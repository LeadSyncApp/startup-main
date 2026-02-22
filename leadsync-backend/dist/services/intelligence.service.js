"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceService = exports.IntelligenceService = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const socket_1 = require("../lib/socket");
// Initialize Groq
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY || "dummy" });
class IntelligenceService {
    /**
     * Analyzes a new message to update Conversation context.
     * Runs in the background (fire-and-forget).
     */
    async analyzeMessage(companyId, leadId, conversationId, messageText) {
        try {
            // Only analyze meaningful messages > 5 chars to save AI calls
            if (messageText.length < 5)
                return;
            // 1. AI Analysis (Sentiment & Intent)
            const analysis = await this.performAIAnalysis(messageText);
            // 2. Intelligence Logic: Determine if we should Auto-Assign
            const isHighIntent = analysis.intent === "ORDERING" || analysis.intent === "COMPLAINT";
            const isUrgent = analysis.sentimentDelta <= -2; // Negative sentiment
            let assignedUserId = null;
            let assignedUserName = null;
            // Only auto-assign if currently unassigned and important
            if (isHighIntent || isUrgent) {
                // Force cast to access `assignedToId`
                const existing = await prisma_1.prisma.conversation.findUnique({
                    where: { id: conversationId },
                    select: { assignedToId: true }
                });
                if (existing && !existing.assignedToId) {
                    // FIND BEST AGENT (First Available Active Agent)
                    // Fallback to sorting by creation since lastActiveAt might not exist on User schema
                    const agent = await prisma_1.prisma.user.findFirst({
                        where: { companyId, isActive: true },
                        orderBy: { createdAt: 'asc' } // Assign to oldest agent/admin first (often the owner)
                    });
                    if (agent) {
                        assignedUserId = agent.id;
                        assignedUserName = agent.name;
                    }
                }
            }
            // 3. Database Updates (Transaction)
            await prisma_1.prisma.$transaction(async (tx) => {
                // Update Conversation
                const updateData = {
                    sentimentScore: { increment: analysis.sentimentDelta },
                    updatedAt: new Date(),
                };
                // CRITICAL: Don't overwrite ORDERING intent with BROWSING/SUPPORT
                // This prevents Intelligence from wiping out what OrderParser detected
                const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
                if (analysis.intent === 'ORDERING' || (conversation && conversation.intent !== 'ORDERING')) {
                    updateData.intent = analysis.intent;
                }
                // Apply Auto-Assignment if triggered
                if (assignedUserId) {
                    updateData.assignedToId = assignedUserId;
                    updateData.status = "ASSIGNED";
                }
                const updatedRaw = await tx.conversation.update({
                    where: { id: conversationId },
                    data: updateData,
                    include: { assignedTo: { select: { id: true, name: true } } }
                });
                const updatedConversation = updatedRaw;
                // Update Lead Activity
                await tx.lead.update({
                    where: { id: leadId },
                    data: { lastActiveAt: new Date() }
                });
                const socketData = {
                    conversationId: updatedConversation.id,
                    lastMessage: messageText,
                    updatedAt: updatedConversation.updatedAt,
                    intent: updatedConversation.intent
                };
                // 4. Notifications & Side Effects
                if (assignedUserId) {
                    // System Message
                    const sysMsg = await tx.message.create({
                        data: {
                            conversationId,
                            sender: client_1.MessageSender.SYSTEM,
                            content: `⚡ AI detected ${analysis.intent}. Auto-assigned to ${assignedUserName}.`
                        }
                    });
                    // Emit Socket Events (Securely)
                    // 1. Remove from Public Unclaimed List
                    (0, socket_1.emitToCompany)(companyId, "conversation_removed", { conversationId });
                    // 2. Add to Agent's Private List
                    (0, socket_1.emitToAgent)(assignedUserId, "conversation_added", updatedConversation);
                    (0, socket_1.emitToConversation)(conversationId, "new_message", sysMsg);
                }
                // 3. Update Admin View (Always sync intent/status)
                (0, socket_1.emitToCompanyAdmin)(companyId, "conversation_updated", socketData);
            });
            console.log(`🧠 [Intelligence] Analyzed intent=${analysis.intent}, sentiment=${analysis.sentimentDelta}, assigned=${assignedUserId ? 'YES' : 'NO'}`);
        }
        catch (error) {
            console.error("❌ Intelligence Analysis Failed:", error);
        }
    }
    async performAIAnalysis(text) {
        try {
            // ... existing AI logic (unchanged) ...
            // CRITICAL OVERRIDE: Local regex check for absolute priority
            const lowerText = text.toLowerCase().trim();
            const orderKeywords = ["want", "order", "venum", "chahiye", "book", "onnu", "rendu", "moonu", "naalu", "dena", "vangi", "idly", "dosa", "coffee", "tea", "biryani", "appointment", "tracksuit", "shirt"];
            const hasQuantity = /\d+/.test(lowerText);
            // If it looks like an order, we return immediately with ORDERING intent
            if (orderKeywords.some(kw => lowerText.includes(kw)) || (hasQuantity && lowerText.length > 3)) {
                return { sentimentDelta: 0, intent: "ORDERING" };
            }
            if (!process.env.GROQ_API_KEY)
                return { sentimentDelta: 0, intent: "BROWSING" };
            const response = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Analyze the user message for intent and sentiment.
Context: LeadSync Real-time Ordering & Support Assistant.

STRICT INTENT PRIORITY:
If message contains:
- quantity + item/service (e.g., "4 dosa", "2 kg apple")
- ordering keywords: "want", "order", "venum", "chahiye", "book", "dena", "vangi"
THEN intent = "ORDERING".

Rules:
- sentiment: -5 (Angry) to +5 (Happy). 0 is neutral.
- intent: "ORDERING", "SUPPORT", "COMPLAINT", "BROWSING"
- If intent matches "ORDERING" keywords, NEVER classify as "BROWSING".

Format: {"sentiment": number, "intent": string}
`
                    },
                    { role: "user", content: text }
                ],
                model: "llama-3.1-8b-instant",
                temperature: 0,
                max_tokens: 60,
                response_format: { type: "json_object" }
            });
            const content = response.choices[0]?.message?.content || "{}";
            const result = JSON.parse(content);
            let safeIntent = result.intent?.toUpperCase();
            if (!["BROWSING", "ORDERING", "SUPPORT", "COMPLAINT"].includes(safeIntent)) {
                safeIntent = "BROWSING";
            }
            return {
                sentimentDelta: result.sentiment || 0,
                intent: safeIntent
            };
        }
        catch (e) {
            return { sentimentDelta: 0, intent: "BROWSING" };
        }
    }
}
exports.IntelligenceService = IntelligenceService;
exports.intelligenceService = new IntelligenceService();
