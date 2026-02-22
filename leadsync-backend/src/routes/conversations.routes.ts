import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "../bot/telegram.sender";
import { ConversationMode, MessageSender, Role } from "@prisma/client";
import { emitToCompany, emitToConversation, safeEmitConversationUpdate, emitToAgent, emitToCompanyAdmin } from "../lib/socket";

const router = Router();

/* =========================================
   GET ALL CONVERSATIONS
========================================= */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId, role } = req.user!;

    // 🔒 PRIVACY FILTER: Agents only see Unclaimed OR Their Own
    const whereClause: any = { companyId };
    if (role === "AGENT") {
      whereClause.OR = [
        { assignedToId: null },
        { assignedToId: userId }
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      orderBy: [
        { priorityScore: "desc" }, // 💰 High Value / Urgent First
        { updatedAt: "desc" }      // Recent activity second
      ],
      take: 21, // Fetch 1 extra to determine if next page exists
      cursor: req.query.cursor ? { id: String(req.query.cursor) } : undefined,
      select: {
        id: true,
        mode: true,
        updatedAt: true,
        intent: true,
        priorityScore: true, // Needed for UI badge
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
        intent: c.intent,
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
    const userId = req.user!.userId; // Authenticated user
    const userRole = req.user!.role; // Role

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        companyId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } }
      } as any
    }) as any;

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 🔒 STRICT PRIVACY: Prevent agents from peeking at others' conversations
    if (userRole === "AGENT" && conversation.assignedToId && conversation.assignedToId !== userId) {
      return res.status(403).json({ message: "⛔ Access Denied: This conversation is assigned to another agent." });
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
        version: true,
        priority: true,
        isUrgent: true,
      },
    });

    res.json({
      mode: conversation.mode,
      messages,
      order: latestOrder || null,
      isLocked: conversation.assignedToId && conversation.assignedToId !== userId && userRole === "AGENT",
      assignedTo: conversation.assignedTo,
      sessionState: conversation.sessionState
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;

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
    }) as any;

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // ENFORCE LOCK
    if (conversation.assignedToId && conversation.assignedToId !== userId && userRole === "AGENT") {
      return res.status(403).json({ message: "Conversation is locked by another agent." });
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

    // ✅ SECURE REAL-TIME EMISSION
    // Intelligent routing: Only to Assigned + Admins
    safeEmitConversationUpdate(conversation, "conversation_updated", {
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

    // ✅ SECURE REAL-TIME EMISSION
    safeEmitConversationUpdate(updated, "status_changed", { // Reuse status/mode event logic or generic update
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
    let updatedCalls;

    if (assignedToId) {
      // ✅ ATOMIC CLAIM: Only update if assignedToId is currently NULL
      const result = await prisma.conversation.updateMany({
        where: {
          id: conversation.id,
          assignedToId: null // 🔒 Lock: Must be unclaimed
        },
        data: {
          assignedToId,
          status: "ASSIGNED",
          updatedAt: new Date()
        }
      });

      if (result.count === 0) {
        // Claim failed. Check why.
        const fresh = await prisma.conversation.findUnique({ where: { id: conversation.id } });
        if (fresh?.assignedToId === assignedToId) {
          // Already assigned to me (idempotent success)
          updatedCalls = fresh;
        } else {
          return res.status(409).json({ message: "⚠️ Too late! This conversation was just claimed by another agent." });
        }
      } else {
        // Fetch the updated record
        updatedCalls = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: { assignedTo: { select: { id: true, name: true } } }
        });
      }
    } else {
      // UNASSIGN (Release)
      updatedCalls = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          assignedToId: null,
          status: "OPEN",
          updatedAt: new Date(),
        },
        include: { assignedTo: { select: { id: true, name: true } } }
      });
    }

    const updated = updatedCalls as any;

    if (assignedToId) {
      // CASE: CLAIMING (Assigning)
      // 1. Notify public channel to REMOVE it from their list (Privacy)
      emitToCompany(companyId, "conversation_removed", { conversationId: conversation.id });

      // 2. Notify specific agent that they got it
      emitToAgent(assignedToId, "conversation_added", updated);
    } else {
      // CASE: UNASSIGNING (Releasing)
      // 1. Notify public channel to ADD it back to everyone's list
      emitToCompany(companyId, "conversation_added", updated);
    }

    // 3. Always notify Admins
    emitToCompanyAdmin(companyId, "conversation_updated", updated);

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

    safeEmitConversationUpdate(updated, "status_changed", {
      conversationId: conversation.id,
      status
    });

    res.json(updated);
  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/* =========================================
   VOICE REPLY — Agent triggers TTS voice message to customer
   POST /conversations/:id/voice-reply
   Body: { messageId?: string }  (optional: for context)
========================================= */
router.post("/:id/voice-reply", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { companyId } = req.user!;

    // Fetch conversation + lead contact + company token
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        lead: { select: { contact: true } },
        company: { select: { telegramBotToken: true } },
      },
    });

    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.company.telegramBotToken) return res.status(400).json({ message: "Telegram not connected" });

    // Get last SYSTEM (bot) reply to convert to voice
    const lastBotMsg = await prisma.message.findFirst({
      where: { conversationId: id, sender: MessageSender.SYSTEM },
      orderBy: { createdAt: "desc" },
    });

    if (!lastBotMsg) return res.status(404).json({ message: "No bot reply found to convert to voice" });

    const { sarvamService } = await import("../services/sarvam.service");
    const { TelegramAdapter } = await import("../adapters/telegram.adapter");

    const audioBuffer = await sarvamService.textToSpeech(lastBotMsg.content, "en-IN");
    if (!audioBuffer) return res.status(503).json({ message: "TTS generation failed. Try again." });

    const adapter = new TelegramAdapter(conversation.company.telegramBotToken);
    await adapter.sendVoice(conversation.lead.contact, audioBuffer);

    console.log(`🔊 Agent voice reply sent to ${conversation.lead.contact}`);
    res.json({ success: true });

  } catch (error) {
    console.error("Voice reply error:", error);
    res.status(500).json({ message: "Failed to send voice reply" });
  }
});

export default router;
