/**
 * Lead Follow-Up Cron
 * 
 * Scheduled job (runs every 30 minutes) that:
 * 1. Scans all companies for leads needing follow-up
 * 2. Triggers "lead.followup" for leads inactive for 24h
 * 3. Triggers "lead.cold_recovery" for leads inactive for 72h
 * 4. Respects idempotency — won't re-trigger if already sent recently
 */

import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { triggerLeadFollowUp } from "./autoReplyEventListeners";

// Time windows for each event type
const FOLLOWUP_INACTIVE_HOURS = 24;  // 1 day
const COLD_RECOVERY_INACTIVE_HOURS = 72; // 3 days

// Minimum gap between re-sending the same event to the same lead
const IDEMPOTENCY_WINDOW_HOURS = 48;

export async function executeLeadFollowUpCron(): Promise<{
  companiesProcessed: number;
  followUpsTriggered: number;
  coldRecoveriesTriggered: number;
}> {
  console.log(`⏰ [LeadFollowUpCron] Starting scan at ${new Date().toISOString()}`);

  // 1. Get all companies
  const companies = await prisma.company.findMany({
    select: { id: true },
  });

  let followUpsTriggered = 0;
  let coldRecoveriesTriggered = 0;

  for (const company of companies) {
    const tenantPrisma = getTenantPrismaContext(company.id);

    try {
      // 2. Find leads with stale conversations
      //    Conversations that haven't been updated recently and have no recent auto-reply
      const staleLeads = await tenantPrisma.lead.findMany({
        where: {
          companyId: company.id,
          conversations: {
            some: {
              status: "OPEN",
            },
          },
        },
        select: {
          id: true,
          lastActiveAt: true,
        },
      });

      for (const lead of staleLeads) {
        const hoursSinceLastActive = lead.lastActiveAt
          ? (Date.now() - new Date(lead.lastActiveAt).getTime()) / (1000 * 60 * 60)
          : Infinity;

        // 🛑 Check idempotency: ensure we haven't sent the same event type recently
        const recentFollowup = await tenantPrisma.autoReplyLog.findFirst({
          where: {
            companyId: company.id,
            triggeredFor: lead.id,
            eventKey: { in: ["lead.followup", "lead.cold_recovery"] },
            status: "SENT",
            sentAt: {
              gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_HOURS * 60 * 60 * 1000),
            },
          },
          orderBy: { sentAt: "desc" },
        });

        // Cold recovery (72h+)
        if (hoursSinceLastActive >= COLD_RECOVERY_INACTIVE_HOURS) {
          if (!recentFollowup || recentFollowup.eventKey !== "lead.cold_recovery") {
            await triggerLeadFollowUp(lead.id, company.id, "lead.cold_recovery");
            coldRecoveriesTriggered++;
          }
        }
        // Follow-up (24h+ but before cold recovery threshold)
        else if (hoursSinceLastActive >= FOLLOWUP_INACTIVE_HOURS) {
          if (!recentFollowup || recentFollowup.eventKey !== "lead.followup") {
            await triggerLeadFollowUp(lead.id, company.id, "lead.followup");
            followUpsTriggered++;
          }
        }
      }
    } catch (err: any) {
      console.error(`[LeadFollowUpCron] Error processing company ${company.id}: ${err.message}`);
    }
  }

  console.log(
    `⏰ [LeadFollowUpCron] Scan complete. ` +
    `Companies: ${companies.length}, ` +
    `Follow-ups: ${followUpsTriggered}, ` +
    `Cold recoveries: ${coldRecoveriesTriggered}`
  );

  return {
    companiesProcessed: companies.length,
    followUpsTriggered,
    coldRecoveriesTriggered,
  };
}