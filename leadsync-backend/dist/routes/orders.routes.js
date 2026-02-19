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
   GET ORDERS (Filtered)
================================== */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const view = req.query.view; // 'active' | 'history'
        let whereCondition = { companyId, isDeleted: false };
        if (view === "history") {
            // History: Completed, Delivered, Cancelled, Archived
            whereCondition.status = { in: ["DELIVERED", "COMPLETED", "CANCELLED", "ARCHIVED", "REJECTED"] };
        }
        else {
            // Active Board: Confirmed, Preparing, Ready
            // NOTE: We EXCLUDE 'PENDING' (Ghost orders) and 'NEW' (unless we want them on board immediately)
            // The user Requirement: "Orders must NOT auto-enter pipeline before claim"
            // So 'PENDING' orders are hidden here.
            // 'NEW' might be used for "Accepted but not started"?
            // Let's assume Active Board = [NEW, CONFIRMED, PREPARING, READY]
            whereCondition.status = {
                in: ["NEW", "CONFIRMED", "PREPARING", "READY"]
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
            orderBy: view === "history"
                ? [{ completedAt: "desc" }, { createdAt: "desc" }]
                : [{ priorityScore: "desc" }, { createdAt: "desc" }],
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
   APPROVE ORDER (Activates Pending)
================================== */
router.post("/:id/approve", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId;
        const existing = await prisma_1.prisma.order.findFirst({ where: { id, companyId } });
        if (!existing)
            return res.status(404).json({ message: "Order not found" });
        // Transition PENDING -> CONFIRMED (Active)
        const updated = await prisma_1.prisma.order.update({
            where: { id },
            data: {
                approvalStatus: client_1.OrderApprovalStatus.APPROVED,
                status: client_1.OrderStatus.CONFIRMED, // Moves to Active Board
                processedById: req.user.userId,
                priorityScore: { increment: 20 },
            },
            include: { lead: true, company: true, conversation: true }
        });
        // 1. Send Telegram Notification
        if (updated.company?.telegramBotToken && updated.lead?.contact) {
            (0, telegram_sender_1.sendTelegramMessage)(updated.company.telegramBotToken, updated.lead.contact, `✅ *Order Accepted!*\n\n${updated.summary}\nTotal: ₹${updated.amount}\n\nWe are preparing it now!`).catch(console.error);
        }
        // 2. Log in Chat History
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
   REJECT ORDER (Archives)
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
                completedAt: new Date(), // Mark as closed
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
   UPDATE STATUS (Lifecycle)
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
        // Handle Completion
        if (["DELIVERED", "COMPLETED", "CANCELLED"].includes(status)) {
            updateData.completedAt = new Date();
        }
        if (["DELIVERED", "READY", "COMPLETED"].includes(status)) {
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
/* ===============================
   SOFT DELETE ORDER
================================== */
router.delete("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.companyId;
        // Soft delete
        const updated = await prisma_1.prisma.order.updateMany({
            where: { id, companyId },
            data: { isDeleted: true }
        });
        if (updated.count === 0)
            return res.status(404).json({ message: "Order not found" });
        return res.json({ message: "Order archived" });
    }
    catch (error) {
        console.error("Delete order error:", error);
        return res.status(500).json({ message: "Failed to delete order" });
    }
});
exports.default = router;
