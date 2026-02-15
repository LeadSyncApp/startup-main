import { Router, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/* ===============================
   CONNECT TELEGRAM BOT
=============================== */
router.post(
  "/telegram/connect",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Bot token is required" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // 1️⃣ Validate token
      const telegramResponse = await axios.get(
        `https://api.telegram.org/bot${token}/getMe`
      );

      if (!telegramResponse.data.ok) {
        return res.status(400).json({ message: "Invalid bot token" });
      }

      const botUsername = telegramResponse.data.result.username;

      // 2️⃣ Generate secret
      const webhookSecret = crypto.randomBytes(32).toString("hex");

      const webhookUrl = `${process.env.API_BASE_URL}/api/telegram/webhook`;

      // 3️⃣ Set webhook FIRST
      await axios.post(
        `https://api.telegram.org/bot${token}/setWebhook`,
        {
          url: webhookUrl,
          secret_token: webhookSecret,
        }
      );

      // 4️⃣ Save to DB ONLY after success
      await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          telegramBotToken: token,
          telegramBotUsername: botUsername,
          telegramWebhookSecret: webhookSecret,
          telegramConnected: true,
        },
      });

      res.json({
        message: "Telegram bot connected successfully",
        botUsername,
        webhookUrl,
      });
    } catch (error: any) {
      console.error("Telegram connect error:", error?.response?.data || error);
      res.status(500).json({
        message: "Failed to connect Telegram bot",
      });
    }
  }
);

export default router;
