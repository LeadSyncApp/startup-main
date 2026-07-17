import { eventBus, Events } from "../infrastructure/eventBus";
import { autoReplyService, AutoReplyContext } from "./autoReply.service";
import { prisma } from "../../lib/prisma";

/**
 * Sets up event listeners that trigger auto-reply rules.
 * Call this once on app startup.
 */
export function setupAutoReplyEventListeners() {
  console.log("[AutoReply] Setting up event listeners...");

  // ── Order Status Changed ──
  eventBus.on(Events.ORDER_STATUS_CHANGED, async (orderId: string, companyId: string) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId, companyId },
        include: { lead: true },
      });
      if (!order || !order.lead) return;

      // Find conversation via lead (Order no longer has direct conversation relation)
      const conv = order.leadId ? await prisma.conversation.findFirst({
        where: { leadId: order.leadId, lifecycleStatus: 'active', companyId }
      }) : null;
      if (!conv) return;

      // Map OrderStatus to eventKey
      // NOTE: "NEW" is intentionally excluded — order.placed is handled by ORDER_CREATED event
      // to avoid duplicate messages when a new order is first created
      const statusToEvent: Record<string, string> = {
        "CONFIRMED": "order.confirmed",
        "PREPARING": "order.preparing",
        "READY": "order.ready",
        "DELIVERED": "order.delivered",
      };

      const eventKey = statusToEvent[order.status];
      if (!eventKey) return;

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true }
      });

      const context: AutoReplyContext = {
        companyId,
        conversationId: conv.id,
        leadId: order.leadId!,
        contact: order.lead.contact,
        channel: conv.channel,
        customerName: order.lead.name || undefined,
        orderId: order.id.slice(0, 8),
        brandName: company?.name || "our store",
      };

      await autoReplyService.processEvent(eventKey as any, context);
    } catch (error) {
      console.error("[AutoReply] Failed to process ORDER_STATUS_CHANGED event:", error);
    }
  });

  // ── Order Created ──
  eventBus.on(Events.ORDER_CREATED, async (orderId: string, companyId: string) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId, companyId },
        include: { lead: true },
      });
      if (!order || !order.lead) return;

      // Find conversation via lead (Order no longer has direct conversation relation)
      const conv = order.leadId ? await prisma.conversation.findFirst({
        where: { leadId: order.leadId, lifecycleStatus: 'active', companyId }
      }) : null;
      if (!conv) return;

      // Only send "order.placed" if status is NEW or BOT_CREATED_ORDER
      if (order.status !== "NEW" && order.status !== "BOT_CREATED_ORDER") return;

      const context: AutoReplyContext = {
        companyId,
        conversationId: conv.id,
        leadId: order.leadId!,
        contact: order.lead.contact,
        channel: conv.channel,
        customerName: order.lead.name || undefined,
        orderId: order.id.slice(0, 8),
      };

      await autoReplyService.processEvent("order.placed", context);
    } catch (error) {
      console.error("[AutoReply] Failed to process ORDER_CREATED event:", error);
    }
  });

  console.log("[AutoReply] Event listeners registered ✓");
}

/**
 * Manually trigger a lead.welcome auto-reply.
 * Call this when a new lead is created (from wherever leads are created).
 */
export async function triggerLeadWelcome(leadId: string, companyId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, companyId },
      include: {
        conversations: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!lead) return;

    const conversation = lead.conversations[0];
    if (!conversation) return;

    const context: AutoReplyContext = {
      companyId,
      conversationId: conversation.id,
      leadId: lead.id,
      contact: lead.contact,
      channel: lead.channel,
      customerName: lead.name || undefined,
    };

    await autoReplyService.processEvent("lead.welcome", context);
  } catch (error) {
    console.error("[AutoReply] Failed to trigger lead welcome:", error);
  }
}

/**
 * Manually trigger a lead.followup or lead.cold_recovery auto-reply.
 * Call this from the automation cron or a scheduled job.
 */
export async function triggerLeadFollowUp(leadId: string, companyId: string, eventKey: "lead.followup" | "lead.cold_recovery") {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, companyId },
      include: {
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!lead) return;

    const conversation = lead.conversations[0];
    if (!conversation) return;

    const context: AutoReplyContext = {
      companyId,
      conversationId: conversation.id,
      leadId: lead.id,
      contact: lead.contact,
      channel: lead.channel,
      customerName: lead.name || undefined,
    };

    await autoReplyService.processEvent(eventKey, context);
  } catch (error) {
    console.error("[AutoReply] Failed to trigger follow-up:", error);
  }
}