import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { notificationService } from "../../services/infrastructure/notification.service";
import { prisma, getTenantPrismaContext } from "../../lib/prisma";

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
   GET NOTIFICATION PREFERENCES
   ========================================= */
router.get("/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const companyId = req.user!.companyId;
        const tenantDb = getTenantPrismaContext(companyId);

        // Auto-create default row if none exists (all true)
        const pref = await tenantDb.notificationPreference.upsert({
            where: { userId },
            create: {
                userId,
                companyId,
                ORDER: true,
                MESSAGE: true,
                ALERT: true,
                SYSTEM: true
            },
            update: {}
        });

        res.json({
            ORDER: pref.ORDER,
            MESSAGE: pref.MESSAGE,
            ALERT: pref.ALERT,
            SYSTEM: pref.SYSTEM
        });
    } catch (error) {
        console.error("Fetch notification preferences error:", error);
        res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
});

/* =========================================
   UPDATE NOTIFICATION PREFERENCES
   ========================================= */
router.patch("/preferences", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const companyId = req.user!.companyId;
        const tenantDb = getTenantPrismaContext(companyId);
        const { ORDER, MESSAGE, ALERT, SYSTEM } = req.body;

        // Build update data — only include provided fields
        const updateData: Record<string, boolean> = {};
        if (typeof ORDER === "boolean") updateData.ORDER = ORDER;
        if (typeof MESSAGE === "boolean") updateData.MESSAGE = MESSAGE;
        if (typeof ALERT === "boolean") updateData.ALERT = ALERT;
        if (typeof SYSTEM === "boolean") updateData.SYSTEM = SYSTEM;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid preference fields provided" });
        }

        // Upsert — create with defaults if row doesn't exist, then update
        const pref = await tenantDb.notificationPreference.upsert({
            where: { userId },
            create: {
                userId,
                companyId,
                ORDER: true,
                MESSAGE: true,
                ALERT: true,
                SYSTEM: true
            },
            update: updateData
        });

        res.json({
            ORDER: pref.ORDER,
            MESSAGE: pref.MESSAGE,
            ALERT: pref.ALERT,
            SYSTEM: pref.SYSTEM
        });
    } catch (error) {
        console.error("Update notification preferences error:", error);
        res.status(500).json({ message: "Failed to update notification preferences" });
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

export default router;
