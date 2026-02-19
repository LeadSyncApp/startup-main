"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma"); // correct path for src/routes -> src/lib
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ===============================
   CONNECT TELEGRAM BOT
=============================== */
router.post("/telegram/connect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: "Bot token is required" });
        }
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        /* 1️⃣ Validate token */
        const telegramResponse = await axios_1.default.get(`https://api.telegram.org/bot${token}/getMe`);
        if (!telegramResponse.data.ok) {
            return res.status(400).json({ message: "Invalid bot token" });
        }
        const botUsername = telegramResponse.data.result.username;
        /* 2️⃣ Generate webhook secret */
        const webhookSecret = crypto_1.default.randomBytes(32).toString("hex");
        const webhookUrl = `${process.env.API_BASE_URL}/api/telegram/webhook`;
        /* 3️⃣ Set webhook */
        await axios_1.default.post(`https://api.telegram.org/bot${token}/setWebhook`, {
            url: webhookUrl,
            secret_token: webhookSecret,
        });
        /* 4️⃣ Register bot commands (restore menu) */
        /* 4️⃣ Register DYNAMIC bot commands */
        const businessType = (req.body.businessType || "food").toLowerCase();
        let mainCommand = "menu";
        let mainDesc = "View Menu";
        if (businessType.match(/(retail|clothing|fashion|shop|store)/)) {
            mainCommand = "catalog";
            mainDesc = "View Catalog";
        }
        else if (businessType.match(/(electronics|tech|gadgets)/)) {
            mainCommand = "inventory";
            mainDesc = "View Products";
        }
        else if (businessType.match(/(service|consulting|agency)/)) {
            mainCommand = "services";
            mainDesc = "View Services";
        }
        await axios_1.default.post(`https://api.telegram.org/bot${token}/setMyCommands`, {
            commands: [
                { command: "start", description: "Start the bot" },
                { command: mainCommand, description: mainDesc },
                { command: "help", description: "Get support" },
            ],
        });
        /* 5️⃣ Set persistent chat menu button */
        await axios_1.default.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
            menu_button: {
                type: "commands",
            },
        });
        /* 6️⃣ Save bot details in DB */
        await prisma_1.prisma.company.update({
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
    }
    catch (error) {
        console.error("Telegram connect error:", error?.response?.data || error);
        return res.status(500).json({
            message: "Failed to connect Telegram bot",
        });
    }
});
/* ===============================
   DISCONNECT TELEGRAM BOT
=============================== */
router.post("/telegram/disconnect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const company = await prisma_1.prisma.company.findUnique({
            where: { id: req.user.companyId },
        });
        if (!company?.telegramBotToken) {
            return res.status(400).json({ message: "No bot connected" });
        }
        /* Remove webhook */
        await axios_1.default.post(`https://api.telegram.org/bot${company.telegramBotToken}/deleteWebhook`, { drop_pending_updates: true });
        /* Remove bot data from DB */
        await prisma_1.prisma.company.update({
            where: { id: company.id },
            data: {
                telegramBotToken: null,
                telegramBotUsername: null,
                telegramWebhookSecret: null,
                telegramConnected: false,
            },
        });
        return res.json({ message: "Telegram bot disconnected successfully" });
    }
    catch (error) {
        console.error("Telegram disconnect error:", error?.response?.data || error);
        return res.status(500).json({
            message: "Failed to disconnect Telegram bot",
        });
    }
});
exports.default = router;
