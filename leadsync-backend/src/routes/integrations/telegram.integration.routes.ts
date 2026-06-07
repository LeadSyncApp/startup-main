import { Router, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { prisma } from "../../lib/prisma"; // correct path for src/routes -> src/lib
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";
import { generateSuggestedBotCommands } from "../../services/ai/ai.service";

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
        // Send only command and description to Telegram api
        const telegramPayload = cleanedCommands.map((c: any) => ({
          command: c.command,
          description: c.description
        }));
        await axios.post(
          `https://api.telegram.org/bot${company.telegramBotToken}/setMyCommands`,
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

      const suggested = await generateSuggestedBotCommands(
        description,
        businessName
      );

      return res.json({
        message: "AI has successfully generated customized commands for your business!",
        optimizedDescription: suggested.optimizedDescription,
        commands: suggested.commands,
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

