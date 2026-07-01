import { prisma } from "../../lib/prisma";
import { ConversationStatus, ConversationMode } from "@prisma/client";
import { MessageSender } from "@prisma/client";
import { getIO, emitToAgent } from "../../lib/socket";

/* ──────────────────────────────────────────────────────────────
   AUTOMATION SERVICE
   Evaluates active AutomationRules every 15 minutes
   ────────────────────────────────────────────────────────────── */

const DELAY_MS = 15 * 60 * 1000; // 15 minutes

async function logResult(ruleId: string, companyId: string, triggeredFor: string, action: string, result: string, note?: string) {
  try {
    await (prisma.automationLog as any).create({
      data: { ruleId, companyId, triggeredFor, action, result, note },
    });
  } catch (e) {
    console.error("[Automation] Failed to write log:", e);
  }
}

export async function evaluateRules() {
  try {
    const rules = await (prisma.automationRule as any).findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      try {
        await executeRule(rule);
      } catch (e: any) {
        console.error(`[Automation] Rule ${rule.id} error:`, e.message);
      }
    }
  } catch (e) {
    console.error("[Automation] evaluateRules error:", e);
  }
}

async function sendBotMessage(conversationId: string, companyId: string, message: string, ruleId: string) {
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
  if (!conv) return false;

  // Save the message
  const msg = await prisma.message.create({
    data: { conversationId, content: message, sender: MessageSender.AGENT },
  });

  // Update lead's lastActiveAt to NOW — prevents the automation from re-triggering on same lead next cycle
  if (conv.leadId) {
    await (prisma.lead as any).update({
      where: { id: conv.leadId },
      data: { lastActiveAt: new Date() },
    }).catch((e: any) => console.error("[Automation] Could not update lead.lastActiveAt:", e));
  }

  // Emit via socket
  const io = getIO();
  if (io) {
    io.to(conversationId).emit("new_message", { ...msg, conversationId });
    io.to(`company:${companyId}`).emit("conversation_updated", {
      conversationId,
      lastMessage: message,
      updatedAt: new Date().toISOString(),
    });
  }
  return true;
}

async function executeRule(rule: any) {
  const { id: ruleId, companyId, trigger, triggerDelayMinutes, action, actionPayload } = rule;
  const thresholdMs = (triggerDelayMinutes || 1440) * 60 * 1000;
  const thresholdDate = new Date(Date.now() - thresholdMs);

  switch (trigger) {
    case "LEAD_COLD": {
      // Leads with no message longer than threshold
      const coldLeads = await (prisma.lead as any).findMany({
        where: {
          companyId,
          lastActiveAt: { lt: thresholdDate },
          segment: { not: "CHURN_RISK" },
        },
        include: {
          conversations: {
            where: { mode: ConversationMode.BOT },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        take: 20,
      });

      let count = 0;
      for (const lead of coldLeads) {
        const conv = lead.conversations[0];
        if (!conv) continue;
        if (action === "SEND_MESSAGE" && actionPayload?.message) {
          const ok = await sendBotMessage(conv.id, companyId, actionPayload.message, ruleId);
          if (ok) {
            count++;
            await logResult(ruleId, companyId, lead.id, action, "SUCCESS", `Sent to ${lead.contact}`);
          }
        }
        if (action === "CHANGE_SEGMENT" && actionPayload?.segment) {
          await (prisma.lead as any).update({
            where: { id: lead.id },
            data: { segment: actionPayload.segment },
          });
          count++;
          await logResult(ruleId, companyId, lead.id, action, "SUCCESS", `Moved to ${actionPayload.segment}`);
        }
      }
      console.log(`[Automation] LEAD_COLD rule "${rule.name}": affected ${count} leads`);
      break;
    }

    case "ORDER_PENDING": {
      // Orders stuck in NEW/BOT_CREATED_ORDER for longer than threshold
      const stuckOrders = await (prisma.order as any).findMany({
        where: {
          companyId,
          isDeleted: false,
          status: { in: ["NEW", "BOT_CREATED_ORDER", "PENDING"] },
          createdAt: { lt: thresholdDate },
        },
        take: 20,
      });

      // Send alert to all admins via socket
      const io = getIO();
      for (const order of stuckOrders) {
        if (io) {
          io.to(`company:${companyId}:admin`).emit("automation_alert", {
            type: "ORDER_PENDING",
            orderId: order.id,
            message: `Order #${order.id.slice(-6)} has been pending for over ${triggerDelayMinutes} minutes.`,
          });
        }
        await logResult(ruleId, companyId, order.id, action, "SUCCESS", `Alert sent for order ${order.id}`);
      }
      console.log(`[Automation] ORDER_PENDING rule "${rule.name}": alerted on ${stuckOrders.length} orders`);
      break;
    }

    case "NEW_LEAD": {
      // New leads created after rule.lastRunAt (or within delay window)
      const since = rule.lastRunAt || new Date(Date.now() - thresholdMs);
      const newLeads = await (prisma.lead as any).findMany({
        where: {
          companyId,
          createdAt: { gt: since },
          segment: "NEW",
        },
        include: {
          conversations: {
            where: { mode: ConversationMode.BOT },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        take: 50,
      });

      let count = 0;
      for (const lead of newLeads) {
        const conv = lead.conversations[0];
        if (!conv) continue;
        if (action === "SEND_MESSAGE" && actionPayload?.message) {
          const ok = await sendBotMessage(conv.id, companyId, actionPayload.message, ruleId);
          if (ok) {
            count++;
            await logResult(ruleId, companyId, lead.id, action, "SUCCESS");
          }
        }
      }
      console.log(`[Automation] NEW_LEAD rule "${rule.name}": sent to ${count} new leads`);
      break;
    }

    default:
      break;
  }

  // Update runCount and lastRunAt
  await (prisma.automationRule as any).update({
    where: { id: ruleId },
    data: { runCount: { increment: 1 }, lastRunAt: new Date() },
  });
}

let intervalHandle: NodeJS.Timeout | null = null;

export function startAutomationRunner() {
  console.log("⚙️ [Automation] Runner now executes safely on demand via PgBoss scheduled jobs (automation_runner)");
}

export function stopAutomationRunner() {
  // No-op as startAutomationRunner is no-op
}

export async function executeDelayedAutomation(payload: { ruleId: string } | any) {
  console.log("[Automation] Running delayed automation with payload:", payload);
  if (payload?.ruleId) {
    const rule = await (prisma.automationRule as any).findUnique({
      where: { id: payload.ruleId }
    });
    if (rule) {
      await executeRule(rule);
    }
  }
}
