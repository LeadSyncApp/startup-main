import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import axios from "axios";

const router = Router();

/* ===============================
   🔹 HEALTH CHECK
=============================== */
router.get("/ping", (_req, res) => {
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
        },
      });

      res.json({
        telegram: {
          connected: company?.telegramConnected ?? false,
          username: company?.telegramBotUsername ?? null,
        },
      });
    } catch (error) {
      console.error("Integration status error:", error);
      res.status(500).json({ message: "Failed to fetch integration status" });
    }
  }
);

/* ===============================
   🔹 DISCONNECT TELEGRAM
=============================== */
router.post(
  "/telegram/disconnect",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
      });

      if (!company || !company.telegramBotToken) {
        return res.status(400).json({ message: "Telegram not connected" });
      }

      // 🔥 1️⃣ Remove webhook from Telegram
      await axios.post(
        `https://api.telegram.org/bot${company.telegramBotToken}/deleteWebhook`,
        {
          drop_pending_updates: true,
        }
      );

      // 🔥 2️⃣ Clear Telegram data from DB
      await prisma.company.update({
        where: { id: company.id },
        data: {
          telegramConnected: false,
          telegramBotToken: null,
          telegramBotUsername: null,
          telegramWebhookSecret: null,
        },
      });

      res.json({ message: "Telegram disconnected successfully" });
    } catch (error) {
      console.error("Disconnect error:", error);
      res.status(500).json({ message: "Failed to disconnect Telegram" });
    }
  }
);

export default router;
