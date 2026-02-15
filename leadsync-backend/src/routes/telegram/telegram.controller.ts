import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Channel, MessageSender, ConversationMode } from "@prisma/client";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { generateBotReply } from "../../services/geminiService";

/* ===============================
   BUILD TELEGRAM KEYBOARD
=============================== */
function buildKeyboard(menu: any) {
  return {
    keyboard:
      Array.isArray(menu) && menu.length > 0
        ? menu
        : [["Talk to Support"]],
    resize_keyboard: true,
  };
}

/* ===============================
   BUILD WELCOME MESSAGE
=============================== */
function buildWelcomeMessage(company: any, name: string) {
  return (
    `👋 Hello ${name}!\n\n` +
    (company.botWelcomeMessage ||
      `Welcome to ${company.name}! We are happy to assist you.`)
  );
}

/* ===============================
   TELEGRAM WEBHOOK
=============================== */
export async function telegramWebhook(req: Request, res: Response) {
  try {
    const secret = req.headers[
      "x-telegram-bot-api-secret-token"
    ] as string;

    if (!secret) return res.status(403).json({ ok: false });

    const company = await prisma.company.findUnique({
      where: { telegramWebhookSecret: secret },
    });

    if (!company || !company.telegramBotToken) {
      return res.status(400).json({ ok: false });
    }

    res.json({ ok: true });

    processTelegramMessage(req.body, company).catch((err) => {
      console.error("Telegram async error:", err);
    });

  } catch (err) {
    console.error("Telegram webhook error:", err);
    res.status(500).json({ ok: false });
  }
}

/* ===============================
   PROCESS MESSAGE
=============================== */
async function processTelegramMessage(body: any, company: any) {
  const message = body.message;
  if (!message) return;

  const botToken = company.telegramBotToken!;
  const chatId = String(message.chat.id);
  const name = message.from?.first_name || "Customer";

  /* ===============================
     FIND OR CREATE LEAD
  =============================== */
  let lead = await prisma.lead.findFirst({
    where: {
      contact: chatId,
      channel: Channel.TELEGRAM,
      companyId: company.id,
    },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        name,
        contact: chatId,
        channel: Channel.TELEGRAM,
        companyId: company.id,
      },
    });
  }

  /* ===============================
     FIND OR CREATE CONVERSATION
  =============================== */
  let conversation = await prisma.conversation.findUnique({
    where: {
      leadId_companyId_channel: {
        leadId: lead.id,
        companyId: company.id,
        channel: Channel.TELEGRAM,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        companyId: company.id,
        channel: Channel.TELEGRAM,
        mode: ConversationMode.BOT,
      },
    });
  }

  /* ===============================
     TEXT MESSAGE
  =============================== */
  if (message.text) {
    const text = message.text.trim();

    await prisma.message.create({
      data: {
        content: text,
        sender: MessageSender.CLIENT,
        conversationId: conversation.id,
      },
    });

    /* 🔥 CRITICAL MODE GUARD */
    if (conversation.mode === ConversationMode.HUMAN) {
      return; // STOP BOT
    }

    if (text === "/start") {
      const welcomeMsg = buildWelcomeMessage(company, name);

      const categories =
        company.botStructuredMenu?.categories || [];

      const keyboard = categories.length
        ? categories.map((cat: any) => [cat.name])
        : company.botMenu;

      await sendTelegramMessage(
        botToken,
        chatId,
        welcomeMsg,
        buildKeyboard(keyboard)
      );

      return;
    }

    const categories =
      company.botStructuredMenu?.categories || [];

    const selectedCategory = categories.find(
      (cat: any) =>
        cat.name.toLowerCase() === text.toLowerCase()
    );

    if (selectedCategory) {
      const itemsKeyboard = selectedCategory.items.map(
        (item: string) => [item]
      );

      await sendTelegramMessage(
        botToken,
        chatId,
        `📂 ${selectedCategory.name} Menu`,
        buildKeyboard(itemsKeyboard)
      );

      return;
    }

    const aiReply = await generateBotReply(
      text,
      company.botBusinessType || "general business",
      company.botStructuredMenu
    );

    await prisma.message.create({
      data: {
        content: aiReply,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    await sendTelegramMessage(
      botToken,
      chatId,
      aiReply,
      buildKeyboard(company.botMenu)
    );
  }

  /* ===============================
     IMAGE MESSAGE
  =============================== */
  if (message.photo) {
    await prisma.message.create({
      data: {
        content: "[Image Received]",
        sender: MessageSender.CLIENT,
        conversationId: conversation.id,
      },
    });

    if (conversation.mode === ConversationMode.HUMAN) return;

    await sendTelegramMessage(
      botToken,
      chatId,
      "📸 Image received. Our team will review it."
    );
  }

  /* ===============================
     VOICE MESSAGE
  =============================== */
  if (message.voice) {
    await prisma.message.create({
      data: {
        content: "[Voice Message Received]",
        sender: MessageSender.CLIENT,
        conversationId: conversation.id,
      },
    });

    if (conversation.mode === ConversationMode.HUMAN) return;

    await sendTelegramMessage(
      botToken,
      chatId,
      "🎤 Voice message received. Processing..."
    );
  }
}
