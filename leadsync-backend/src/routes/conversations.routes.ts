import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { ConversationMode, MessageSender } from "@prisma/client";
import { emitToCompany, emitToConversation } from "../lib/socket";

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
      take: 21, // Fetch 1 extra to determine if next page exists
      cursor: req.query.cursor ? { id: String(req.query.cursor) } : undefined,
      select: {
        id: true,
        mode: true,
        updatedAt: true,
        lead: {
          select: {
            name: true,
            contact: true,
            channel: true,
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            content: true,
          }
        }
      }
    });

    const hasNextPage = conversations.length > 20;
    const result = hasNextPage ? conversations.slice(0, 20) : conversations;
    const nextCursor = hasNextPage ? result[result.length - 1].id : null;

    res.json({
      items: result.map((c) => ({
        id: c.id,
        mode: c.mode,
        lead: c.lead,
        updatedAt: c.updatedAt,
        lastMessage: c.messages[0]?.content || "",
      })),
      nextCursor
    });
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
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        sender: true,
        createdAt: true,
      }
    });

    // Reverse to show oldest first in UI
    messages.reverse();

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

    // NOTE: Auto-switch removed as per user request. Mode strictly manual.

    if (conversation.company.telegramBotToken) {
      // Fire-and-forget: Don't await
      sendTelegramMessage(
        conversation.company.telegramBotToken,
        conversation.lead.contact,
        content.trim()
      ).catch(console.error);
    }

    // ✅ REAL-TIME SOCKET EMISSION
    // 1. Notify company for list updates
    emitToCompany(companyId, "conversation_updated", {
      conversationId: conversation.id,
      lastMessage: content.trim(),
      updatedAt: new Date(),
    });

    // 2. Notify specific conversation for active chat real-time feel
    emitToConversation(conversation.id, "new_message", message);

    res.json({
      ...message,
      mode: conversation.mode,
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

    // ✅ REAL-TIME SOCKET EMISSION (Immediate Mode Sync)
    emitToCompany(companyId, "mode_changed", {
      conversationId: conversation.id,
      mode
    });

    // Create a system message so it appears instantly in the chat
    const systemMsg = await prisma.message.create({
      data: {
        content: `Chat mode switched to ${mode}`,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    emitToConversation(conversation.id, "new_message", systemMsg);

    res.json(updated);

  } catch (error) {
    console.error("Mode toggle error:", error);
    res.status(500).json({ message: "Failed to update mode" });
  }
});

/* =========================================
   CLEAR HISTORY
   Deletes all messages for a conversation
========================================= */
router.delete("/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Delete all messages associated with this conversation
    await prisma.message.deleteMany({
      where: { conversationId: conversation.id },
    }).catch(err => console.log("Nothing to delete or already empty"));

    // Add a system message to indicate history was cleared
    const systemMsg = await prisma.message.create({
      data: {
        content: "Chat history was cleared by the agent.",
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      },
    });

    // ✅ REAL-TIME SOCKET EMISSION
    emitToConversation(conversation.id, "messages_cleared", systemMsg);

    res.json({ message: "History cleared successfully" });
  } catch (error) {
    console.error("Clear history error:", error);
    res.status(500).json({ message: "Failed to clear history" });
  }
});


/* =========================================
   ASSIGN AGENT (Shared Inbox)
========================================= */
router.patch("/:id/assign", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { assignedToId } = req.body; // userId or null to unassign
    const companyId = req.user!.companyId;

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, companyId },
    });

    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    // Update assignment - forceful cast to avoid IDE type errors
    const updatedCalls = await (prisma.conversation as any).update({
      where: { id: conversation.id },
      data: {
        assignedToId: assignedToId || null,
        status: assignedToId ? "ASSIGNED" : "OPEN",
        updatedAt: new Date(),
      },
      include: { assignedTo: { select: { id: true, name: true } } }
    });

    const updated = updatedCalls as any;

    // Notify team
    emitToCompany(companyId, "conversation_assigned", {
      conversationId: conversation.id,
      assignedTo: updated.assignedTo,
      status: updated.status
    });

    // System message
    const agentName = updated.assignedTo?.name || "System";
    const statusText = assignedToId ? `assigned to ${agentName}` : "unassigned";

    const sysMsg = await prisma.message.create({
      data: {
        content: `Conversation was ${statusText}.`,
        sender: MessageSender.SYSTEM,
        conversationId: conversation.id,
      }
    });
    emitToConversation(conversation.id, "new_message", sysMsg);

    res.json(updated);
  } catch (error) {
    console.error("Assign error:", error);
    res.status(500).json({ message: "Assignment failed" });
  }
});

/* =========================================
   UPDATE STATUS (Resolved/Open)
========================================= */
router.patch("/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body; // OPEN, RESOLVED, SNOOZED
    const companyId = req.user!.companyId;

    // Explicit valid statuses
    const validStatuses = ["OPEN", "ASSIGNED", "RESOLVED", "SNOOZED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, companyId },
    });

    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    // Forceful cast
    const updated = await (prisma.conversation as any).update({
      where: { id: conversation.id },
      data: { status, updatedAt: new Date() }
    });

    emitToCompany(companyId, "status_changed", {
      conversationId: conversation.id,
      status
    });

    res.json(updated);
  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

export default router;
