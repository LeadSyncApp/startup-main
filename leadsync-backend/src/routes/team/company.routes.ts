import { Router } from "express";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authMiddleware } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import { notificationService } from "../../services/infrastructure/notification.service";

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

    // Soft-delete: just flip the flag
    await prisma.company.update({
      where: { id: companyId },
      data: { isArchived: true },
    });

    // Set all users to offline
    await prisma.user.updateMany({
      where: { companyId },
      data: { isOnline: false, isAvailable: false },
    });

    // Unassign all conversations
    await prisma.conversation.updateMany({
      where: { companyId, claimedById: { not: null } },
      data: { claimedById: null, status: ConversationStatus.OPEN },
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

    // 2. InternalNotes depend on Conversations
    // TODO: internalNote model removed from schema

    // 3. OrderLogs depend on Orders
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
    // TODO: internalNote model removed from schema
    await prisma.user.deleteMany({ where: { companyId } });

    // 10. Other company-scoped records
    await prisma.merchantFile.deleteMany({ where: { companyId } });
    await prisma.botKnowledge.deleteMany({ where: { companyId } });
    await prisma.automationRule.deleteMany({ where: { companyId } });
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

    res.json({ company });
  } catch (error: any) {
    console.error("Company status error:", error);
    res.status(500).json({ message: "Failed to get company status" });
  }
});

export default router;