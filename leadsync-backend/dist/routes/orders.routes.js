"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
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
            // History: Completed, Delivered, Cancelled, Archived, Shipped
            whereCondition.status = { in: ["DELIVERED", "COMPLETED", "CANCELLED", "ARCHIVED", "REJECTED", "SHIPPED"] };
        }
        else {
            // Active Board: Include all non-terminal stages
            whereCondition.status = {
                in: ["NEW", "PENDING", "BOT_CREATED_ORDER", "CONFIRMED", "PROCESSING", "PREPARING", "READY"]
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
                        // ...
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
const orderWorkflow_service_1 = require("../services/orderWorkflow.service");
/* ===============================
   APPROVE ORDER (Activates Pending)
================================== */
router.post("/:id/approve", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { version } = req.body; // Optimistic Lock
        const companyId = req.user.companyId;
        const result = await orderWorkflow_service_1.orderWorkflowService.transitionStatus(id, client_1.OrderStatus.PROCESSING, // 🆕 Move to PROCESSING (Active)
        {
            id: req.user.userId,
            name: "Agent",
            role: req.user.role
        }, version);
        return res.json(result.order);
    }
    catch (error) {
        if (error.message?.includes("CONCURRENCY")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Approve error:", error);
        return res.status(500).json({ message: error.message || "Failed to approve order" });
    }
});
/* ===============================
   REJECT ORDER (Archives)
================================== */
router.post("/:id/reject", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { version } = req.body;
        const result = await orderWorkflow_service_1.orderWorkflowService.transitionStatus(id, client_1.OrderStatus.REJECTED, {
            id: req.user.userId,
            name: "Agent",
            role: req.user.role
        }, version);
        return res.json(result.order);
    }
    catch (error) {
        if (error.message?.includes("CONCURRENCY")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Reject error:", error);
        return res.status(500).json({ message: error.message || "Failed to reject order" });
    }
});
/* ===============================
   UPDATE STATUS (Lifecycle)
================================== */
router.patch("/:id/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { status, version } = req.body; // Now expects status AND version
        const { id } = req.params;
        const result = await orderWorkflow_service_1.orderWorkflowService.transitionStatus(id, status, {
            id: req.user.userId,
            name: "Agent",
            role: req.user.role
        }, version);
        return res.json(result.order);
    }
    catch (error) {
        if (error.message?.includes("Invalid transition")) {
            return res.status(400).json({ message: error.message });
        }
        if (error.message?.includes("CONCURRENCY")) {
            return res.status(409).json({ message: error.message });
        }
        console.error("Update status error:", error);
        return res.status(500).json({ message: "Failed to update order" });
    }
});
/* ===============================
   SOFT DELETE ORDER (History Archive)
   🔒 Restricted to: OWNER, ADMIN
================================== */
router.delete("/:id", auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorizeRoles)("OWNER", "ADMIN"), async (req, res) => {
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
