"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = telegramWebhook;
const prisma_1 = require("../../lib/prisma");
const client_1 = require("@prisma/client");
const telegram_sender_1 = require("../../bot/telegram.sender");
const geminiService_1 = require("../../services/geminiService");
const cache_service_1 = require("../../services/cache.service");
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
        processTelegramMessage(req.body, company.id).catch((err) => {
            console.error("Telegram async processing error:", err);
        });
    }
    catch (err) {
        console.error("Telegram webhook fatal error:", err);
        res.status(500).json({ ok: false });
    }
}
/* ===============================
   PROCESS MESSAGE
=============================== */
async function processTelegramMessage(body, companyId) {
    try {
        const message = body.message;
        if (!message || !message.message_id)
            return;
        const chatId = String(message.chat.id);
        const name = message.from?.first_name || "Customer";
        const text = message.text?.trim();
        if (!text)
            return;
        // 1. Try Cache
        let company = cache_service_1.cacheService.get(cache_service_1.cacheService.getCompanyKey(companyId));
        if (!company) {
            // 2. Fallback to DB
            company = await prisma_1.prisma.company.findUnique({
                where: { id: companyId },
            });
            if (company) {
                // Cache success
                cache_service_1.cacheService.set(cache_service_1.cacheService.getCompanyKey(companyId), company);
            }
        }
        if (!company || !company.telegramBotToken)
            return;
        const botToken = company.telegramBotToken;
        // Report typing status (UX improvement)
        (0, telegram_sender_1.sendChatAction)(botToken, chatId, "typing");
        /* -------------------------------
           FIND OR CREATE LEAD
        -------------------------------- */
        let lead = await prisma_1.prisma.lead.findFirst({
            where: {
                contact: chatId,
                channel: client_1.Channel.TELEGRAM,
                companyId,
            },
        });
        if (!lead) {
            lead = await prisma_1.prisma.lead.create({
                data: {
                    name,
                    contact: chatId,
                    channel: client_1.Channel.TELEGRAM,
                    companyId,
                },
            });
        }
        /* -------------------------------
           FIND OR CREATE CONVERSATION
        -------------------------------- */
        let conversation = await prisma_1.prisma.conversation.findUnique({
            where: {
                leadId_companyId_channel: {
                    leadId: lead.id,
                    companyId,
                    channel: client_1.Channel.TELEGRAM,
                },
            },
        });
        if (!conversation) {
            conversation = await prisma_1.prisma.conversation.create({
                data: {
                    leadId: lead.id,
                    companyId,
                    channel: client_1.Channel.TELEGRAM,
                    mode: client_1.ConversationMode.BOT,
                },
            });
        }
        /* -------------------------------
           DEDUPLICATE CLIENT MESSAGE
        -------------------------------- */
        const existingMessage = await prisma_1.prisma.message.findFirst({
            where: {
                conversationId: conversation.id,
                content: text,
                sender: client_1.MessageSender.CLIENT,
            },
        });
        if (existingMessage)
            return;
        await prisma_1.prisma.message.create({
            data: {
                content: text,
                sender: client_1.MessageSender.CLIENT,
                conversationId: conversation.id,
            },
        });
        if (conversation.mode === client_1.ConversationMode.HUMAN)
            return;
        /* -------------------------------
           START COMMAND
        -------------------------------- */
        if (text === "/start") {
            const welcomeMsg = buildWelcomeMessage(company, name);
            await (0, telegram_sender_1.sendTelegramMessage)(botToken, chatId, welcomeMsg);
            return;
        }
        /* -------------------------------
           MENU COMMAND
        -------------------------------- */
        if (text.toLowerCase() === "menu" || text.toLowerCase() === "/menu") {
            const structuredMenu = company.botStructuredMenu;
            if (!structuredMenu?.categories?.length) {
                await (0, telegram_sender_1.sendTelegramMessage)(botToken, chatId, "Menu is currently unavailable.");
                return;
            }
            let menuMsg = "📜 *Our Menu*\n\n";
            structuredMenu.categories.forEach((cat) => {
                menuMsg += `*${cat.name}*\n`;
                cat.items.forEach((item) => {
                    menuMsg += `- ${item.name}: ₹${item.price}\n`;
                });
                menuMsg += "\n";
            });
            await (0, telegram_sender_1.sendTelegramMessage)(botToken, chatId, menuMsg);
            return;
        }
        /* -------------------------------
           ORDER DETECTION
        -------------------------------- */
        const structuredMenu = company.botStructuredMenu;
        const categories = structuredMenu?.categories || [];
        const normalizedText = normalize(text);
        let detectedItems = [];
        for (const category of categories) {
            for (const item of category.items) {
                const normalizedItemName = normalize(item.name);
                if (normalizedText.includes(normalizedItemName)) {
                    let quantity = 1;
                    const qtyMatch = normalizedText.match(new RegExp(`(\\d+)\\s*${normalizedItemName}`));
                    if (qtyMatch?.[1]) {
                        quantity = parseInt(qtyMatch[1], 10);
                    }
                    detectedItems.push({
                        name: item.name,
                        price: item.price,
                        quantity,
                    });
                }
            }
        }
        if (detectedItems.length > 0) {
            let total = 0;
            let summaryParts = [];
            for (const entry of detectedItems) {
                total += entry.price * entry.quantity;
                summaryParts.push(`${entry.quantity} x ${entry.name}`);
            }
            const summary = summaryParts.join(", ");
            // Prevent duplicate order within 2 minutes
            const recentOrder = await prisma_1.prisma.order.findFirst({
                where: {
                    conversationId: conversation.id,
                    summary,
                    createdAt: {
                        gte: new Date(Date.now() - 2 * 60 * 1000),
                    },
                },
            });
            if (!recentOrder) {
                await prisma_1.prisma.order.create({
                    data: {
                        companyId,
                        conversationId: conversation.id,
                        leadId: lead.id,
                        summary,
                        amount: total,
                        source: client_1.OrderSource.BOT_DETECTED,
                        approvalStatus: client_1.OrderApprovalStatus.PENDING,
                    },
                });
            }
            const reply = `🛒 Order Detected:\n\n${summary}\n\n💰 Total: ₹${total}\n\n⏳ Waiting for approval from our team.`;
            await prisma_1.prisma.message.create({
                data: {
                    content: reply,
                    sender: client_1.MessageSender.SYSTEM,
                    conversationId: conversation.id,
                },
            });
            await (0, telegram_sender_1.sendTelegramMessage)(botToken, chatId, reply);
            return;
        }
        /* -------------------------------
           AI REPLY (SAFE WRAPPED)
        -------------------------------- */
        let aiReply = "Thank you! Our team will assist you shortly.";
        try {
            aiReply = await (0, geminiService_1.generateBotReply)(text, company.botBusinessType || "general business", structuredMenu);
        }
        catch (err) {
            console.error("AI reply failed:", err);
        }
        await prisma_1.prisma.message.create({
            data: {
                content: aiReply,
                sender: client_1.MessageSender.SYSTEM,
                conversationId: conversation.id,
            },
        });
        await (0, telegram_sender_1.sendTelegramMessage)(botToken, chatId, aiReply);
    }
    catch (err) {
        console.error("processTelegramMessage error:", err);
    }
}
