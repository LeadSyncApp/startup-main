import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  Channel,
  MessageSender,
  ConversationMode,
  OrderSource,
  OrderApprovalStatus,
} from "@prisma/client";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { generateBotReply } from "../../services/geminiService";

/* ===============================
   TYPES
=============================== */

interface StructuredMenuItem {
  name: string;
  price: number;
}

interface StructuredMenuCategory {
  name: string;
  items: StructuredMenuItem[];
}

interface StructuredMenu {
  categories: StructuredMenuCategory[];
}

interface DetectedOrder {
  items: { name: string; quantity: number }[];
}

/* ===============================
   HELPERS
=============================== */

function normalize(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function buildWelcomeMessage(company: any, name: string) {
  const customWelcome =
    company?.botWelcomeMessage?.trim()?.length > 0
      ? company.botWelcomeMessage
      : `Welcome to ${company?.name || "our store"}! We are happy to assist you.`;

  return `👋 Hello ${name}!\n\n${customWelcome}`;
}

/* ===============================
   WEBHOOK
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

    processTelegramMessage(req.body, company.id).catch((err) => {
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

async function processTelegramMessage(body: any, companyId: string) {
  const message = body.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const name = message.from?.first_name || "Customer";

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company || !company.telegramBotToken) return;

  const botToken = company.telegramBotToken;

  const structuredMenu = company.botStructuredMenu as StructuredMenu | null;
  const categories = structuredMenu?.categories || [];

  /* FIND OR CREATE LEAD */
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

  /* FIND OR CREATE CONVERSATION */
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

  if (!message.text) return;

  const text = message.text.trim();

  await prisma.message.create({
    data: {
      content: text,
      sender: MessageSender.CLIENT,
      conversationId: conversation.id,
    },
  });

  if (conversation.mode === ConversationMode.HUMAN) return;

  if (text === "/start") {
    const welcomeMsg = buildWelcomeMessage(company, name);
    await sendTelegramMessage(botToken, chatId, welcomeMsg);
    return;
  }

  /* ===============================
     STRICT ORDER DETECTION
  =============================== */

  let detectedItems: { item: StructuredMenuItem; quantity: number }[] = [];

  const normalizedText = normalize(text);

  for (const category of categories) {
    for (const item of category.items) {
      const normalizedItemName = normalize(item.name);

      if (normalizedText.includes(normalizedItemName)) {
        let quantity = 1;

        const qtyMatch = normalizedText.match(
          new RegExp(`(\\d+)\\s*${normalizedItemName}`)
        );

        if (qtyMatch && qtyMatch[1]) {
          quantity = parseInt(qtyMatch[1], 10);
        }

        detectedItems.push({ item, quantity });
      }
    }
  }

  /* IF VALID ORDER */
  if (detectedItems.length > 0) {
    let total = 0;
    let summaryParts: string[] = [];

    for (const entry of detectedItems) {
      total += entry.item.price * entry.quantity;
      summaryParts.push(`${entry.quantity} x ${entry.item.name}`);
    }

    const summary = summaryParts.join(", ");

    await prisma.order.create({
      data: {
        companyId: company.id,
        conversationId: conversation.id,
        leadId: lead.id,
        summary,
        amount: total,
        source: OrderSource.BOT_DETECTED,
        approvalStatus: OrderApprovalStatus.PENDING,
      },
    });

    const reply = `🛒 Order Detected:\n\n${summary}\n\n💰 Total: ₹${total}\n\n⏳ Waiting for approval from our team.`;

    await prisma.message.create({
      data: {
        content: reply,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    await sendTelegramMessage(botToken, chatId, reply);

    return;
  }

  /* NORMAL AI REPLY */
  const aiReply = await generateBotReply(
    text,
    company.botBusinessType || "general business",
    structuredMenu
  );

  await prisma.message.create({
    data: {
      content: aiReply,
      sender: MessageSender.SYSTEM,
      conversationId: conversation.id,
    },
  });

  await sendTelegramMessage(botToken, chatId, aiReply);
}
