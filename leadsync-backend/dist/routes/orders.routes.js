"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const telegram_sender_1 = require("../bot/telegram.sender");
const router = (0, express_1.Router)();
/* ===============================
   CREATE MANUAL ORDER
=============================== */
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { conversationId, summary, priority, amount } = req.body;
        if (!conversationId || !summary) {
            return res.status(400).json({ message: "Missing fields" });
        }
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const conversation = await prisma_1.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                companyId: req.user.companyId,
            },
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        const order = await prisma_1.prisma.order.create({
            data: {
                companyId: req.user.companyId,
                conversationId: conversation.id,
                leadId: conversation.leadId,
                summary,
                priority: priority || client_1.OrderPriority.NORMAL,
                status: client_1.OrderStatus.NEW,
                amount: amount ?? 0,
                approvalStatus: client_1.OrderApprovalStatus.PENDING,
            },
        });
        return res.json(order);
    }
    catch (error) {
        console.error("Create order error:", error);
        return res.status(500).json({ message: "Failed to create order" });
    }
});
/* ===============================
   GET ORDERS
=============================== */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const companyId = req.user.companyId;
        let whereCondition = { companyId };
        if (req.user.role === client_1.Role.AGENT) {
            whereCondition = {
                companyId,
                OR: [
                    { approvalStatus: client_1.OrderApprovalStatus.PENDING },
                    { processedById: req.user.userId },
                ],
            };
        }
        const orders = await prisma_1.prisma.order.findMany({
            where: whereCondition,
            include: {
                lead: true,
                conversation: true,
                processedBy: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 50, // Added limit
        });
        return res.json(orders);
    }
    catch (error) {
        console.error("Fetch orders error:", error);
        return res.status(500).json({ message: "Failed to fetch orders" });
    }
});
/* ===============================
   APPROVE ORDER (RACE SAFE)
=============================== */
router.post("/:id/approve", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const updated = await prisma_1.prisma.order.updateMany({
            where: {
                id,
                companyId: req.user.companyId,
                approvalStatus: client_1.OrderApprovalStatus.PENDING,
            },
            data: {
                approvalStatus: client_1.OrderApprovalStatus.APPROVED,
                status: client_1.OrderStatus.CONFIRMED,
                processedById: req.user.userId,
            },
        });
        if (updated.count === 0) {
            return res.status(400).json({ message: "Order already processed" });
        }
        const order = await prisma_1.prisma.order.findUnique({
            where: { id },
            include: { lead: true, company: true },
        });
        // Telegram send should NEVER break approval
        if (order?.company.telegramBotToken && order.lead?.contact) {
            try {
                await (0, telegram_sender_1.sendTelegramMessage)(order.company.telegramBotToken, order.lead.contact, `✅ Your order has been approved!\n\n🛒 ${order.summary}\n\n💰 Total: ₹${order.amount}`);
            }
            catch (err) {
                console.error("Telegram send failed:", err);
            }
        }
        return res.json(order);
    }
    catch (error) {
        console.error("Approve order error:", error);
        return res.status(500).json({ message: "Failed to approve order" });
    }
});
/* ===============================
   REJECT ORDER (RACE SAFE)
=============================== */
router.post("/:id/reject", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const updated = await prisma_1.prisma.order.updateMany({
            where: {
                id,
                companyId: req.user.companyId,
                approvalStatus: client_1.OrderApprovalStatus.PENDING,
            },
            data: {
                approvalStatus: client_1.OrderApprovalStatus.REJECTED,
                status: client_1.OrderStatus.CANCELLED,
                processedById: req.user.userId,
            },
        });
        if (updated.count === 0) {
            return res.status(400).json({ message: "Order already processed" });
        }
        return res.json({ message: "Order rejected" });
    }
    catch (error) {
        console.error("Reject order error:", error);
        return res.status(500).json({ message: "Failed to reject order" });
    }
});
/* ===============================
   UPDATE ORDER STATUS (SAFE)
=============================== */
router.patch("/:id/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { status, amount } = req.body;
        const { id } = req.params;
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const updated = await prisma_1.prisma.order.updateMany({
            where: {
                id,
                companyId: req.user.companyId,
            },
            data: {
                status,
                ...(status === client_1.OrderStatus.DELIVERED && {
                    processedById: req.user.userId,
                    amount: amount ?? undefined,
                }),
            },
        });
        if (updated.count === 0) {
            return res.status(404).json({ message: "Order not found" });
        }
        const order = await prisma_1.prisma.order.findUnique({ where: { id } });
        return res.json(order);
    }
    catch (error) {
        console.error("Update order error:", error);
        return res.status(500).json({ message: "Failed to update order" });
    }
});
exports.default = router;
