"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const notification_service_1 = require("../services/notification.service");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
/* =========================================
   GET NOTIFICATIONS (Paginated)
   ========================================= */
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const notifications = await prisma_1.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: (page - 1) * limit
        });
        const unreadCount = await prisma_1.prisma.notification.count({
            where: { userId, isRead: false }
        });
        // Force cast because TS might complain about `notification` model not existing yet via inference
        // but explicit usage above is standard.
        res.json({ items: notifications, unreadCount });
    }
    catch (error) {
        console.error("Fetch notifications error:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});
/* =========================================
   MARK AS READ (Single)
   ========================================= */
router.patch("/:id/read", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findFirst({
            where: { id, userId }
        });
        if (!notification)
            return res.status(404).json({ message: "Notification not found" });
        await notification_service_1.notificationService.markAsRead(id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to mark as read" });
    }
});
/* =========================================
   MARK ALL AS READ
   ========================================= */
router.patch("/read-all", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        await notification_service_1.notificationService.markAllAsRead(userId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to mark all as read" });
    }
});
exports.default = router;
