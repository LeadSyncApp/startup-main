import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  Channel,
  MessageSender,
  ConversationMode,
  OrderSource,
  OrderApprovalStatus,
} from "@prisma/client";
import { TelegramAdapter } from "../../adapters/telegram.adapter";


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

    if (!secret) {
      return res.status(403).json({ ok: false });
    }

    const company = await prisma.company.findUnique({
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
        const adapter = new TelegramAdapter(company.telegramBotToken!);
        await adapter.processWebhook(req.body, company.id);
      } catch (err) {
        console.error("Async adapter processing error:", err);
      }
    })();

  } catch (err) {
    console.error("Telegram webhook fatal error:", err);
    res.status(500).json({ ok: false });
  }
}
