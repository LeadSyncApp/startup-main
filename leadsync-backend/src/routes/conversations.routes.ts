import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { ConversationMode, MessageSender } from "@prisma/client";

const router = Router();

/* =========================================
   GET ALL CONVERSATIONS
========================================= */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const conversations = await prisma.conversation.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: {
        lead: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
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
    console.error("Fetch conversations error:", error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

/* =========================================
   GET MESSAGES + LATEST ORDER
========================================= */
router.get("/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const latestOrder = await prisma.order.findFirst({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        summary: true,
        amount: true,
        approvalStatus: true,
        status: true,
      },
    });

    res.json({
      mode: conversation.mode,
      messages,
      order: latestOrder || null,
    });

  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

/* =========================================
   AGENT SEND MESSAGE
========================================= */
router.post("/:id/send", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const companyId = req.user!.companyId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content required" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        lead: true,
        company: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        sender: MessageSender.AGENT,
        conversationId: conversation.id,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: ConversationMode.HUMAN,
        updatedAt: new Date(),
      },
    });

    if (conversation.company.telegramBotToken) {
      await sendTelegramMessage(
        conversation.company.telegramBotToken,
        conversation.lead.contact,
        content.trim()
      );
    }

    res.json({
      ...message,
      mode: ConversationMode.HUMAN,
    });

  } catch (error) {
    console.error("Agent send error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

/* =========================================
   TOGGLE MODE
========================================= */
router.patch("/:id/mode", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { mode } = req.body;
    const companyId = req.user!.companyId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode,
        updatedAt: new Date(),
      },
    });

    res.json(updated);

  } catch (error) {
    console.error("Mode toggle error:", error);
    res.status(500).json({ message: "Failed to update mode" });
  }
});

export default router;
  