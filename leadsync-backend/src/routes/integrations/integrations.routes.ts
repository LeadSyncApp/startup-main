import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import axios from "axios";

const router = Router();

/* ===============================
   🔹 HEALTH CHECK
=============================== */
router.get("/ping", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Frontend connected to backend 🚀",
  });
});

/* ===============================
   🔹 GET INTEGRATION STATUS
=============================== */
router.get(
  "/status",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
        select: {
          telegramConnected: true,
          telegramBotUsername: true,
          instagramConnected: true,
          instagramPageId: true,
        },
      });

      res.json({
        telegram: {
          connected: company?.telegramConnected ?? false,
          username: company?.telegramBotUsername ?? null,
          webhookUrl: company?.telegramConnected ? `${process.env.API_BASE_URL}/api/telegram/webhook` : null,
        },
        instagram: {
          connected: company?.instagramConnected ?? false,
          pageId: company?.instagramPageId ?? null,
          webhookUrl: `${process.env.API_BASE_URL}/api/instagram/webhook`,
        },
      });
    } catch (error) {
      console.error("Integration status error:", error);
      res.status(500).json({ message: "Failed to fetch integration status" });
    }
  }
);

export default router;
