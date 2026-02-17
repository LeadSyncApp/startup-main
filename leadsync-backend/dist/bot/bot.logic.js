"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchToBot = switchToBot;
exports.switchToHuman = switchToHuman;
exports.handleBotMessage = handleBotMessage;
const prisma_1 = require("../lib/prisma");
const geminiService_1 = require("../services/geminiService");
/* =====================================================
   SWITCH TO BOT MODE
===================================================== */
async function switchToBot(conversationId) {
    return prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "BOT" },
    });
}
/* =====================================================
   SWITCH TO HUMAN MODE
===================================================== */
async function switchToHuman(conversationId) {
    return prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: "HUMAN" },
    });
}
/* =====================================================
   HANDLE BOT MESSAGE (MULTI-TENANT + STRUCTURED MENU)
===================================================== */
async function handleBotMessage(conversationId, userMessage) {
    // 1️⃣ Get conversation
    const conversation = await prisma_1.prisma.conversation.findUnique({
        where: { id: conversationId },
    });
    if (!conversation || conversation.mode !== "BOT") {
        return null;
    }
    // 2️⃣ Fetch company configuration
    const company = await prisma_1.prisma.company.findUnique({
        where: { id: conversation.companyId },
        select: {
            botBusinessType: true,
            botStructuredMenu: true,
        },
    });
    const businessType = company?.botBusinessType || "general business";
    const structuredMenu = company?.botStructuredMenu || null;
    // 3️⃣ Generate AI reply grounded to structured menu
    const reply = await (0, geminiService_1.generateBotReply)(userMessage, businessType, structuredMenu);
    return reply;
}
