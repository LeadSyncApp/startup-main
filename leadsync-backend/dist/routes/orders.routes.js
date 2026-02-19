"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const telegram_sender_1 = require("../bot/telegram.sender");
const socket_1 = require("../lib/socket");
const router = (0, express_1.Router)();
/* ===============================
   CREATE ORDER
================================== */
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { conversationId, summary, priority, amount, isUrgent } = req.body;
        if (!conversationId || !summary) {
            return res.status(400).json({ message: "Missing fields" });
        }
        const companyId = req.user.companyId;
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: { id: conversationId, companyId },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        let initialScore = 0;
        if (priority === "URGENT" || isUrgent)
            initialScore += 50;
        if (amount && amount > 5000)
            initialScore += 30;
        // Force cast to allow new fields
        const order = await prisma_1.prisma.order.create({
            data: {
                companyId,
                conversationId: conversation.id,
                leadId: conversation.leadId,
                summary,
                priority: priority || client_1.OrderPriority.NORMAL,
                status: client_1.OrderStatus.NEW,
                amount: amount ?? 0,
                approvalStatus: client_1.OrderApprovalStatus.PENDING,
                isUrgent: isUrgent || false,
                priorityScore: initialScore,
                predictedValue: amount,
            },
            include: {
                lead: { select: { name: true, contact: true } }
            }
        });
        (0, socket_1.safeEmitConversationUpdate)(conversation, "order_created", order);
        return res.json(order);
    }
    catch (error) {
        console.error("Create order error:", error);
        return res.status(500).json({ message: "Failed to create order" });
    }
});
/* ===============================
   GET ORDERS
================================== */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const view = req.query.view; // 'active' | 'history'
        let whereCondition = { companyId };
        if (view === "history") {
            whereCondition.status = { in: ["DELIVERED", "CANCELLED", "REJECTED"] };
        }
        else {
            // Default: Active
            whereCondition.status = {
                in: ["NEW", "CONFIRMED", "PREPARING", "READY"],
                notIn: ["DELIVERED", "CANCELLED"] // Extra safety
            };
        }
        const orders = await prisma_1.prisma.order.findMany({
            where: whereCondition,
            include: {
                lead: {
                    select: {
                        id: true,
                        name: true,
                        contact: true,
                        channel: true,
                        totalSpend: true,
                        segment: true,
                    }
                },
                processedBy: {
                    select: { id: true, name: true }
                },
            },
            orderBy: [
                { priorityScore: "desc" },
                { createdAt: "desc" }
            ],
            take: 100,
        });
        return res.json(orders);
    }
    catch (error) {
        console.error("Fetch orders error:", error);
        return res.status(500).json({ message: "Failed to fetch orders" });
    }
});
/* ===============================
   APPROVE ORDER
================================== */
router.post("/:id/approve", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId;
        const existing = await prisma_1.prisma.order.findFirst({ where: { id, companyId } });
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
        // Force cast update
        const updatedRaw = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                approvalStatus: client_1.OrderApprovalStatus.APPROVED,
                status: client_1.OrderStatus.CONFIRMED,
                processedById: req.user.userId,
                priorityScore: { increment: 10 },
            },
            include: { lead: true, company: true, conversation: true }
        });
        const updated = updatedRaw;
        // 1. Send Telegram Notification
        if (updated.company?.telegramBotToken && updated.lead?.contact) {
            (0, telegram_sender_1.sendTelegramMessage)(updated.company.telegramBotToken, updated.lead.contact, `✅ *Order Accepted!*\n\n${updated.summary}\nTotal: ₹${updated.amount}\n\nWe are preparing it now!`).catch(console.error);
        }
        // 2. Log in Chat History (System Message)
        await prisma_1.prisma.message.create({
            data: {
                conversationId: existing.conversationId,
                sender: client_1.MessageSender.SYSTEM,
                content: `Order accepted by ${req.user.userId === updated.processedById ? 'Agent' : 'System'}. Status: PREPARING.`
            }
        });
        (0, socket_1.safeEmitConversationUpdate)(updated.conversation, "order_updated", updated);
        return res.json(updated);
    }
    catch (error) {
        console.error("Approve error:", error);
        return res.status(500).json({ message: "Failed to approve order" });
    }
});
/* ===============================
   REJECT ORDER
================================== */
router.post("/:id/reject", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId;
        const existing = await prisma_1.prisma.order.findFirst({ where: { id, companyId } });
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
        const updated = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                approvalStatus: client_1.OrderApprovalStatus.REJECTED,
                status: client_1.OrderStatus.CANCELLED,
                processedById: req.user.userId,
                priorityScore: 0,
            },
            include: { lead: true, company: true, conversation: true }
        });
        // 1. Send Telegram Notification
        if (updated.company?.telegramBotToken && updated.lead?.contact) {
            (0, telegram_sender_1.sendTelegramMessage)(updated.company.telegramBotToken, updated.lead.contact, `❌ *Order Update*\n\nUnfortunately, your order for ${updated.summary} could not be accepted at this time.`).catch(console.error);
        }
        // 2. Log in Chat History
        await prisma_1.prisma.message.create({
            data: {
                conversationId: existing.conversationId,
                sender: client_1.MessageSender.SYSTEM,
                content: `Order was rejected/cancelled.`
            }
        });
        (0, socket_1.safeEmitConversationUpdate)(updated.conversation, "order_updated", updated);
        return res.json(updated);
    }
    catch (error) {
        console.error("Reject error:", error);
        return res.status(500).json({ message: "Failed to reject order" });
    }
});
/* ===============================
   UPDATE STATUS / PRIORITY
================================== */
router.patch("/:id/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { status, priorityScore, isUrgent } = req.body;
        const { id } = req.params;
        const companyId = req.user.companyId;
        const existing = await prisma_1.prisma.order.findFirst({ where: { id, companyId } });
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
        const updateData = { status };
        if (priorityScore !== undefined)
            updateData.priorityScore = priorityScore;
        if (isUrgent !== undefined)
            updateData.isUrgent = isUrgent;
        if (status === "DELIVERED" || status === "READY") {
            if (!existing.processedById)
                updateData.processedById = req.user.userId;
        }
        const updated = await prisma_1.prisma.order.update({
            where: { id },
            data: updateData,
            include: { conversation: true }
        });
        const updatedWithConv = updated;
        (0, socket_1.safeEmitConversationUpdate)(updatedWithConv.conversation, "order_updated", updated);
        return res.json(updated);
    }
    catch (error) {
        console.error("Update status error:", error);
        return res.status(500).json({ message: "Failed to update order" });
    }
});
exports.default = router;
