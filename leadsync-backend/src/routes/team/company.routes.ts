import { Router } from "express";
import crypto from "crypto";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { notificationService } from "../../services/infrastructure/notification.service";
import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";
import { Channel, StandardMessageFrame } from "../../interfaces/messaging.interface";
import { cacheService } from "../../services/infrastructure/cache.service";

const router = Router();

const BATCH_SIZE = 200;

/**
 * Helper: Delete child records in batches to avoid long table locks
 */
async function batchDelete(
  model: "message" | "conversation" | "order" | "lead" | "user",
  companyId: string
): Promise<number> {
  let total = 0;
  let deleted = BATCH_SIZE;

  while (deleted === BATCH_SIZE) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `DELETE FROM "${model}" WHERE "companyId" = $1 LIMIT ${BATCH_SIZE}`,
        companyId
      );
      deleted = Number(result);
      total += deleted;
    } catch (err) {
      console.error(`batchDelete ${model} error:`, err);
      break;
    }
  }

  return total;
}

/* =====================================================
   Soft-Delete (Archive) Company
   POST /api/company/archive
   Sets isArchived = true instead of deleting.
   Safe, instant, no FK issues.
===================================================== */
router.post("/archive", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Only the Owner can archive the company" });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, isArchived: true, name: true },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (company.isArchived) {
      return res.status(400).json({ message: "Company is already archived" });
    }

    // Soft-delete and update state inside a single transaction
    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete: just flip the flag
      await tx.company.update({
        where: { id: companyId },
        data: { isArchived: true },
      });

      // 2. Set all users to offline
      await tx.user.updateMany({
        where: { companyId },
        data: { isOnline: false, isAvailable: false },
      });

      // 3. Unassign all conversations
      await tx.conversation.updateMany({
        where: { companyId, claimedById: { not: null } },
        data: { claimedById: null, status: ConversationStatus.OPEN },
      });
    });

    // Notify the user who archived
    await notificationService.notifyUser(
      userId,
      "🏢 Company Archived",
      `Your company "${company.name}" has been archived. You can restore it anytime.`,
      "SYSTEM"
    );

    res.json({
      message: "Company archived successfully. All data is preserved and can be restored.",
    });
  } catch (error: any) {
    console.error("Archive company error:", error);
    res.status(500).json({ message: "Failed to archive company" });
  }
});

/* =====================================================
   Restore Archived Company
   POST /api/company/restore
===================================================== */
router.post("/restore", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Only the Owner can restore the company" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, isArchived: true, name: true },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.isArchived) {
      return res.status(400).json({ message: "Company is not archived" });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { isArchived: false },
    });

    res.json({
      message: `Company "${company.name}" has been restored successfully.`,
    });
  } catch (error: any) {
    console.error("Restore company error:", error);
    res.status(500).json({ message: "Failed to restore company" });
  }
});

/* =====================================================
   Permanently Delete Company (Batch Cleanup)
   POST /api/company/purge
   Deletes all data in batches before removing the company.
   Only works if company is already archived.
   IRREVERSIBLE — all data will be lost.
===================================================== */
router.post("/purge", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Only the Owner can delete the company" });
    }

    // Require archiving first as a safety measure
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, isArchived: true, name: true },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (!company.isArchived) {
      return res.status(400).json({
        message: "Company must be archived first before permanent deletion. Use /api/company/archive first.",
      });
    }

    // Delete in dependency order (children before parents)
    console.log(`[Purge] Starting batch deletion for company ${companyId}`);

    // 1. Messages depend on Conversations
    const deletedMessages = await batchDelete("message", companyId);
    console.log(`[Purge] Deleted ${deletedMessages} messages`);

    // 2. OrderLogs depend on Orders
    await prisma.orderLog.deleteMany({ where: { companyId } });

    // 4. OrderItems depend on Orders
    await prisma.orderItem.deleteMany({ where: { companyId } });

    // 5. Invoices depend on Orders
    await prisma.invoice.deleteMany({ where: { companyId } });

    // 6. Orders depend on Conversations & Leads
    await prisma.order.deleteMany({ where: { companyId } });

    // 7. Conversations depend on Leads
    await prisma.conversation.deleteMany({ where: { companyId } });

    // 8. Leads
    await prisma.lead.deleteMany({ where: { companyId } });

    // 9. Users, Invitations, Notifications, etc.
    await prisma.notification.deleteMany({ where: { companyId } });
    await prisma.invitation.deleteMany({ where: { companyId } });
    await prisma.agentFeedPost.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });

    // 10. Other company-scoped records
    await prisma.merchantFile.deleteMany({ where: { companyId } });
    await prisma.botKnowledge.deleteMany({ where: { companyId } });
    await prisma.notificationTemplate.deleteMany({ where: { companyId } });
    await prisma.customFieldDefinition.deleteMany({ where: { companyId } });
    await prisma.broadcast.deleteMany({ where: { companyId } });
    await prisma.companyAnalyticsRollup.deleteMany({ where: { companyId } });

    // 11. Finally delete the Company itself (all FK foreign refs are cleared)
    await prisma.company.delete({ where: { id: companyId } });

    console.log(`[Purge] Company ${companyId} fully deleted`);

    res.json({
      message: `Company "${company.name}" and all associated data have been permanently deleted.`,
      stats: {
        messagesDeleted: deletedMessages,
      },
    });
  } catch (error: any) {
    console.error("Purge company error:", error);
    res.status(500).json({ message: "Failed to purge company. Some data may have been deleted." });
  }
});

