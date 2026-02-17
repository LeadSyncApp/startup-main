import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  Channel,
  MessageSender,
  ConversationMode,
  OrderSource,
  OrderApprovalStatus,
} from "@prisma/client";
import { sendTelegramMessage, sendChatAction } from "../../bot/telegram.sender";
import { generateBotReply } from "../../services/geminiService";
import { cacheService } from "../../services/cache.service";
import { emitToCompany, emitToConversation } from "../../lib/socket";


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
    processTelegramMessage(req.body, company.id).catch((err) => {
      console.error("Telegram async processing error:", err);
    });

  } catch (err) {
    console.error("Telegram webhook fatal error:", err);
    res.status(500).json({ ok: false });
  }
}

/* ===============================
   PROCESS MESSAGE
=============================== */

async function processTelegramMessage(body: any, companyId: string) {
  try {
    const message = body.message;
    if (!message || !message.message_id) return;

    const chatId = String(message.chat.id);
    const name = message.from?.first_name || "Customer";
    const text = message.text?.trim();

    if (!text) return;

    // 1. Try Cache
    let company: any = cacheService.get(cacheService.getCompanyKey(companyId));

    if (!company) {
      // 2. Fallback to DB
      company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (company) {
        // Cache success
        cacheService.set(cacheService.getCompanyKey(companyId), company);
      }
    }


    if (!company || !company.telegramBotToken) return;

    const botToken = company.telegramBotToken;

    // Report typing status (UX improvement)
    sendChatAction(botToken, chatId, "typing");

    /* -------------------------------
       FIND OR CREATE LEAD
    -------------------------------- */
    let lead = await prisma.lead.findFirst({
      where: {
        contact: chatId,
        channel: Channel.TELEGRAM,
        companyId,
      },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name,
          contact: chatId,
          channel: Channel.TELEGRAM,
          companyId,
        },
      });
    }

    /* -------------------------------
       FIND OR CREATE CONVERSATION
    -------------------------------- */
    let conversation = await prisma.conversation.findUnique({
      where: {
        leadId_companyId_channel: {
          leadId: lead.id,
          companyId,
          channel: Channel.TELEGRAM,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          leadId: lead.id,
          companyId,
          channel: Channel.TELEGRAM,
          mode: ConversationMode.BOT,
        },
      });
    }

    /* -------------------------------
       DEDUPLICATE CLIENT MESSAGE
    -------------------------------- */
    const existingMessage = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        content: text,
        sender: MessageSender.CLIENT,
      },
    });

    if (existingMessage) return;

    const clientMsg = await prisma.message.create({
      data: {
        content: text,
        sender: MessageSender.CLIENT,
        conversationId: conversation.id,
      },
    });

    // ✅ REAL-TIME SOCKET EMISSION (Client Message)
    emitToCompany(companyId, "conversation_updated", {
      conversationId: conversation.id,
      lastMessage: text,
      updatedAt: new Date(),
    });
    emitToConversation(conversation.id, "new_message", clientMsg);

    if (conversation.mode === ConversationMode.HUMAN) return;

    /* -------------------------------
       1. START COMMAND
    -------------------------------- */
    if (text === "/start") {
      const welcomeMsg = buildWelcomeMessage(company, name);
      await sendTelegramMessage(botToken, chatId, welcomeMsg);
      return;
    }

    /* -------------------------------
       2. FULL MENU COMMAND
    -------------------------------- */
    const structuredMenu = company.botStructuredMenu as StructuredMenu | null;
    const categories = structuredMenu?.categories || [];

    if (text.toLowerCase() === "menu" || text.toLowerCase() === "/menu") {
      if (!categories.length) {
        await sendTelegramMessage(botToken, chatId, "Menu is currently unavailable.");
        return;
      }

      let menuMsg = "📜 *Our Menu*\n\n";
      categories.forEach((cat) => {
        menuMsg += `*${cat.name}*\n`;
        cat.items.forEach((item) => {
          menuMsg += `- ${item.name}: ₹${item.price}\n`;
        });
        menuMsg += "\n";
      });

      await sendTelegramMessage(botToken, chatId, menuMsg);
      return;
    }

    /* -------------------------------
       3. KEYWORD DETECTION (Category/Item)
    -------------------------------- */
    const input = text.toLowerCase().trim();
    const matchedCategory = categories.find(cat =>
      input === cat.name.toLowerCase() ||
      input === cat.name.toLowerCase() + "s" || // plural
      (input.length > 3 && cat.name.toLowerCase().includes(input))
    );

    if (matchedCategory) {
      let catMsg = `📜 *${matchedCategory.name}*\n\n`;
      matchedCategory.items.forEach(item => {
        catMsg += `- ${item.name}: ₹${item.price}\n`;
      });

      await sendTelegramMessage(botToken, chatId, catMsg);

      const botMsg = await prisma.message.create({
        data: {
          content: catMsg,
          sender: MessageSender.SYSTEM,
          conversationId: conversation.id,
        }
      });

      emitToCompany(companyId, "conversation_updated", {
        conversationId: conversation.id,
        lastMessage: catMsg,
        updatedAt: new Date(),
      });
      emitToConversation(conversation.id, "new_message", botMsg);
      return;
    }

    /* -------------------------------
       4. ORDER DETECTION
    -------------------------------- */
    const normalizedText = normalize(text);
    let detectedItems: { name: string; price: number; quantity: number }[] = [];

    for (const category of categories) {
      for (const item of category.items) {
        const normalizedItemName = normalize(item.name);
        if (normalizedText.includes(normalizedItemName)) {
          let quantity = 1;
          const qtyMatch = normalizedText.match(new RegExp(`(\\d+)\\s*${normalizedItemName}`));
          if (qtyMatch?.[1]) quantity = parseInt(qtyMatch[1], 10);

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
      let summaryParts: string[] = [];

      for (const entry of detectedItems) {
        total += entry.price * entry.quantity;
        summaryParts.push(`${entry.quantity} x ${entry.name}`);
      }

      const summary = summaryParts.join(", ");

      const recentOrder = await prisma.order.findFirst({
        where: {
          conversationId: conversation.id,
          summary,
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
        },
      });

      if (!recentOrder) {
        await prisma.order.create({
          data: {
            companyId,
            conversationId: conversation.id,
            leadId: lead.id,
            summary,
            amount: total,
            source: OrderSource.BOT_DETECTED,
            approvalStatus: OrderApprovalStatus.PENDING,
          },
        });
      }

      const reply = `🛒 Order Detected:\n\n${summary}\n\n💰 Total: ₹${total}\n\n⏳ Waiting for approval from our team.`;

      const systemMsg = await prisma.message.create({
        data: {
          content: reply,
          sender: MessageSender.SYSTEM,
          conversationId: conversation.id,
        },
      });

      emitToCompany(companyId, "conversation_updated", {
        conversationId: conversation.id,
        lastMessage: reply,
        updatedAt: new Date(),
      });
      emitToConversation(conversation.id, "new_message", systemMsg);

      await sendTelegramMessage(botToken, chatId, reply);
      return;
    }

    /* -------------------------------
       5. AI REPLY (SAFE WRAPPED)
    -------------------------------- */
    let aiReply = "Thank you! Our team will assist you shortly.";

    try {
      aiReply = await generateBotReply(
        text,
        company.botBusinessType || "general business",
        structuredMenu
      );
    } catch (err) {
      console.error("AI reply failed:", err);
    }

    const botMsg = await prisma.message.create({
      data: {
        content: aiReply,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    emitToCompany(companyId, "conversation_updated", {
      conversationId: conversation.id,
      lastMessage: aiReply,
      updatedAt: new Date(),
    });
    emitToConversation(conversation.id, "new_message", botMsg);

    await sendTelegramMessage(botToken, chatId, aiReply);

  } catch (err) {
    console.error("processTelegramMessage error:", err);
  }
}
