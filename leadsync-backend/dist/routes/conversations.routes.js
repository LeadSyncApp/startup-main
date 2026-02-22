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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prisma_1 = require("../lib/prisma");
const telegram_sender_1 = require("../bot/telegram.sender");
const client_1 = require("@prisma/client");
const socket_1 = require("../lib/socket");
const router = (0, express_1.Router)();
/* =========================================
   GET ALL CONVERSATIONS
========================================= */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { companyId, userId, role } = req.user;
        // 🔒 PRIVACY FILTER: Agents only see Unclaimed OR Their Own
        const whereClause = { companyId };
        if (role === "AGENT") {
            whereClause.OR = [
                { assignedToId: null },
                { assignedToId: userId }
            ];
        }
        const conversations = await prisma_1.prisma.conversation.findMany({
            where: whereClause,
            orderBy: [
                { priorityScore: "desc" }, // 💰 High Value / Urgent First
                { updatedAt: "desc" } // Recent activity second
            ],
            take: 21, // Fetch 1 extra to determine if next page exists
            cursor: req.query.cursor ? { id: String(req.query.cursor) } : undefined,
            select: {
                id: true,
                mode: true,
                updatedAt: true,
                intent: true,
                priorityScore: true, // Needed for UI badge
                lead: {
                    select: {
                        name: true,
                        contact: true,
                        channel: true,
                    }
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                        content: true,
                    }
                }
            }
        });
        const hasNextPage = conversations.length > 20;
        const result = hasNextPage ? conversations.slice(0, 20) : conversations;
        const nextCursor = hasNextPage ? result[result.length - 1].id : null;
        res.json({
            items: result.map((c) => ({
                id: c.id,
                mode: c.mode,
                intent: c.intent,
                lead: c.lead,
                updatedAt: c.updatedAt,
                lastMessage: c.messages[0]?.content || "",
            })),
            nextCursor
        });
    }
    catch (error) {
        console.error("Fetch conversations error:", error);
        res.status(500).json({ message: "Failed to fetch conversations" });
    }
});
/* =========================================
   GET MESSAGES + LATEST ORDER
========================================= */
router.get("/:id/messages", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const userId = req.user.userId; // Authenticated user
        const userRole = req.user.role; // Role
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: req.params.id,
                companyId,
            },
            include: {
                assignedTo: { select: { id: true, name: true } }
            }
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        // 🔒 STRICT PRIVACY: Prevent agents from peeking at others' conversations
        if (userRole === "AGENT" && conversation.assignedToId && conversation.assignedToId !== userId) {
            return res.status(403).json({ message: "⛔ Access Denied: This conversation is assigned to another agent." });
        }
        const messages = await prisma_1.prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                content: true,
                sender: true,
                createdAt: true,
            }
        });
        // Reverse to show oldest first in UI
        messages.reverse();
        const latestOrder = await prisma_1.prisma.order.findFirst({
            where: {
                conversationId: conversation.id,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                summary: true,
                amount: true,
                approvalStatus: true,
                status: true,
                version: true,
                priority: true,
                isUrgent: true,
            },
        });
        res.json({
            mode: conversation.mode,
            messages,
            order: latestOrder || null,
            isLocked: conversation.assignedToId && conversation.assignedToId !== userId && userRole === "AGENT",
            assignedTo: conversation.assignedTo,
            sessionState: conversation.sessionState
        });
    }
    catch (error) {
        console.error("Fetch messages error:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
    }
});
/* =========================================
   AGENT SEND MESSAGE
========================================= */
router.post("/:id/send", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        const companyId = req.user.companyId;
        const userId = req.user.userId;
        const userRole = req.user.role;
        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Message content required" });
        }
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: req.params.id,
                companyId,
            },
            include: {
                lead: true,
                company: true,
            },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        // ENFORCE LOCK
        if (conversation.assignedToId && conversation.assignedToId !== userId && userRole === "AGENT") {
            return res.status(403).json({ message: "Conversation is locked by another agent." });
        }
        const message = await prisma_1.prisma.message.create({
            data: {
                content: content.trim(),
                sender: client_1.MessageSender.AGENT,
                conversationId: conversation.id,
            },
        });
        // NOTE: Auto-switch removed as per user request. Mode strictly manual.
        if (conversation.company.telegramBotToken) {
            // Fire-and-forget: Don't await
            (0, telegram_sender_1.sendTelegramMessage)(conversation.company.telegramBotToken, conversation.lead.contact, content.trim()).catch(console.error);
        }
        // ✅ SECURE REAL-TIME EMISSION
        // Intelligent routing: Only to Assigned + Admins
        (0, socket_1.safeEmitConversationUpdate)(conversation, "conversation_updated", {
            conversationId: conversation.id,
            lastMessage: content.trim(),
            updatedAt: new Date(),
        });
        // 2. Notify specific conversation for active chat real-time feel
        (0, socket_1.emitToConversation)(conversation.id, "new_message", message);
        res.json({
            ...message,
            mode: conversation.mode,
        });
    }
    catch (error) {
        console.error("Agent send error:", error);
        res.status(500).json({ message: "Failed to send message" });
    }
});
/* =========================================
   TOGGLE MODE
========================================= */
router.patch("/:id/mode", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { mode } = req.body;
        const companyId = req.user.companyId;
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: req.params.id,
                companyId,
            },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        const updated = await prisma_1.prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                mode,
                updatedAt: new Date(),
            },
        });
        // ✅ SECURE REAL-TIME EMISSION
        (0, socket_1.safeEmitConversationUpdate)(updated, "status_changed", {
            conversationId: conversation.id,
            mode
        });
        // Create a system message so it appears instantly in the chat
        const systemMsg = await prisma_1.prisma.message.create({
            data: {
                content: `Chat mode switched to ${mode}`,
                sender: client_1.MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        });
        (0, socket_1.emitToConversation)(conversation.id, "new_message", systemMsg);
        res.json(updated);
    }
    catch (error) {
        console.error("Mode toggle error:", error);
        res.status(500).json({ message: "Failed to update mode" });
    }
});
/* =========================================
   CLEAR HISTORY
   Deletes all messages for a conversation
========================================= */
router.delete("/:id/messages", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: req.params.id,
                companyId,
            },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        // Delete all messages associated with this conversation
        await prisma_1.prisma.message.deleteMany({
            where: { conversationId: conversation.id },
        }).catch(err => console.log("Nothing to delete or already empty"));
        // Add a system message to indicate history was cleared
        const systemMsg = await prisma_1.prisma.message.create({
            data: {
                content: "Chat history was cleared by the agent.",
                sender: client_1.MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        });
        // ✅ REAL-TIME SOCKET EMISSION
        (0, socket_1.emitToConversation)(conversation.id, "messages_cleared", systemMsg);
        res.json({ message: "History cleared successfully" });
    }
    catch (error) {
        console.error("Clear history error:", error);
        res.status(500).json({ message: "Failed to clear history" });
    }
});
/* =========================================
   ASSIGN AGENT (Shared Inbox)
========================================= */
router.patch("/:id/assign", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { assignedToId } = req.body; // userId or null to unassign
        const companyId = req.user.companyId;
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: { id: req.params.id, companyId },
        });
        if (!conversation)
            return res.status(404).json({ message: "Conversation not found" });
        // Update assignment - forceful cast to avoid IDE type errors
        let updatedCalls;
        if (assignedToId) {
            // ✅ ATOMIC CLAIM: Only update if assignedToId is currently NULL
            const result = await prisma_1.prisma.conversation.updateMany({
                where: {
                    id: conversation.id,
                    assignedToId: null // 🔒 Lock: Must be unclaimed
                },
                data: {
                    assignedToId,
                    status: "ASSIGNED",
                    updatedAt: new Date()
                }
            });
            if (result.count === 0) {
                // Claim failed. Check why.
                const fresh = await prisma_1.prisma.conversation.findUnique({ where: { id: conversation.id } });
                if (fresh?.assignedToId === assignedToId) {
                    // Already assigned to me (idempotent success)
                    updatedCalls = fresh;
                }
                else {
                    return res.status(409).json({ message: "⚠️ Too late! This conversation was just claimed by another agent." });
                }
            }
            else {
                // Fetch the updated record
                updatedCalls = await prisma_1.prisma.conversation.findUnique({
                    where: { id: conversation.id },
                    include: { assignedTo: { select: { id: true, name: true } } }
                });
            }
        }
        else {
            // UNASSIGN (Release)
            updatedCalls = await prisma_1.prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    assignedToId: null,
                    status: "OPEN",
                    updatedAt: new Date(),
                },
                include: { assignedTo: { select: { id: true, name: true } } }
            });
        }
        const updated = updatedCalls;
        if (assignedToId) {
            // CASE: CLAIMING (Assigning)
            // 1. Notify public channel to REMOVE it from their list (Privacy)
            (0, socket_1.emitToCompany)(companyId, "conversation_removed", { conversationId: conversation.id });
            // 2. Notify specific agent that they got it
            (0, socket_1.emitToAgent)(assignedToId, "conversation_added", updated);
        }
        else {
            // CASE: UNASSIGNING (Releasing)
            // 1. Notify public channel to ADD it back to everyone's list
            (0, socket_1.emitToCompany)(companyId, "conversation_added", updated);
        }
        // 3. Always notify Admins
        (0, socket_1.emitToCompanyAdmin)(companyId, "conversation_updated", updated);
        // System message
        const agentName = updated.assignedTo?.name || "System";
        const statusText = assignedToId ? `assigned to ${agentName}` : "unassigned";
        const sysMsg = await prisma_1.prisma.message.create({
            data: {
                content: `Conversation was ${statusText}.`,
                sender: client_1.MessageSender.SYSTEM,
                conversationId: conversation.id,
            }
        });
        (0, socket_1.emitToConversation)(conversation.id, "new_message", sysMsg);
        res.json(updated);
    }
    catch (error) {
        console.error("Assign error:", error);
        res.status(500).json({ message: "Assignment failed" });
    }
});
/* =========================================
   UPDATE STATUS (Resolved/Open)
========================================= */
router.patch("/:id/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { status } = req.body; // OPEN, RESOLVED, SNOOZED
        const companyId = req.user.companyId;
        // Explicit valid statuses
        const validStatuses = ["OPEN", "ASSIGNED", "RESOLVED", "SNOOZED"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: { id: req.params.id, companyId },
        });
        if (!conversation)
            return res.status(404).json({ message: "Conversation not found" });
        // Forceful cast
        const updated = await prisma_1.prisma.conversation.update({
            where: { id: conversation.id },
            data: { status, updatedAt: new Date() }
        });
        (0, socket_1.safeEmitConversationUpdate)(updated, "status_changed", {
            conversationId: conversation.id,
            status
        });
        res.json(updated);
    }
    catch (error) {
        console.error("Status update error:", error);
        res.status(500).json({ message: "Failed to update status" });
    }
});
/* =========================================
   VOICE REPLY — Agent triggers TTS voice message to customer
   POST /conversations/:id/voice-reply
   Body: { messageId?: string }  (optional: for context)
========================================= */
router.post("/:id/voice-reply", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.user;
        // Fetch conversation + lead contact + company token
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: { id, companyId },
            include: {
                lead: { select: { contact: true } },
                company: { select: { telegramBotToken: true } },
            },
        });
        if (!conversation)
            return res.status(404).json({ message: "Conversation not found" });
        if (!conversation.company.telegramBotToken)
            return res.status(400).json({ message: "Telegram not connected" });
        // Get last SYSTEM (bot) reply to convert to voice
        const lastBotMsg = await prisma_1.prisma.message.findFirst({
            where: { conversationId: id, sender: client_1.MessageSender.SYSTEM },
            orderBy: { createdAt: "desc" },
        });
        if (!lastBotMsg)
            return res.status(404).json({ message: "No bot reply found to convert to voice" });
        const { sarvamService } = await Promise.resolve().then(() => __importStar(require("../services/sarvam.service")));
        const { TelegramAdapter } = await Promise.resolve().then(() => __importStar(require("../adapters/telegram.adapter")));
        const audioBuffer = await sarvamService.textToSpeech(lastBotMsg.content, "en-IN");
        if (!audioBuffer)
            return res.status(503).json({ message: "TTS generation failed. Try again." });
        const adapter = new TelegramAdapter(conversation.company.telegramBotToken);
        await adapter.sendVoice(conversation.lead.contact, audioBuffer);
        console.log(`🔊 Agent voice reply sent to ${conversation.lead.contact}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error("Voice reply error:", error);
        res.status(500).json({ message: "Failed to send voice reply" });
    }
});
exports.default = router;
