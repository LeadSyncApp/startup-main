"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
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
router.get("/status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const company = await prisma_1.prisma.company.findUnique({
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
            },
            instagram: {
                connected: company?.instagramConnected ?? false,
                pageId: company?.instagramPageId ?? null,
            },
        });
    }
    catch (error) {
        console.error("Integration status error:", error);
        res.status(500).json({ message: "Failed to fetch integration status" });
    }
});
/* ===============================
   🔹 DISCONNECT TELEGRAM
=============================== */
router.post("/telegram/disconnect", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const company = await prisma_1.prisma.company.findUnique({
            where: { id: req.user.companyId },
        });
        if (!company || !company.telegramBotToken) {
            return res.status(400).json({ message: "Telegram not connected" });
        }
        // 🔥 1️⃣ Remove webhook from Telegram
        await axios_1.default.post(`https://api.telegram.org/bot${company.telegramBotToken}/deleteWebhook`, {
            drop_pending_updates: true,
        });
        // 🔥 2️⃣ Clear Telegram data from DB
        await prisma_1.prisma.company.update({
            where: { id: company.id },
            data: {
                telegramConnected: false,
                telegramBotToken: null,
                telegramBotUsername: null,
                telegramWebhookSecret: null,
            },
        });
        res.json({ message: "Telegram disconnected successfully" });
    }
    catch (error) {
        console.error("Disconnect error:", error);
        res.status(500).json({ message: "Failed to disconnect Telegram" });
    }
});
exports.default = router;
