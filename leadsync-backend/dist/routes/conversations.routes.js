"use strict";
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
        const companyId = req.user.companyId;
        const conversations = await prisma_1.prisma.conversation.findMany({
            where: { companyId },
            orderBy: { updatedAt: "desc" },
            take: 20, // Reduced to 20 for faster initial load
            select: {
                id: true,
                mode: true,
                updatedAt: true,
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
        res.json(conversations.map((c) => ({
            id: c.id,
            mode: c.mode,
            lead: c.lead,
            updatedAt: c.updatedAt,
            lastMessage: c.messages[0]?.content || "",
        })));
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
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: req.params.id,
                companyId,
            },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
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
            },
        });
        res.json({
            mode: conversation.mode,
            messages,
            order: latestOrder || null,
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
        const message = await prisma_1.prisma.message.create({
            data: {
                content: content.trim(),
                sender: client_1.MessageSender.AGENT,
                conversationId: conversation.id,
            },
        });
        // ✅ MODE REMOVED: Do not auto-switch to HUMAN.
        // Respect the manual toggle from the site to allow 24/7 bot service.
        await prisma_1.prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                updatedAt: new Date(),
            },
        });
        if (conversation.company.telegramBotToken) {
            // Fire-and-forget: Don't await
            (0, telegram_sender_1.sendTelegramMessage)(conversation.company.telegramBotToken, conversation.lead.contact, content.trim()).catch(console.error);
        }
        // ✅ REAL-TIME SOCKET EMISSION
        // 1. Notify company for list updates
        (0, socket_1.emitToCompany)(companyId, "conversation_updated", {
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
        // ✅ REAL-TIME SOCKET EMISSION (Immediate Mode Sync)
        (0, socket_1.emitToCompany)(companyId, "mode_changed", {
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
exports.default = router;
