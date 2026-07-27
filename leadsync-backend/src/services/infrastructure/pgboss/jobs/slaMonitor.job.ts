import { prisma } from "../../../../lib/prisma";
import { MessageSender } from "@prisma/client";
import { businessNotificationService } from "../../businessNotification.service";

export const MISSED_REPLY_SLA_JOB_NAME = "CHECK_MISSED_REPLY_SLA";

export async function processSlaCheckJob(): Promise<number> {
  const DEFAULT_SLA_HOURS = 2;
  const cutoffDate = new Date(Date.now() - DEFAULT_SLA_HOURS * 60 * 60 * 1000);

  // Find candidate conversations that:
  // 1. Are active (deletedAt is null, status != RESOLVED)
  // 2. Have not already been notified for SLA in this unanswered window (slaNotifiedAt is null)
  // 3. Were updated before the cutoff date
  const candidates = await (prisma as any).conversation.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["RESOLVED"] },
      slaNotifiedAt: null,
      updatedAt: { lte: cutoffDate },
    },
    include: {
      lead: { select: { id: true, name: true, contact: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { sender: true, content: true, createdAt: true },
      },
    },
    take: 50,
  });

  let notifiedCount = 0;

  for (const conv of candidates) {
    const latestMessage = conv.messages?.[0];

    // Check if the latest message was sent by the customer and created before the cutoff
    if (latestMessage && latestMessage.sender === MessageSender.CLIENT && latestMessage.createdAt <= cutoffDate) {
      const leadNameOrContact = conv.lead?.name || conv.lead?.contact || "Customer";
      const assignedToId = conv.claimedById || conv.assignedToId;

      await businessNotificationService.notifySlaTimeout({
        companyId: conv.companyId,
        leadNameOrContact,
        messageText: latestMessage.content,
        assignedToId,
        hoursUnanswered: DEFAULT_SLA_HOURS,
      }).catch((err) => console.error(`❌ Failed to send SLA timeout notification for conversation ${conv.id}:`, err));

      // Mark conversation as notified to prevent duplicate alerts on subsequent cron runs
      await (prisma as any).conversation.update({
        where: { id: conv.id },
        data: { slaNotifiedAt: new Date() },
      }).catch((err: any) => console.error(`❌ Failed to update slaNotifiedAt for conversation ${conv.id}:`, err));

      notifiedCount++;
    }
  }

  if (notifiedCount > 0) {
    console.log(`⏱️ [SLA Monitor] Fired SLA timeout notifications for ${notifiedCount} unanswered conversation(s).`);
  }

  return notifiedCount;
}
