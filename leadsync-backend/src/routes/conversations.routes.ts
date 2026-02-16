import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { ConversationMode, MessageSender } from "@prisma/client";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const conversations = await prisma.conversation.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        mode: true,
        lead: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { content: true },
        },
      },
    });

    res.json(
      conversations.map((c) => ({
        id: c.id,
        mode: c.mode,
        lead: c.lead,
        lastMessage: c.messages[0]?.content || "",
      }))
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

router.get("/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        conversation: { companyId },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  } catch {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.post("/:id/send", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const companyId = req.user!.companyId;

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, companyId },
      include: { lead: true, company: true },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await prisma.message.create({
      data: {
        content,
        sender: MessageSender.AGENT,
        conversationId: conversation.id,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { mode: ConversationMode.HUMAN },
    });

    if (conversation.company.telegramBotToken) {
      await sendTelegramMessage(
        conversation.company.telegramBotToken,
        conversation.lead.contact,
        content
      );
    }

    res.json(message);
  } catch {
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
