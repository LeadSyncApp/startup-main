import { getTenantPrismaContext } from "../../lib/prisma";
import { sendTelegramMessage } from "../../bot/telegram.sender";
import { emitToConversation, emitToCompany, safeEmitConversationUpdate } from "../../lib/socket";
import { decryptSecret } from "../../utils/encryption";
import axios from "axios";
import { Channel, MessageSender } from "@prisma/client";
import { aiPersonalityService } from "../ai/aiPersonality.service";
import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { DELAYED_AUTO_REPLY_JOB_NAME } from "../infrastructure/pgboss/jobs/delayedAutoReply.job";
import { outboundDispatcherService } from "../outbound.dispatcher";

// 🛑 Simple Unicode-range language detection for Indic scripts
export function detectLanguageFromText(text: string): "en" | "hi" | "ta" | "te" | "bn" {
  const clean = text.trim();
  if (!clean) return "en";
  
  // Tamil: U+0B80–U+0BFF
  if (/[\u0B80-\u0BFF]/.test(clean)) return "ta";
  // Telugu: U+0C00–U+0C7F
  if (/[\u0C00-\u0C7F]/.test(clean)) return "te";
  // Bengali: U+0980–U+09FF
  if (/[\u0980-\u09FF]/.test(clean)) return "bn";
  // Hindi/Devanagari: U+0900–U+097F
  if (/[\u0900-\u097F]/.test(clean)) return "hi";
  
  return "en";
}

export type AutoReplyEventKey =
  | "order.placed"
  | "order.confirmed"
  | "order.preparing"
  | "order.ready"
  | "order.delivered"
  | "lead.welcome"
  | "lead.followup"
  | "lead.cold_recovery";

export interface AutoReplyContext {
  companyId: string;
  conversationId: string;
  leadId: string;
  contact: string;
  channel: Channel;
  customerName?: string;
  customerMessage?: string;  // 🆕 The inbound message that triggered this auto-reply (for smart rules context)
  orderId?: string;
  brandName?: string;
  customerHistory?: {
    orderCount: number;
    totalSpend: number;
    segment: string;
  };
}

export const AUTO_REPLY_EVENTS: Record<AutoReplyEventKey, {
  label: string;
  description: string;
  icon: string;
  defaultMessage: string;
  defaultDelayMinutes: number;
  category: "order" | "lead";
}> = {
  "order.placed": {
    label: "🛒 New Order Placed",
    description: "Sent when a customer places a new order",
    icon: "🛒",
    defaultMessage: "Hi {name}! Your order #{orderId} has been placed. We'll confirm it shortly! 🎉",
    defaultDelayMinutes: 0,
    category: "order",
  },
  "order.confirmed": {
    label: "✅ Order Confirmed",
    description: "Sent when you confirm the customer's order",
    icon: "✅",
    defaultMessage: "Great news {name}! Your order #{orderId} is confirmed and we're getting it ready! 🙌",
    defaultDelayMinutes: 0,
    category: "order",
  },
  "order.preparing": {
    label: "👨‍🍳 Preparing Order",
    description: "Sent when you start preparing the order",
    icon: "👨‍🍳",
    defaultMessage: "{name}, we're now preparing your order #{orderId}. It'll be ready soon! 🔥",
    defaultDelayMinutes: 0,
    category: "order",
  },
  "order.ready": {
    label: "📦 Order Ready",
    description: "Sent when the order is ready for pickup/delivery",
    icon: "📦",
    defaultMessage: "{name}! Your order #{orderId} is ready! 🎉 Come pick it up or expect delivery shortly!",
    defaultDelayMinutes: 0,
    category: "order",
  },
  "order.delivered": {
    label: "🎉 Order Delivered",
    description: "Sent after successful delivery",
    icon: "🎉",
    defaultMessage: "Thank you {name}! 🙏 Your order #{orderId} has been delivered. We'd love to serve you again! ❤️",
    defaultDelayMinutes: 0,
    category: "order",
  },
  "lead.welcome": {
    label: "👋 Welcome Message",
    description: "Sent when a new customer messages you for the first time",
    icon: "👋",
    defaultMessage: "Hey {name}! 👋 Welcome to {brand}! How can we help you today? 😊",
    defaultDelayMinutes: 0,
    category: "lead",
  },
  "lead.followup": {
    label: "⏰ Follow-Up",
    description: "Sent if the customer hasn't replied in a while",
    icon: "⏰",
    defaultMessage: "Hi {name}! Just checking in — still interested? 😊 Let us know if you need anything!",
    defaultDelayMinutes: 1440,
    category: "lead",
  },
  "lead.cold_recovery": {
    label: "🧊 Cold Lead Recovery",
    description: "Sent to re-engage customers who went cold",
    icon: "🧊",
    defaultMessage: "Hey {name}! 👋 It's been a while. We have some amazing new stuff! Come check us out! 🚀",
    defaultDelayMinutes: 4320,
    category: "lead",
  },
};

