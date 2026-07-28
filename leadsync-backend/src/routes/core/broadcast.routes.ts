import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, authorizePermission, AuthRequest } from "../../middleware/auth.middleware";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { decryptSecret } from "../../utils/encryption";
import { Channel } from "@prisma/client";

const router = Router();

/**
 * GET /api/broadcasts
 * Fetch broadcast history
 */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const broadcasts = await (prisma.broadcast as any).findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    res.json(broadcasts);
  } catch (error) {
    console.error("Fetch broadcasts error:", error);
    res.status(500).json({ message: "Failed to fetch broadcasts" });
  }
});

/**
 * POST /api/broadcasts
 * Create and send a new broadcast
 */
router.post("/", authMiddleware, authorizePermission("broadcast.send"), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { title, message, targetTags, targetSegments } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // 1. Fetch Company for Bot Token
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company || !company.telegramBotToken) {
      return res.status(400).json({ message: "Telegram bot not connected" });
    }

    // 2. Fetch Targeted Leads
    const where: any = {
      companyId,
      deletedAt: null,
      channel: Channel.TELEGRAM // Currently only broadcasting on Telegram
    };

    if (targetTags && targetTags.length > 0) {
      where.tags = { hasSome: targetTags };
    }

    if (targetSegments && targetSegments.length > 0) {
      where.segment = { in: targetSegments };
    }

    const leads = await prisma.lead.findMany({
      where,
      select: { contact: true, id: true }
    });

    if (leads.length === 0) {
      return res.status(200).json({ message: "No recipients found for selected filters", recipientCount: 0 });
    }

    // 3. Send Messages (Background or parallel)
    const token = decryptSecret(company.telegramBotToken)!;
    
    // In a real production app, we'd queue these to avoid rate limits
    // For this build, we'll do it in parallel with chunks or just Promise.all for now
    const results = await Promise.allSettled(
      leads.map(lead => sendTelegramMessage(token, lead.contact, message))
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;

    // 4. Record Broadcast
    const broadcast = await (prisma.broadcast as any).create({
      data: {
        companyId,
        title,
        message,
        targetTags: targetTags || [],
        targetSegments: targetSegments || [],
        recipientCount: successCount,
        status: "SENT"
      }
    });

    res.json({
      message: `Broadcast sent to ${successCount} customers`,
      broadcast
    });

  } catch (error) {
    console.error("Broadcast send error:", error);
    res.status(500).json({ message: "Failed to send broadcast" });
  }
});

export default router;
