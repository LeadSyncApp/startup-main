import { prisma } from "../lib/prisma";
import { ConversationStatus, ConversationMode, Prisma } from "@prisma/client";
import { safeEmitConversationUpdate } from "../lib/socket";
import type { Server as SocketIOServer } from "socket.io";
import { businessNotificationService } from "./infrastructure/businessNotification.service";

/**
 * Find the staff member with the fewest active HUMAN conversations
 * who is online, available, and has STAFF or MANAGER role.
 *
 * Steps:
 * 1. Query online STAFF/MANAGER users for the company
 * 2. groupBy on conversation to count active assignments
 * 3. Sort by load (asc), then lastSeenAt (asc — longest-rested first)
 * 4. Return the best candidate or null
 */
export async function findLeastLoadedStaff(
  companyId: string
): Promise<{ id: string; firstName: string | null; lastName: string | null } | null> {
  // 1. Find online, available STAFF and MANAGER users
  const onlineStaff = await prisma.user.findMany({
    where: {
      companyId,
      isOnline: true,
      isAvailable: true,
      isActive: true,
      role: { in: ["STAFF", "MANAGER"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lastSeenAt: true,
    },
  });

  if (onlineStaff.length === 0) {
    console.log(`[assignment] No online/available staff found for company ${companyId}`);
    return null;
  }

  // 2. Count active HUMAN conversations per staff member
  const staffIds = onlineStaff.map((s) => s.id);

  const conversationCounts = await prisma.conversation.groupBy({
    by: ["claimedById"],
    where: {
      companyId,
      claimedById: { in: staffIds },
      mode: ConversationMode.HUMAN,
      status: { notIn: [ConversationStatus.RESOLVED, ConversationStatus.SNOOZED] },
      deletedAt: null,
    },
    _count: { id: true },
  });

  // 3. Build a load map
  const loadMap = new Map<string, number>();
  for (const id of staffIds) {
    loadMap.set(id, 0);
  }
  for (const row of conversationCounts) {
    if (row.claimedById) {
      loadMap.set(row.claimedById, row._count.id);
    }
  }

  // 4. Sort: lowest activeCount first, then longest-rested (earliest lastSeenAt)
  const sorted = onlineStaff
    .map((staff) => ({
      ...staff,
      activeCount: loadMap.get(staff.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.activeCount !== b.activeCount) {
        return a.activeCount - b.activeCount;
      }
      // Tiebreaker: user who has been online longest without activity
      const aTime = a.lastSeenAt?.getTime() ?? 0;
      const bTime = b.lastSeenAt?.getTime() ?? 0;
      return aTime - bTime;
    });

  const chosen = sorted[0];
  console.log(
    `[assignment] Auto-assigned to ${chosen.firstName ?? ""} ${chosen.lastName ?? ""} (${chosen.id}) ` +
      `— active conversations: ${chosen.activeCount}`
  );

  return { id: chosen.id, firstName: chosen.firstName, lastName: chosen.lastName };
}

/**
 * Escalate a conversation to HUMAN mode.
 *
 * 1. Sets mode = HUMAN, records the escalation reason
 * 2. Finds the least-loaded online staff member and assigns them
 * 3. Emits "conversation.escalated" via safeEmitConversationUpdate
 *
 * @param io — optional Socket.IO server (used for direct emit if needed, falls back to module-level socket helpers)
 */
export async function escalateToHuman(
  conversationId: string,
  callerId: string,
  reason: string,
  io?: SocketIOServer
): Promise<void> {
  // 1. Fetch conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, companyId: true, mode: true, claimedById: true },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // 2. If already in HUMAN mode AND already claimed by this same caller,
  // nothing to do — otherwise proceed to (re-)escalate, since mode is the
  // source of truth, not claimedById alone (a conversation can have a
  // stale claimedById left over from a prior claim while mode is BOT).
  if (conversation.mode === ConversationMode.HUMAN && conversation.claimedById === callerId) {
    console.log(`[assignment] ${conversationId} already HUMAN and claimed by ${callerId}, skipping`);
    return;
  }

  // 3. Fetch calling user's name
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { firstName: true, lastName: true },
  });
  const fullName = caller
    ? [caller.firstName, caller.lastName].filter(Boolean).join(" ")
    : null;

  // 4. Self-assign to the calling staff member unconditionally
  const updateData: Prisma.ConversationUncheckedUpdateInput = {
    mode: ConversationMode.HUMAN,
    status: ConversationStatus.ASSIGNED,
    needsStaffReason: reason,
    claimedById: callerId,
    claimedByName: fullName,
    claimedAt: new Date(),
    claimExpiresAt: null,
    updatedAt: new Date(),
  };

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: updateData,
    select: {
      id: true,
      companyId: true,
      claimedById: true,
      claimedByName: true,
      leadId: true,
    },
  });

  // 5. Emit socket event
  const eventPayload = {
    conversationId: updated.id,
    reason,
    claimedById: updated.claimedById,
    claimedByName: updated.claimedByName,
    companyId: updated.companyId,
  };

  safeEmitConversationUpdate(updated, "conversation.escalated", eventPayload);

  // 6. Trigger notification
  const lead = updated.leadId
    ? await prisma.lead.findUnique({ where: { id: updated.leadId }, select: { name: true, contact: true } })
    : null;
  businessNotificationService.notifyCustomerInquiry({
    companyId: updated.companyId,
    leadNameOrContact: lead?.name || lead?.contact || "Customer",
    messageText: reason || "Handed off to human agent",
    assignedToId: updated.claimedById,
  }).catch((err) => console.error("❌ Failed to send escalation notification:", err));

  console.log(
    `[assignment] ${conversationId} self-assigned to ${fullName ?? "unassigned"} (reason: ${reason})`
  );
}

/**
 * Resolve a conversation — return to BOT mode and clear all assignment fields.
 *
 * 1. Sets mode = BOT, status = RESOLVED
 * 2. Clears claimedById, claimedByName, claimedAt, claimExpiresAt, lastClaimHeartbeat, needsStaffReason
 * 3. Emits "conversation.resolved" via safeEmitConversationUpdate
 *
 * @param io — optional Socket.IO server (same pattern as escalateToHuman)
 */
export async function resolveConversation(
  conversationId: string,
  resolvedBy: string,
  io?: SocketIOServer
): Promise<void> {
  // 1. Fetch conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, companyId: true, mode: true },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // 2. Update: clear all assignment fields, return to BOT
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      mode: ConversationMode.BOT,
      status: ConversationStatus.RESOLVED,
      lifecycleStatus: "archived",
      claimedById: null,
      claimedByName: null,
      claimedAt: null,
      claimExpiresAt: null,
      lastClaimHeartbeat: null,
      needsStaffReason: null,
      slaNotifiedAt: null,
      resolvedBy,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      companyId: true,
      claimedById: true,
    },
  });

  // 3. Emit socket event
  safeEmitConversationUpdate(updated, "conversation.resolved", {
    conversationId: updated.id,
    companyId: updated.companyId,
    resolvedBy,
  });

  console.log(`[assignment] resolved ${conversationId} → back to BOT (resolvedBy: ${resolvedBy})`);
}
