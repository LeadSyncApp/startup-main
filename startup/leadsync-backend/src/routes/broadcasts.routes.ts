import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import axios from "axios";

const createBroadcastSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Message too long (max 1000 chars)"),
  channel: z.enum(["TELEGRAM", "INSTAGRAM"]),
  targetSegment: z.enum(["ALL", "NEW", "REGULAR", "VIP", "CHURN_RISK"]).default("ALL"),
});

const router = Router();

/* helpers */
async function sendTelegram(token: string, chatId: string, text: string) {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
    });
}

async function sendInstagram(accessToken: string, igUserId: string, text: string) {
    await axios.post(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${accessToken}`,
        { recipient: { id: igUserId }, message: { text } }
    );
}

/* =====================================
   POST /api/broadcasts
   Create + trigger broadcast (OWNER/ADMIN only)
===================================== */
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const parsed = createBroadcastSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.issues[0].message });
        }
        const { message, channel, targetSegment } = parsed.data;

        const companyId = req.user.companyId;

        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return res.status(404).json({ message: "Company not found" });

        // Validate channel is connected
        if (channel === "TELEGRAM" && !company.telegramBotToken) {
            return res.status(400).json({ message: "Telegram is not connected for this company" });
        }
        if (channel === "INSTAGRAM" && !company.instagramPageAccessToken) {
            return res.status(400).json({ message: "Instagram is not connected for this company" });
        }

        // Build lead filter
        const leadWhere: any = { companyId, channel };
        if (targetSegment !== "ALL") leadWhere.segment = targetSegment;

        const leads = await prisma.lead.findMany({ where: leadWhere, select: { id: true, contact: true } });

        if (leads.length === 0) {
            return res.status(200).json({ message: "No leads matching the criteria", sent: 0 });
        }

        // Create broadcast record
        const broadcast = await prisma.broadcast.create({
            data: { companyId, message, channel, targetSegment: targetSegment || "ALL", status: "SENDING" },
        });

        // Respond immediately — send async
        res.status(201).json({ id: broadcast.id, total: leads.length });

        // Fire-and-forget delivery
        (async () => {
            let sentCount = 0, failedCount = 0;
            for (const lead of leads) {
                try {
                    if (channel === "TELEGRAM" && company.telegramBotToken) {
                        await sendTelegram(company.telegramBotToken, lead.contact, message);
                        sentCount++;
                    } else if (channel === "INSTAGRAM" && company.instagramPageAccessToken) {
                        await sendInstagram(company.instagramPageAccessToken, lead.contact, message);
                        sentCount++;
                    }
                } catch {
                    failedCount++;
                }
                // Small delay to avoid rate-limits
                await new Promise((r) => setTimeout(r, 150));
            }
            await prisma.broadcast.update({
                where: { id: broadcast.id },
                data: { sentCount, failedCount, status: "DONE", completedAt: new Date() },
            });
            console.log(`📣 Broadcast ${broadcast.id} done — sent ${sentCount}, failed ${failedCount}`);
        })();

    } catch (error) {
        console.error("Broadcast error:", error);
        res.status(500).json({ message: "Broadcast failed" });
    }
});

/* =====================================
   GET /api/broadcasts
   List all broadcasts for company
===================================== */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const broadcasts = await prisma.broadcast.findMany({
            where: { companyId: req.user.companyId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        res.json(broadcasts);
    } catch (error) {
        console.error("Get broadcasts error:", error);
        res.status(500).json({ message: "Failed to fetch broadcasts" });
    }
});

export default router;
