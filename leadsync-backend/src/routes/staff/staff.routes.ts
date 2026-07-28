import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

router.get(
  "/stats",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { companyId, userId } = req.user;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const thirtyDaysAgo = new Date(startOfToday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const chatsResolvedToday = await prisma.conversation.count({
        where: {
          companyId,
          resolvedById: userId,
          deletedAt: null,
          resolvedAt: { gte: startOfToday },
        },
      });

      const chatsResolvedWeek = await prisma.conversation.count({
        where: {
          companyId,
          resolvedById: userId,
          deletedAt: null,
          resolvedAt: { gte: sevenDaysAgo },
        },
      });

      const responseTimeRows = await prisma.conversation.findMany({
        where: {
          companyId,
          claimedById: userId,
          deletedAt: null,
          firstStaffReplyAt: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          firstStaffReplyAt: true,
        },
      });

      let avgResponseTimeSeconds = 0;
      if (responseTimeRows.length > 0) {
        const totalMs = responseTimeRows.reduce((sum, row) => {
          const diff = row.firstStaffReplyAt!.getTime() - row.createdAt.getTime();
          return sum + (diff > 0 ? diff : 0);
        }, 0);
        avgResponseTimeSeconds = Math.round(totalMs / responseTimeRows.length / 1000);
      }

      const ordersProcessedToday = await prisma.order.count({
        where: {
          companyId,
          processedById: userId,
          isDeleted: false,
          completedAt: { gte: startOfToday },
        },
      });

      const ordersProcessedWeek = await prisma.order.count({
        where: {
          companyId,
          processedById: userId,
          isDeleted: false,
          completedAt: { gte: sevenDaysAgo },
        },
      });

      const activeChats = await prisma.conversation.count({
        where: {
          companyId,
          claimedById: userId,
          deletedAt: null,
          status: { in: ["OPEN", "ASSIGNED"] },
        },
      });

      return res.json({
        chatsResolvedToday,
        chatsResolvedWeek,
        avgResponseTimeSeconds,
        ordersProcessedToday,
        ordersProcessedWeek,
        activeChats,
      });
    } catch (error) {
      console.error("Staff stats error:", error);
      return res.status(500).json({ message: "Failed to fetch staff stats" });
    }
  }
);

export default router;
