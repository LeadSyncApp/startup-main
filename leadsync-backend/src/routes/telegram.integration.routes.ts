import { Router, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { prisma } from "../lib/prisma"; // correct path for src/routes -> src/lib
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

      /* 1️⃣ Validate token */
      const telegramResponse = await axios.get(
        `https://api.telegram.org/bot${token}/getMe`
      );

      if (!telegramResponse.data.ok) {
        return res.status(400).json({ message: "Invalid bot token" });
      }

      const botUsername = telegramResponse.data.result.username;

      /* 2️⃣ Generate webhook secret */
      const webhookSecret = crypto.randomBytes(32).toString("hex");

      const webhookUrl = `${process.env.API_BASE_URL}/api/telegram/webhook`;

      /* 3️⃣ Set webhook */
      await axios.post(
        `https://api.telegram.org/bot${token}/setWebhook`,
        {
          url: webhookUrl,
          secret_token: webhookSecret,
        }
      );

      /* 4️⃣ Register bot commands (restore menu) */
      await axios.post(
        `https://api.telegram.org/bot${token}/setMyCommands`,
        {
          commands: [
            { command: "start", description: "Start the bot" },
            { command: "menu", description: "View menu" },
            { command: "help", description: "Get support" },
          ],
        }
      );

      /* 5️⃣ Set persistent chat menu button */
      await axios.post(
        `https://api.telegram.org/bot${token}/setChatMenuButton`,
        {
          menu_button: {
            type: "commands",
          },
        }
      );

      /* 6️⃣ Save bot details in DB */
      await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          telegramBotToken: token,
          telegramBotUsername: botUsername,
          telegramWebhookSecret: webhookSecret,
          telegramConnected: true,
        },
      });

      return res.json({
        message: "Telegram bot connected successfully",
        botUsername,
        webhookUrl,
      });
    } catch (error: any) {
      console.error(
        "Telegram connect error:",
        error?.response?.data || error
      );

      return res.status(500).json({
        message: "Failed to connect Telegram bot",
      });
    }
  }
);

/* ===============================
   DISCONNECT TELEGRAM BOT
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

      if (!company?.telegramBotToken) {
        return res.status(400).json({ message: "No bot connected" });
      }

      /* Remove webhook */
      await axios.post(
        `https://api.telegram.org/bot${company.telegramBotToken}/deleteWebhook`,
        { drop_pending_updates: true }
      );

      /* Remove bot data from DB */
      await prisma.company.update({
        where: { id: company.id },
        data: {
          telegramBotToken: null,
          telegramBotUsername: null,
          telegramWebhookSecret: null,
          telegramConnected: false,
        },
      });

      return res.json({ message: "Telegram bot disconnected successfully" });
    } catch (error: any) {
      console.error(
        "Telegram disconnect error:",
        error?.response?.data || error
      );

      return res.status(500).json({
        message: "Failed to disconnect Telegram bot",
      });
    }
  }
);

export default router;
