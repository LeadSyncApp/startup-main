"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prisma_1 = require("../lib/prisma");
const telegram_sender_1 = require("../bot/telegram.sender");
const client_1 = require("@prisma/client");
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
            take: 50, // LIMIT to prevent 20s load times
            include: {
                lead: true,
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        res.json(conversations.map((c) => ({
            id: c.id,
            mode: c.mode,
            lead: c.lead,
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
            orderBy: { createdAt: "desc" }, // Fetch newest first
            take: 50,
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
        res.json({
            ...message,
            mode: client_1.ConversationMode.HUMAN,
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
        res.json(updated);
    }
    catch (error) {
        console.error("Mode toggle error:", error);
        res.status(500).json({ message: "Failed to update mode" });
    }
});
exports.default = router;
