"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = telegramWebhook;
const prisma_1 = require("../../lib/prisma");
const telegram_adapter_1 = require("../../adapters/telegram.adapter");
/* ===============================
   HELPERS
=============================== */
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
function buildWelcomeMessage(company, name) {
    const customWelcome = company?.botWelcomeMessage?.trim()?.length > 0
        ? company.botWelcomeMessage
        : `Welcome to ${company?.name || "our store"}! We are happy to assist you.`;
    return `👋 Hello ${name}!\n\n${customWelcome}`;
}
/* ===============================
   WEBHOOK
=============================== */
async function telegramWebhook(req, res) {
    try {
        const secret = req.headers["x-telegram-bot-api-secret-token"];
        if (!secret) {
            return res.status(403).json({ ok: false });
        }
        const company = await prisma_1.prisma.company.findUnique({
            where: { telegramWebhookSecret: secret },
        });
        if (!company || !company.telegramBotToken) {
            return res.status(400).json({ ok: false });
        }
        // Respond immediately (VERY IMPORTANT for Telegram reliability)
        res.json({ ok: true });
        // Process async (never block webhook)
        // Process async (never block webhook)
        (async () => {
            try {
                const adapter = new telegram_adapter_1.TelegramAdapter(company.telegramBotToken);
                await adapter.processWebhook(req.body, company.id);
            }
            catch (err) {
                console.error("Async adapter processing error:", err);
            }
        })();
    }
    catch (err) {
        console.error("Telegram webhook fatal error:", err);
        res.status(500).json({ ok: false });
    }
}
