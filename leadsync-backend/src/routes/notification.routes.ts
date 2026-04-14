import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { notificationService } from "../services/notification.service";
import { prisma } from "../lib/prisma";

const router = Router();

/* =========================================
   GET NOTIFICATIONS (Paginated)
   ========================================= */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = 20;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: (page - 1) * limit
        });

        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        // Force cast because TS might complain about `notification` model not existing yet via inference
        // but explicit usage above is standard.
        res.json({ items: notifications, unreadCount });
    } catch (error) {
        console.error("Fetch notifications error:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

/* =========================================
   MARK AS READ (Single)
   ========================================= */
router.patch("/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const notification = await prisma.notification.findFirst({
            where: { id, userId }
        });

        if (!notification) return res.status(404).json({ message: "Notification not found" });

        await notificationService.markAsRead(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to mark as read" });
    }
});

/* =========================================
   MARK ALL AS READ
   ========================================= */
router.patch("/read-all", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        await notificationService.markAllAsRead(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Failed to mark all as read" });
    }
});

export default router;
