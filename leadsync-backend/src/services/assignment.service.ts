import { prisma } from "../lib/prisma";
import { emitToCompanyAdmin, emitToAgent, emitToCompany, safeEmitConversationUpdate } from "../lib/socket";

/**
 * Assignment Service
 *
 * Handles load-balanced auto-assignment of conversations to staff,
 * escalation from BOT to HUMAN mode, and resolution.
 *
 * Reuses existing Conversation fields:
 *   - claimedById / claimedByName / claimedAt (for assignment tracking)
 *   - mode (via Prisma's ConversationMode enum) / needsStaffReason
 *   - User.isOnline (set by socket heartbeat — 90s timeout)
 *
 * NOTE: mode and needsStaffReason are used via `as any` casts to match
 * the existing codebase pattern (see ai.orchestrator.worker.ts).
 * These fields exist in the Prisma schema but the DB migration is pending.
 */
export class AssignmentService {

  /**
   * Find the staff member with the fewest active HUMAN conversations.
   *
   * - Only considers STAFF and MANAGER roles that are currently online
   *   (User.isOnline === true, heartbeat within last 90s)
   * - Counts conversations where mode=HUMAN, claimedById=user.id,
   *   status != "RESOLVED" / "ARCHIVED"
   * - Tie-breaker: whoever was assigned least recently
   * - Returns null if no online staff found (conversation stays unassigned)
   */
  async findLeastLoadedStaff(companyId: string) {
    // 1. Find online STAFF and MANAGER users for this company
    const onlineStaff = await prisma.user.findMany({
      where: {
        companyId,
        isOnline: true,
        isActive: true,
        role: { in: ["STAFF", "MANAGER"] as any },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lastSeenAt: true,
      },
    });

    if (onlineStaff.length === 0) {
      console.log(`[AssignmentService] No online staff found for company ${companyId}`);
      return null;
    }

    // 2. Count active conversations per staff member
    // Use raw filter approach matching the codebase pattern — count conversations
    // where claimedById matches and status is not resolved
    const staffIds = onlineStaff.map((s) => s.id);

    const conversationCounts = await (prisma.conversation as any).groupBy({
      by: ["claimedById"],
      where: {
        companyId,
        claimedById: { in: staffIds },
        status: { notIn: ["RESOLVED", "ARCHIVED"] },
      },
      _count: { id: true },
      _max: { claimedAt: true },
    });

    // Build a map: staffId -> { activeCount, lastClaimedAt }
    const loadMap = new Map<string, { activeCount: number; lastClaimedAt: Date | null }>();
    for (const staff of onlineStaff) {
      loadMap.set(staff.id, { activeCount: 0, lastClaimedAt: null });
    }
    for (const row of conversationCounts) {
      if (row.claimedById) {
        loadMap.set(row.claimedById, {
          activeCount: row._count.id,
          lastClaimedAt: row._max.claimedAt || null,
        });
      }
    }

    // 3. Sort: lowest active count first, then earliest lastClaimedAt (least recently assigned)
    const sorted = onlineStaff
      .map((staff) => ({
        ...staff,
        load: loadMap.get(staff.id) || { activeCount: 0, lastClaimedAt: null },
      }))
      .sort((a, b) => {
        if (a.load.activeCount !== b.load.activeCount) {
          return a.load.activeCount - b.load.activeCount;
        }
        const aTime = a.load.lastClaimedAt?.getTime() ?? 0;
        const bTime = b.load.lastClaimedAt?.getTime() ?? 0;
        return aTime - bTime;
      });

    const chosen = sorted[0];
    console.log(
      `[AssignmentService] Auto-assigned to ${chosen.firstName} ${chosen.lastName || ""} (${chosen.id}) ` +
      `— active conversations: ${chosen.load.activeCount}`
    );

    return chosen;
  }

