import { prisma } from "../../lib/prisma";

/**
 * Ghost Conversation Reaper
 * ------------------------
 * Soft-deletes "ghost" conversations that pollute the inbox lists.
 *
 * Ghost predicate (strict, conservative):
 *   - Conversation.deletedAt IS NULL
 *   - AND (
 *       Conversation.leadId IS NULL
 *       OR Conversation.lead.name IS NULL
 *       OR Conversation.lead.name = ''
 *     )
 *   - AND zero messages (Conversation has no Message rows)
 *   - AND Conversation.updatedAt older than GHOST_STALE_HOURS hours
 *
 * Cleanup is event-driven:
 *   - reapGhostsForCompany(companyId) is called at delete-time when a
 *     lead is deleted, when an order is completed, and when a staff
 *     member deletes their own chat.
 *   - It is also called once at server boot (per-company) to clean up
 *     any pre-existing ghosts.
 */

const GHOST_STALE_HOURS = 24;

const cutoffDate = () =>
  new Date(Date.now() - GHOST_STALE_HOURS * 60 * 60 * 1000);

const baseGhostWhere = (companyId?: string) => ({
  deletedAt: null,
  updatedAt: { lt: cutoffDate() },
  ...(companyId ? { companyId } : {}),
  OR: [
    { leadId: null },
    { lead: { is: { OR: [{ name: null }, { name: "" }] } } },
  ],
  messages: { none: {} },
});

/**
 * Soft-delete all currently-matching ghosts across all tenants.
 * Returns the number of rows soft-deleted.
 *
 * Idempotent: rows already soft-deleted (deletedAt != null) are skipped
 * by the predicate, so re-running is safe.
 */
export async function reapGhostConversations(): Promise<number> {
  const ids = await prisma.conversation.findMany({
    where: baseGhostWhere(),
    select: { id: true },
  });

  if (ids.length === 0) return 0;

  const result = await prisma.conversation.updateMany({
    where: { id: { in: ids.map((c) => c.id) } },
    data: { deletedAt: new Date() },
  });

  if (result.count > 0) {
    console.log(
      `[ghost-reaper] Soft-deleted ${result.count} ghost conversation(s).`
    );
  }

  return result.count;
}

/**
 * Called from the webhook orchestrator when a fresh inbound message
 * arrives. We sweep the ghosts in the same tenant so a deleted ghost
 * cannot appear in the inbox in the same request that would otherwise
 * have resurfaced it.
 *
 * Also invoked at delete-time (lead deletion, order completion, staff
 * chat deletion) and once per company at server boot.
 */
export async function reapGhostsForCompany(companyId: string): Promise<number> {
  const ids = await prisma.conversation.findMany({
    where: baseGhostWhere(companyId),
    select: { id: true },
  });

  if (ids.length === 0) return 0;

  const result = await prisma.conversation.updateMany({
    where: { id: { in: ids.map((c) => c.id) } },
    data: { deletedAt: new Date() },
  });

  if (result.count > 0) {
    console.log(
      `[ghost-reaper] (tenant=${companyId}) Soft-deleted ${result.count} ghost conversation(s).`
    );
  }

  return result.count;
}

export const GHOST_REAPER_CONFIG = {
  staleHours: GHOST_STALE_HOURS,
};