export class AutoReplyService {
  async seedDefaults(companyId: string, brandName: string = "our store") {
    const tenantPrisma = getTenantPrismaContext(companyId);
    const events = Object.entries(AUTO_REPLY_EVENTS);
    for (const [eventKey, config] of events) {
      const isEnabled = config.category === "order" || eventKey === "lead.welcome";
      await tenantPrisma.autoReplyRule.upsert({
        where: { companyId_eventKey: { companyId, eventKey } },
        create: {
          companyId,
          eventKey: eventKey as AutoReplyEventKey,
          isEnabled,
          messageBody: config.defaultMessage,
          delayMinutes: config.defaultDelayMinutes,
        },
        update: {},
      });
    }
    console.log(`[AutoReply] Seeded ${events.length} auto-reply rules for company ${companyId}`);
  }


  async getRules(companyId: string) {
    const tenantPrisma = getTenantPrismaContext(companyId);
    return tenantPrisma.autoReplyRule.findMany({
      where: { companyId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  async updateRule(ruleId: string, companyId: string, data: {
    isEnabled?: boolean;
    messageBody?: string;
    delayMinutes?: number;
    useAI?: boolean;
    brandVoice?: string;
    targetLanguage?: string;
  }) {
    const tenantPrisma = getTenantPrismaContext(companyId);
    return tenantPrisma.autoReplyRule.update({
      where: { id: ruleId, companyId },
      data: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.messageBody !== undefined && { messageBody: data.messageBody }),
        ...(data.delayMinutes !== undefined && { delayMinutes: data.delayMinutes }),
        ...(data.useAI !== undefined && { useAI: data.useAI }),
        ...(data.brandVoice !== undefined && { brandVoice: data.brandVoice }),
        ...(data.targetLanguage !== undefined && { targetLanguage: data.targetLanguage }),
      },
    });
  }

  async processEvent(eventKey: AutoReplyEventKey, context: AutoReplyContext) {
    const tenantPrisma = getTenantPrismaContext(context.companyId);

    // 🛑 FIXED (Option A — advisory lock): Replace racy check-then-write
    // with an atomic check-then-reserve pattern.
    // Phase 1 — inside a short transaction: acquire lock, check, and
    // write a PENDING log row to block concurrent duplicates.
    // Phase 2 — outside the transaction: do the actual send, then
    // update the row to SENT or leave as FAILED.
    const lockKey1 = hashStringToInt4(context.companyId);
    const lockKey2 = hashStringToInt4(`${eventKey}|${context.leadId}`);

    // Phase 1: atomic check + reserve (fast — no external I/O)
    let reserved: { id: string; rule: any } | null = null;
    try {
      reserved = await tenantPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock($1::int4, $2::int4)",
          lockKey1, lockKey2
        );

        const recentLog = await tx.autoReplyLog.findFirst({
          where: {
            companyId: context.companyId,
            eventKey,
            triggeredFor: context.leadId,
            sentAt: {
              gte: new Date(Date.now() - 2 * 60 * 1000),
            },
          },
        });
        if (recentLog) {
          console.log(`[AutoReply] Skipping ${eventKey} for ${context.leadId} — already sent recently`);
          return null; // signal: skip
        }

        const rule = await tx.autoReplyRule.findUnique({
          where: {
            companyId_eventKey: { companyId: context.companyId, eventKey },
          },
        });
        if (!rule || !rule.isEnabled) return null;

        // Reschedule case: write to delayed queue, no row needed in AutoReplyLog yet
        let effectiveDelay = rule.delayMinutes || 0;
        if (effectiveDelay > 0 && context.customerHistory?.segment) {
          const segmentOverrides: Record<string, number> = {
            "VIP": 60,
            "REGULAR": rule.delayMinutes,
            "NEW": 1440,
            "CHURN_RISK": 0,
          };
          const override = segmentOverrides[context.customerHistory.segment];
          if (override !== undefined) effectiveDelay = override;
        }
        if (effectiveDelay > 0) {
          const boss = pgBossService.getBoss();
          await boss.send(DELAYED_AUTO_REPLY_JOB_NAME, {
            ruleId: rule.id,
            eventKey,
            companyId: context.companyId,
            conversationId: context.conversationId,
            leadId: context.leadId,
            contact: context.contact,
            channel: context.channel,
            customerName: context.customerName,
            brandName: context.brandName || undefined,
            messageBody: rule.messageBody,
            useAI: rule.useAI || false,
            orderId: context.orderId,
            customerHistory: context.customerHistory,
          }, { startAfter: effectiveDelay * 60 });
          console.log(`[AutoReply] Scheduled ${eventKey} via pg-boss in ${effectiveDelay} minutes`);
          return null; // scheduled, no immediate send
        }

        // Reserve a row — write PENDING so concurrent callers see it
        const pending = await tx.autoReplyLog.create({
          data: {
            companyId: context.companyId,
            ruleId: rule.id,
            eventKey,
            triggeredFor: context.leadId,
            recipient: context.contact,
            channel: context.channel,
            messageBody: "", // will fill after render
            status: "PENDING",
          },
        });

        return { id: pending.id, rule };
      });
    } catch (error: any) {
      console.error(`[AutoReply] Failed to process ${eventKey}:`, error.message);
      // Best-effort FAILED log outside the tx (fallback)
      await tenantPrisma.autoReplyLog.create({
        data: {
          companyId: context.companyId,
          eventKey,
          triggeredFor: context.leadId,
          recipient: context.contact,
          channel: context.channel,
          messageBody: (context as any).renderedMessageBody || "",
          status: "FAILED",
          error: error.message,
        },
      }).catch(() => {});
      return;
    }

