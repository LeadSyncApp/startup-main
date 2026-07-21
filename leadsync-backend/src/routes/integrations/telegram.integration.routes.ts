import { Router, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { prisma } from "../../lib/prisma"; // correct path for src/routes -> src/lib
import { encrypt, decryptSecret } from "../../utils/encryption";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

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

      if (!(telegramResponse.data as any).ok) {
        return res.status(400).json({ message: "Invalid bot token" });
      }

      const botUsername = (telegramResponse.data as any).result.username;

      /* 2️⃣ Generate webhook secret */
      const webhookSecret = crypto.randomBytes(32).toString("hex");

      const webhookUrl = `${process.env.API_BASE_URL}/api/webhook/telegram/webhook`;

      /* 3️⃣ Set webhook */
      await axios.post(
        `https://api.telegram.org/bot${token}/setWebhook`,
        {
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "callback_query"],
        }
      );

      /* 4️⃣ Register bot commands (restore menu) */
      const existingConfig = await prisma.botConfiguration.findUnique({
        where: { companyId: req.user.companyId },
      });

      const commands = (existingConfig?.botCommands as any) || [
        { command: "start", description: "Start the bot" },
        { command: "help", description: "Get support" },
      ];

      await axios.post(
        `https://api.telegram.org/bot${token}/setMyCommands`,
        {
          commands: commands.map((c: any) => ({
            command: c.command.toLowerCase().trim(),
            description: c.description.trim(),
          })),
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
          telegramBotToken: encrypt(token),
          telegramBotUsername: botUsername,
          telegramWebhookSecret: encrypt(webhookSecret),
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

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const teleToken = decryptSecret(company.telegramBotToken);
      if (!teleToken) {
        return res.status(400).json({ message: "No bot connected" });
      }

      /* Remove webhook */
      await axios.post(
        `https://api.telegram.org/bot${teleToken}/deleteWebhook`,
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

/* ===============================
   SAVE AND SYNC BOT COMMANDS
=============================== */
router.post(
  "/telegram/commands",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { commands } = req.body;

      if (!Array.isArray(commands)) {
        return res.status(400).json({ message: "Commands must be an array" });
      }

      // Clean & validate commands
      const cleanedCommands = commands.map((c: any) => {
        const cmdName = (c.command || "").replace(/^\//, "").toLowerCase().trim();
        const desc = (c.description || "").trim();
        const action = (c.action || "none").toLowerCase().trim();
        const customReplyText = (c.customReplyText || "").trim();
        const behaviorMode = (c.behaviorMode || "append").toLowerCase().trim();
        const lastCompiledReply = c.lastCompiledReply || null;
        return { command: cmdName, description: desc, action, customReplyText, behaviorMode, lastCompiledReply };
      }).filter(c => c.command && c.description);

      if (cleanedCommands.length === 0) {
        return res.status(400).json({ message: "You must configure at least one command." });
      }

      // Validate Telegram command rules:
      // - command name must be lowercase alphanumeric, 1-32 chars
      // - description must be 1-256 chars
      for (const c of cleanedCommands) {
        if (!/^[a-z0-9_]{1,32}$/.test(c.command)) {
          return res.status(400).json({
            message: `Command name "/${c.command}" must be 1-32 characters, lowercase alphanumeric (underscores allowed).`
          });
        }
        if (c.description.length < 1 || c.description.length > 256) {
          return res.status(400).json({
            message: `Description for "/${c.command}" must be 1-256 characters.`
          });
        }
      }

      // Upsert to BotConfiguration
      await prisma.botConfiguration.upsert({
        where: { companyId: req.user.companyId },
        create: {
          companyId: req.user.companyId,
          botCommands: cleanedCommands,
        },
        update: {
          botCommands: cleanedCommands,
        },
      });

      // Synchronize with Telegram if connected
      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
      });

      let synched = false;
      if (company?.telegramConnected && company.telegramBotToken) {
        const decryptedToken = decryptSecret(company.telegramBotToken);
        if (!decryptedToken) {
          return res.status(500).json({ message: "Failed to decrypt bot token for Telegram sync" });
        }
        // Send only command and description to Telegram api
        const telegramPayload = cleanedCommands.map((c: any) => ({
          command: c.command,
          description: c.description
        }));
        await axios.post(
          `https://api.telegram.org/bot${decryptedToken}/setMyCommands`,
          {
            commands: telegramPayload,
          }
        );
        synched = true;
      }

      return res.json({
        message: synched 
          ? "Commands saved and successfully synced with Telegram! 🚀" 
          : "Commands saved successfully (Connect bot to sync)",
        commands: cleanedCommands,
      });
    } catch (error: any) {
      console.error("Failed to save and sync bot commands:", error?.response?.data || error);
      return res.status(500).json({
        message: "Failed to save or sync bot commands with Telegram servers",
      });
    }
  }
);

/* ===============================
   GENERATE SUGGESTED BOT COMMANDS
   =============================== */
router.post(
  "/telegram/generate-commands",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { description } = req.body;
      if (!description || !description.trim()) {
        return res.status(400).json({ message: "Business description is required" });
      }

      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
      });

      const businessName = company?.businessName || company?.name || "Our Shop";

      const suggestedCommands = [
        { command: "start", description: `Welcome to ${businessName}!`, action: "custom", customReplyText: "Hello! Welcome to " + businessName + ". How can we help you today?" },
        { command: "menu", description: "Browse catalog", action: "custom", customReplyText: "Sure! Let me show you our current products." },
        { command: "help", description: "Get support", action: "custom", customReplyText: "Connect with our support team." }
      ];

      return res.json({
        message: "AI has successfully generated customized commands for your business!",
        optimizedDescription: description,
        commands: suggestedCommands,
      });
    } catch (error: any) {
      console.error("Failed to generate suggested commands:", error);
      return res.status(500).json({
        message: "AI failed to generate suggested commands. Please try again.",
      });
    }
  }
);

export default router;