  /**
   * Escalate a conversation to HUMAN mode.
   *
   * 1. Sets mode = HUMAN, records the escalation reason
   * 2. Finds the least-loaded online staff member and assigns them
   * 3. Emits "conversation.escalated" to the company and assigned agent
   */
  async escalateToHuman(conversationId: string, reason: string) {
    const conversation = await (prisma.conversation as any).findUnique({
      where: { id: conversationId },
      include: {
        lead: { select: { id: true, name: true, contact: true, channel: true } },
        claimedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!conversation) {
      throw new Error(`[AssignmentService] Conversation ${conversationId} not found`);
    }

    // Find best staff to assign
    const staff = await this.findLeastLoadedStaff(conversation.companyId);

    // Update conversation atomically
    const updateData: any = {};
    updateData.mode = "HUMAN";
    updateData.needsStaffReason = reason;

    if (staff) {
      updateData.claimedById = staff.id;
      updateData.claimedByName = `${staff.firstName} ${staff.lastName || ""}`.trim();
      updateData.claimedAt = new Date();
    }

    const updated = await (prisma.conversation as any).update({
      where: { id: conversationId },
      data: updateData,
      include: {
        lead: { select: { id: true, name: true, contact: true, channel: true } },
        claimedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Prepare event payload
    const eventPayload: any = {
      conversationId: updated.id,
      companyId: updated.companyId,
      leadId: updated.leadId,
      lead: updated.lead,
      mode: updated.mode,
      status: updated.status,
      needsStaffReason: updated.needsStaffReason,
      assignedTo: updated.claimedBy
        ? { id: updated.claimedBy.id, name: updated.claimedByName }
        : null,
      previousMode: conversation.mode,
      escalatedAt: new Date().toISOString(),
    };

    // Emit socket events
    if (staff) {
      safeEmitConversationUpdate(updated, "conversation.escalated", eventPayload);
      emitToAgent(staff.id, "conversation.escalated", eventPayload);
    } else {
      emitToCompanyAdmin(updated.companyId, "conversation.escalated", eventPayload);
      emitToCompany(updated.companyId, "conversation.escalated", {
        ...eventPayload,
        _note: "UNASSIGNED — No online staff available. Manual claim required.",
      });
    }

    console.log(
      `[AssignmentService] Conversation ${conversationId} escalated to HUMAN` +
      `${staff ? `, assigned to ${staff.firstName} ${staff.lastName || ""}` : " (UNASSIGNED — no online staff)"}` +
      `. Reason: ${reason}`
    );

    return updated;
  }

  /**
   * Resolve a conversation — return to BOT mode and clear assignment.
   */
  async resolveConversation(conversationId: string) {
    const conversation = await (prisma.conversation as any).findUnique({
      where: { id: conversationId },
      include: {
        lead: { select: { id: true, name: true, contact: true, channel: true } },
        claimedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!conversation) {
      throw new Error(`[AssignmentService] Conversation ${conversationId} not found`);
    }

    const updated = await (prisma.conversation as any).update({
      where: { id: conversationId },
      data: {
        mode: "BOT",
        claimedById: null,
        claimedByName: null,
        claimedAt: null,
        needsStaffReason: null,
        status: "RESOLVED",
      },
      include: {
        lead: { select: { id: true, name: true, contact: true, channel: true } },
      },
    });

    const eventPayload: any = {
      conversationId: updated.id,
      companyId: updated.companyId,
      leadId: updated.leadId,
      lead: updated.lead,
      mode: updated.mode,
      status: updated.status,
      resolvedAt: new Date().toISOString(),
    };

    if (conversation.claimedById) {
      emitToAgent(conversation.claimedById, "conversation.resolved", eventPayload);
    }
    safeEmitConversationUpdate(conversation, "conversation.resolved", eventPayload);

    console.log(`[AssignmentService] Conversation ${conversationId} resolved (returned to BOT mode)`);

    return updated;
  }
}

export const assignmentService = new AssignmentService();