/* =====================================================
   Check Company Archive Status
   GET /api/company/status
===================================================== */
router.get("/status", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;

    if (companyId) {
      const forceRefresh = req.query.refresh === "true";
      const cacheKey = `company_status_${companyId}`;
      const cached = forceRefresh ? null : await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        isArchived: true,
        telegramConnected: true,
        instagramConnected: true,
        whatsAppPhoneNumberId: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const responseData = { company };

    if (companyId) {
      await cacheService.set(`company_status_${companyId}`, responseData, 60);
    }

    res.json(responseData);
  } catch (error: any) {
    console.error("Company status error:", error);
    res.status(500).json({ message: "Failed to get company status" });
  }
});

/* =====================================================
   Rotate Website Webhook Secret
   POST /api/company/rotate-webhook-secret
   Generates a new HMAC-SHA256 secret for the Custom
   Website webhook integration. The old secret is
   immediately invalidated.
   OWNER only.
===================================================== */
router.post("/rotate-webhook-secret", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Only the Owner can rotate the webhook secret" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, websiteWebhookSecret: true },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const newSecret = crypto.randomBytes(32).toString("hex");

    await prisma.company.update({
      where: { id: companyId },
      data: { websiteWebhookSecret: newSecret },
    });

    console.log(`[rotate-webhook-secret] Company ${companyId} secret rotated`);

    res.json({
      message: "Website webhook secret rotated. Update your webhook URL with the new secret immediately — the old secret is no longer accepted.",
      secret: newSecret,
    });
  } catch (error: any) {
    console.error("Rotate webhook secret error:", error);
    res.status(500).json({ message: "Failed to rotate webhook secret" });
  }
});

/* =====================================================
   Get Webhook Delivery Logs
   GET /api/company/webhook-logs
   Returns the last N delivery attempts for the caller's company.
   OWNER or MANAGER only.
===================================================== */
router.get("/webhook-logs", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Access denied" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await prisma.webhookDeliveryLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        platform: true,
        outcome: true,
        reason: true,
        statusCode: true,
        createdAt: true,
      },
    });

    const total = await prisma.webhookDeliveryLog.count({ where: { companyId } });

    res.json({ logs, total, limit, offset });
  } catch (error: any) {
    console.error("Webhook logs error:", error);
    res.status(500).json({ message: "Failed to fetch webhook logs" });
  }
});

/* =====================================================
   Replay Webhook Delivery
   POST /api/company/webhook-logs/:logId/replay
   Re-runs a stored failed delivery through the same
   processing pipeline. Only for outcome = error or rejected.
   OWNER only.
===================================================== */
router.post("/webhook-logs/:logId/replay", authMiddleware as any, async (req: any, res: any) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;
    const { logId } = req.params;

    if (!can(userRole, "company.delete")) {
      return res.status(403).json({ message: "Only the Owner can replay webhook deliveries" });
    }

    const log = await prisma.webhookDeliveryLog.findUnique({
      where: { id: logId },
      select: { id: true, companyId: true, outcome: true, rawPayload: true, platform: true },
    });

    if (!log || log.companyId !== companyId) {
      return res.status(404).json({ message: "Log entry not found" });
    }

    if (log.outcome === "accepted" || log.outcome === "ignored") {
      return res.status(400).json({ message: "Only error or rejected deliveries can be replayed" });
    }

    if (!log.rawPayload) {
      return res.status(400).json({ message: "No raw payload stored for this delivery" });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(log.rawPayload);
    } catch {
      return res.status(400).json({ message: "Stored payload is not valid JSON" });
    }

    const boss = pgBossService.getBoss();
    const frame: StandardMessageFrame = {
      channel: Channel.WEBSITE,
      externalChatId: parsedBody.phone || parsedBody.customer?.phone || "unknown",
      text: `Replayed ${log.platform} webhook: ${JSON.stringify(parsedBody).slice(0, 500)}`,
      contactName: parsedBody.name || parsedBody.customer?.name || "Replayed Customer",
      isCallback: false,
      companyId,
    };

    await boss.send("webhook.process", frame);

    // Log the replay itself
    await prisma.webhookDeliveryLog.create({
      data: {
        companyId,
        platform: log.platform,
        outcome: "accepted",
        statusCode: 202,
        reason: `Replay of log ${logId}`,
        rawPayload: log.rawPayload,
      },
    });

    console.log(`[replay] Replayed delivery ${logId} for company ${companyId}`);
    res.json({ message: "Delivery replayed successfully", logId });
  } catch (error: any) {
    console.error("Replay error:", error);
    res.status(500).json({ message: "Failed to replay delivery" });
  }
});

export default router;