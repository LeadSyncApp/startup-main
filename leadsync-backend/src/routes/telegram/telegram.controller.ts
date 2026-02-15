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

function buildKeyboard(menu: any) {
  return {
    keyboard:
      Array.isArray(menu) && menu.length > 0
        ? menu
        : [["Talk to Support"]],
    resize_keyboard: true,
  };
}

function buildWelcomeMessage(company: any, name: string) {
  const customWelcome =
    company?.botWelcomeMessage &&
    company.botWelcomeMessage.trim().length > 0
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

  /* TEXT */
  if (message.text) {
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
       AI + ORDER DETECTION
    =============================== */

    const aiResponse = await generateBotReply(
      text,
      company.botBusinessType || "general business",
      structuredMenu
    );

    let detectedOrder: DetectedOrder | null = null;
    let cleanReply = aiResponse;

    try {
      const parsed = JSON.parse(aiResponse);
      if (parsed.items) {
        detectedOrder = parsed;
      }
    } catch {
      // not JSON
    }

    /* IF ORDER DETECTED */
    if (detectedOrder && structuredMenu) {
      let total = 0;
      let summaryParts: string[] = [];

      for (const orderItem of detectedOrder.items) {
        for (const cat of categories) {
          const found = cat.items.find(
            (i) =>
              i.name.toLowerCase() === orderItem.name.toLowerCase()
          );
          if (found) {
            total += found.price * orderItem.quantity;
            summaryParts.push(
              `${orderItem.quantity} x ${found.name}`
            );
          }
        }
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

      cleanReply = `🛒 Order Detected:\n\n${summary}\n\n💰 Total: ₹${total}\n\n⏳ Waiting for approval from our team.`;
    }

    await prisma.message.create({
      data: {
        content: cleanReply,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    await sendTelegramMessage(botToken, chatId, cleanReply);
  }
}