    if (!reserved) return; // skipped or scheduled

    // Phase 2: actual send (outside the lock/transaction)
    try {
      await this.executeDelayedAutoReply(reserved.rule, context, eventKey, reserved.id);
    } catch (error: any) {
      console.error(`[AutoReply] Send failed for ${eventKey}:`, error.message);
      // Update the PENDING row to FAILED
      await tenantPrisma.autoReplyLog.update({
        where: { id: reserved.id },
        data: {
          status: "FAILED",
          error: error.message,
          messageBody: (context as any).renderedMessageBody || "",
        },
      }).catch(() => {});
    }
  }

  public async executeDelayedAutoReply(
    rule: any,
    context: AutoReplyContext,
    eventKey: AutoReplyEventKey,
    reservedLogId?: string,
  ) {
    const tenantPrisma = getTenantPrismaContext(context.companyId);

    // 🛑 FIX: Re-check if rule is still enabled — user may have disabled it while the job was pending
    const currentRule = await tenantPrisma.autoReplyRule.findUnique({
      where: { id: rule.id, companyId: context.companyId },
    });
    if (!currentRule || !currentRule.isEnabled) {
      console.log(`[AutoReply] Skipping ${eventKey} for ${context.contact} — rule is now disabled`);
      if (reservedLogId) {
        await tenantPrisma.autoReplyLog.update({
          where: { id: reservedLogId },
          data: { status: "FAILED", error: "Rule disabled" },
        }).catch(() => {});
      }
      return;
    }

    let message = rule.messageBody;
    if (rule.useAI) {
      const aiResult = await aiPersonalityService.generateMessage(
        {
          eventKey,
          customerName: context.customerName,
          orderId: context.orderId,
          brandName: context.brandName || "our store",
          channel: context.channel,
          originalTemplate: rule.messageBody,
          customerHistory: context.customerHistory,
        },
        context.companyId
      );
      message = aiResult.message;
    } else {
      message = this.fillTemplate(rule.messageBody, context);
    }

    // Keep final rendered text available in case any caller catches an error
    ;(context as any).renderedMessageBody = message;

    // If this was a delayed job (no reservedLogId), acquire lock first
    if (!reservedLogId) {
      const lockKey1 = hashStringToInt4(context.companyId);
      const lockKey2 = hashStringToInt4(`${eventKey}|${context.leadId}`);
      const recentLog = await tenantPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock($1::int4, $2::int4)",
          lockKey1, lockKey2
        );
        return tx.autoReplyLog.findFirst({
          where: {
            companyId: context.companyId,
            eventKey,
            triggeredFor: context.leadId,
            sentAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
          },
        });
      });
      if (recentLog) {
        console.log(`[AutoReply] Skipping delayed ${eventKey} for ${context.leadId} — already logged recently`);
        return;
      }
    }

    const dispatchResult = await this.sendViaChannel(context, message);

    // Use the message row already created by outboundDispatcher.dispatch()
    const savedMsg = dispatchResult?.message || await tenantPrisma.message.create({
      data: {
        content: message,
        sender: MessageSender.SYSTEM,
        conversationId: context.conversationId,
        companyId: context.companyId,
      },
    });

    emitToConversation(context.conversationId, "new_message", savedMsg);

    const conversation = await tenantPrisma.conversation.findUnique({
      where: { id: context.conversationId },
      select: { companyId: true, claimedById: true },
    });

    if (conversation) {
      safeEmitConversationUpdate(
        conversation,
        "conversation_updated",
        { conversationId: context.conversationId }
      );
    }

    if (!reservedLogId) {
      await tenantPrisma.autoReplyLog.create({
        data: {
          companyId: context.companyId,
          ruleId: rule.id,
          eventKey,
          triggeredFor: context.leadId,
          recipient: context.contact,
          channel: context.channel,
          messageBody: message,
          status: "SENT",
        },
      });
    } else {
      await tenantPrisma.autoReplyLog.update({
        where: { id: reservedLogId },
        data: {
          messageBody: message,
          status: "SENT",
          error: null,
        },
      });
    }

    console.log(`[AutoReply] ${eventKey} → Sent to ${context.contact} on ${context.channel}`);
  }

  private fillTemplate(template: string, context: AutoReplyContext): string {
    return template
      .replace(/{name}/g, context.customerName || "Customer")
      .replace(/{orderId}/g, context.orderId || "")
      .replace(/{brand}/g, context.brandName || "our store");
  }

  private async sendViaChannel(context: AutoReplyContext, message: string): Promise<{ messageId: string; deliveryStatus: "SENT" | "FAILED"; message?: any } | null> {
    const channelType = context.channel === "TELEGRAM" ? "TELEGRAM" as const
                      : context.channel === "WHATSAPP" ? "WHATSAPP" as const
                      : context.channel === "INSTAGRAM" ? "INSTAGRAM" as const
                      : null;

    if (channelType) {
      try {
        const result = await outboundDispatcherService.dispatch({
          companyId: context.companyId,
          conversationId: context.conversationId,
          to: context.contact,
          channel: channelType,
          content: { text: message },
          sender: "SYSTEM"
        });
        return result;
      } catch (err) {
        console.error(`[AutoReply] outboundDispatcher failed for ${context.channel}:`, err);
        throw err;
      }
    }

    console.warn(`[AutoReply] Unsupported channel: ${context.channel} — no message sent`);
    return null;
  }
}

// ---------- Advisory-lock helpers ----------
function hashStringToInt4(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to unsigned 32-bit to keep it int4-safe
  return Math.abs(hash) >>> 0;
}

export const autoReplyService = new AutoReplyService();