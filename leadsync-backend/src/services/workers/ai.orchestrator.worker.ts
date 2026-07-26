import PgBoss from "pg-boss";
import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { prisma, directPrisma, getTenantPrismaContext } from "../../lib/prisma";
import { ConcurrencyLock } from "../../utils/concurrencyLock";
import { outboundDispatcherService } from "../outbound.dispatcher";
import { TelegramTransportService } from "../transport/telegramTransport.service";
import { decryptSecret } from "../../utils/encryption";
import { Channel, MessageSender, ConversationStatus } from "@prisma/client";
import { generateShopReply, generateFastReply, classifyMessageIntentWithTimeout, PreFlightClassification, UnifiedShopResponse } from "../ai/ai.service";
import { retrieveSimilarChunks } from "../knowledge/knowledgeRetriever.service";
import { matchProductForMessage } from "../knowledge/productMatch.service";
import { StandardMessageFrame } from "../../interfaces/messaging.interface";
import { tenantContextStorage, TenantContext } from "../context/tenantContext.provider";
import { safeEmitConversationUpdate, emitToConversation, emitToVisitor, getIO } from "../../lib/socket";
import { conversationalAutoReplyService } from "../automation/conversationalAutoReply.service";
import { telegramSurfaceAdapter } from "../automation/telegramSurface.adapter";
import { detectLanguage } from "../ai/languageDetection.service";
import { ChannelType } from "../../interfaces/outbound.interface";
import { newOrderArrivalService } from "../workflow/newOrderArrival.service";
import { getActiveDraftOrder, syncDraftOrderFromAi, confirmActiveDraftOrder, syncLeadPendingOrderState } from "../draftOrder/draftOrder.service";
import crypto from "crypto";
import { stepProfiler } from "../../utils/stepProfiler";

// Thread-safe Profiling — log elapsed from entry at each major boundary per trace
function P(label: string): void {
  const currentTrace = stepProfiler.getTraceId();
  const traceTag = currentTrace ? `[${currentTrace.slice(-8)}]` : "[Profiler]";
  console.log(`[Profiler] ${traceTag} ${label}`);
}

export function evaluateTenantPriorityRules(aiOutput: any, rules: TenantContext["priorityRules"]): string {
  if (!rules || rules.length === 0) {
    return "STANDARD";
  }
  const total = aiOutput.extracted_order_total || 0;
  const itemsCount = aiOutput.extracted_items_count || 0;
  for (const rule of rules) {
    const targetValue = rule.field === "total" ? total : itemsCount;
    if (rule.condition === ">" && targetValue > rule.thresholdValue) {
      return rule.result;
    }
  }
  return "STANDARD";
}

const GENERIC_NAMES = new Set([
  "user", "customer", "store shopper", "shopify customer", 
  "woocommerce customer", "website customer", "telegram user", 
  "whatsapp user", "unknown", "lead", "test user", "test lead"
]);

function isGenericName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  return GENERIC_NAMES.has(name.trim().toLowerCase());
}

// In-memory lock map to prevent race conditions during first-touch lead/conversation creation
const firstTouchLeadLocks = new Map<string, Promise<any>>();

async function resolveOrCreateLeadAndConversation(
  companyId: string,
  contact: string,
  channel: Channel,
  contactName: string,
  existingLead: any,
  tenantPrisma: any,
  traceId: string
): Promise<{ lead: any; conversation: any }> {
  P("fast-path resolveOrCreate: entry");
  // Fast Path: Existing lead with an active conversation (99%+ of messages)
  if (existingLead) {
    P("fast-path resolveOrCreate: existingLead check entered");
    const activeConv = (existingLead.conversations || []).find(
      (c: any) => c.lifecycleStatus === "active" || !c.lifecycleStatus
    );
    P(`fast-path resolveOrCreate: existingLead conversations length=${existingLead.conversations?.length ?? 0}, activeConv found=${!!activeConv}`);
    if (activeConv) {
      if (!isGenericName(contactName) && (isGenericName(existingLead.name) || existingLead.name !== contactName)) {
        tenantPrisma.lead.update({
          where: { id: existingLead.id },
          data: { name: contactName }
        }).catch((err: any) => console.error("[Orchestrator] Fast-path lead name update failed:", err.message));
        existingLead.name = contactName;
      }
      P("fast-path resolveOrCreate: returning early with activeConv from existingLead");
      return { lead: existingLead, conversation: activeConv };
    }
  }

  P("fast-path resolveOrCreate: checking firstTouchLeadLocks");
  // First-touch or returning customer needing conversation thread creation
  const lockKey = `first-touch:${companyId}:${contact}:${channel}`;
  if (firstTouchLeadLocks.has(lockKey)) {
    P("fast-path resolveOrCreate: lock hit, awaiting existing promise");
    return await firstTouchLeadLocks.get(lockKey);
  }

  P("fast-path resolveOrCreate: creating resolvePromise");
  const resolvePromise = (async () => {
    try {
      P("fast-path resolveOrCreate: resolvePromise start - before prisma.lead.findUnique");
      // Re-check DB inside lock to guarantee no concurrent creation
      let lead = await prisma.lead.findUnique({
        where: { contact_channel_companyId: { contact, channel, companyId } },
        include: {
          conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 }
        }
      });
      P(`fast-path resolveOrCreate: after prisma.lead.findUnique (lead exists=${!!lead})`);

      P("fast-path resolveOrCreate: finding activeConv and hasArchivedHistory");
      const activeConv = (lead?.conversations || []).find(
        (c: any) => c.lifecycleStatus === "active" || !c.lifecycleStatus
      );
      const hasArchivedHistory = (lead?.conversations || []).some(
        (c: any) => c.lifecycleStatus === "archived"
      );
      P(`fast-path resolveOrCreate: activeConv=${!!activeConv}, hasArchivedHistory=${hasArchivedHistory}`);

      if (!lead) {
        P("fast-path resolveOrCreate: before tenantPrisma.lead.create");
        try {
          lead = await tenantPrisma.lead.create({
            data: { companyId, contact, channel, name: contactName || "User" }
          });
        } catch (createErr: any) {
          if (createErr.code === "P2002") {
            console.warn(`⚠️ [Orchestrator] P2002 race on lead create (${contact}:${channel}:${companyId}) — re-fetching`);
            lead = await prisma.lead.findUnique({
              where: { contact_channel_companyId: { contact, channel, companyId } },
              include: {
                conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 }
              }
            });
            if (!lead) throw createErr;
          } else {
            throw createErr;
          }
        }
        P("fast-path resolveOrCreate: after tenantPrisma.lead.create");
      } else if (!isGenericName(contactName) && (isGenericName(lead.name) || lead.name !== contactName)) {
        P("fast-path resolveOrCreate: before tenantPrisma.lead.update");
        lead = await tenantPrisma.lead.update({
          where: { id: lead.id },
          data: { name: contactName }
        });
        P("fast-path resolveOrCreate: after tenantPrisma.lead.update");
      } else {
        P("fast-path resolveOrCreate: lead exists and name matches");
      }

      let conversation = activeConv || null;
      if (!conversation) {
        // Re-check DB for an active conversation created by a concurrent process
        const freshActive = await tenantPrisma.conversation.findFirst({
          where: { leadId: lead!.id, companyId, deletedAt: null, lifecycleStatus: "active" },
          orderBy: { updatedAt: "desc" },
          include: { lead: true }
        });
        if (freshActive) {
          conversation = freshActive;
          P("fast-path resolveOrCreate: found active conversation created by concurrent process");
        } else {
          P("fast-path resolveOrCreate: before tenantPrisma.conversation.create");
          conversation = await tenantPrisma.conversation.create({
            data: {
              channel,
              companyId,
              status: ConversationStatus.OPEN,
              leadId: lead!.id,
              isReturningCustomer: hasArchivedHistory
            },
            include: { lead: true }
          });
          P("fast-path resolveOrCreate: after tenantPrisma.conversation.create");

          // Note: Triage job is enqueued by processWebhookJob after RAG context retrieval
          // with precomputed product match to prevent duplicate RAG execution.

          P("fast-path resolveOrCreate: before socket io emit");
          try {
            const io = getIO();
            if (io) {
              io.to(`company:${companyId}`).emit("conversation:new", {
                conversationId: conversation!.id,
                isReturningCustomer: hasArchivedHistory
              });
            }
          } catch (err) {}
          P("fast-path resolveOrCreate: after socket io emit");
        }
      }

      P("fast-path resolveOrCreate: resolvePromise end");
      return { lead, conversation };
    } finally {
      P("fast-path resolveOrCreate: finally cleaning up lock map key");
      firstTouchLeadLocks.delete(lockKey);
    }
  })();

  firstTouchLeadLocks.set(lockKey, resolvePromise);
  P("fast-path resolveOrCreate: awaiting resolvePromise");
  const res = await resolvePromise;
  P("fast-path resolveOrCreate: resolvePromise returned");
  return res;
}

export async function processWebhookJob(job: { id: string; data: StandardMessageFrame }) {
  const t_worker_pickup = Date.now();
  const incomingId = job.id;
  const frame = job.data;
  const companyId = frame.companyId;

  const traceId = (frame as any).traceId || `trace-${companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return await stepProfiler.runWithContext({ traceId }, async () => {
    stepProfiler.setTraceId(traceId);

    const t_enqueued = (frame as any)._enqueuedAt || ((job as any).createdOn ? new Date((job as any).createdOn).getTime() : t_worker_pickup);
    const queue_delay = Math.max(0, t_worker_pickup - t_enqueued);
    (job as any)._latencyMetrics = { t_worker_pickup, queue_delay };

  if (process.env.DEBUG_LATENCY === "true") {
    console.log(`⏱️ [LATENCY DEBUG] Stage 7 (pg-boss Queue Delay): ${queue_delay} ms`);
    console.log(`⏱️ [LATENCY DEBUG] Worker picked up job at: ${t_worker_pickup}`);
  }

  console.log(`👷 [OrchestratorWorker] Initiating loop frame for Webhook ${incomingId}`);

  if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
    console.error(`🚨 [Security Exception] Webhook ${incomingId} execution aborted: Lacks a valid bound companyId.`);
    throw new Error("Multi-Tenant Security Exception: Missing active tenant binding.");
  }

  const rawInputText = (frame.isCallback ? (frame.callbackData || "") : (frame.text || "")).trim();

  // ⚡ Fast-path short circuit for simple messages (greetings, acknowledgments, farewells, yes/no)
  // Evaluated at entry before heavy DB joins or locks. Completely skips ConcurrencyLock.
  const FAST_PATH_PATTERNS = [
    { pattern: /^(hi|hello|hey|hey there|helloo|howdy|good morning|good afternoon|good evening)$/i, category: "greeting" },
    { pattern: /^(ok|okay|k|got it|sure|thanks|thank you|ty|thx|thankyou|okie|okies)$/i, category: "acknowledgment" },
    { pattern: /^(bye|goodbye|cya|see you|see ya|take care|talk later|gotta go)$/i, category: "farewell" },
    { pattern: /^(yes|no|yeah|nope|yep|nah|yup|nahi|haan|haa)$/i, category: "yesno" },
  ];
  const FAST_PATH_RESPONSES: Record<string, string[]> = {
    greeting: ["Hello! How can I help you today?", "Hi there! What can I do for you?", "Hey! How can I assist you?"],
    acknowledgment: ["You're welcome! Let me know if you need anything else.", "Happy to help! Anything else?", "Got it! Feel free to ask if you have more questions."],
    farewell: ["Goodbye! Have a great day!", "Take care! Reach out anytime.", "Bye! See you next time!"],
    yesno: ["I see. Could you tell me more about what you'd like to order?", "Alright! Let me know how I can help.", "Thanks for letting me know! Can I help with anything else?"],
  };

  let fastPathCategory: string | null = null;
  let fastPathResponse: string | null = null;
  for (const entry of FAST_PATH_PATTERNS) {
    if (entry.pattern.test(rawInputText)) {
      fastPathCategory = entry.category;
      const responses = FAST_PATH_RESPONSES[entry.category];
      fastPathResponse = responses[Math.floor(Math.random() * responses.length)];
      break;
    }
  }

  if (fastPathResponse) {
    P("fast-path matched");
    console.log(`[Orchestrator] ⚡ Fast path triggered (${fastPathCategory}): "${rawInputText}"`);

    const contact = frame.externalChatId.trim();
    const tenantPrisma = getTenantPrismaContext(companyId);

    P("fast-path starting lead lookup");
    const tStartLead = performance.now();

    const existingLead = await prisma.lead.findUnique({
      where: {
        contact_channel_companyId: {
          contact,
          channel: frame.channel,
          companyId
        }
      },
      select: {
        id: true,
        name: true,
        conversations: {
          where: { companyId, deletedAt: null },
          select: { id: true, mode: true, lifecycleStatus: true },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    const tEndLead = performance.now();
    console.log(`[Profiler] Single-roundtrip lead+conv query duration: ${Math.round(tEndLead - tStartLead)}ms`);

    P("fast-path existingLead query done");

    P("fast-path before calling resolveOrCreateLeadAndConversation");
    const { lead, conversation } = await resolveOrCreateLeadAndConversation(
      companyId,
      contact,
      frame.channel,
      frame.contactName || "User",
      existingLead,
      tenantPrisma,
      traceId
    );
    P("fast-path after calling resolveOrCreateLeadAndConversation");

    P("fast-path conv ready");

    if ((conversation as any).mode === "HUMAN") {
      console.log(`🤚 [Orchestrator] Conversation ${conversation.id} is in HUMAN mode — skipping fast-path auto-reply.`);
      const clientMsg = await tenantPrisma.message.create({
        data: { companyId, conversationId: conversation.id, content: rawInputText, sender: MessageSender.CLIENT }
      });
      emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
      return { skipped: true, reason: "HUMAN_MODE" };
    }

    P("fast-path dispatching");

    const activeContext: TenantContext = {
      companyId,
      currencyCode: "USD",
      currencySymbol: "$",
      timezone: "UTC",
      priorityRules: null,
      templates: {},
      aiModelTarget: "llama-3.3-70b-versatile",
      outputProtocolSchema: "JSON_ONLY",
      intentMatrix: undefined,
      localizedHeuristics: undefined,
      businessRulesSchema: undefined
    };

    // 1. Create client inbound message record
    const clientMsg = await tenantPrisma.message.create({
      data: { companyId, conversationId: conversation.id, content: rawInputText, sender: MessageSender.CLIENT }
    });

    // 2. Dispatch outbound reply to external channel asynchronously (does not block job completion on network RTT)
    tenantContextStorage.run(activeContext, () => {
      outboundDispatcherService.sendMessageFrame(
        frame.channel as any,
        frame.externalChatId,
        conversation.id,
        { bodyText: fastPathResponse, interactivePayload: null, replyMarkup: undefined },
        "BOT"
      ).catch((err) => console.error(`[Orchestrator] Fast-path dispatch failed for ${conversation.id}:`, err));
    });

    P("fast-path dispatch done");

    emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
    safeEmitConversationUpdate(conversation, "conversation_updated", {
      conversationId: conversation.id,
      lastContent: fastPathResponse,
      updatedAt: new Date().toISOString(),
    });

    P("fast-path complete");
    return { fast_path: true, category: fastPathCategory, response: fastPathResponse } as any;
  }

  const [companyContext, existingLead] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { botConfiguration: true }
    }),
    prisma.lead.findFirst({
      where: { companyId, contact: frame.externalChatId.trim(), channel: frame.channel },
      include: {
        conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 }
      }
    })
  ]);

  P("company+lead Promise.all done");
  if (!companyContext) throw new Error(`Routing Exception: No tenant registered for ID ${companyId}`);

  // Pre-warm bot token cache from company data so dispatch doesn't need another DB call
  if ((companyContext as any).telegramBotToken) {
    const decryptedBotToken = decryptSecret((companyContext as any).telegramBotToken);
    if (decryptedBotToken) {
      TelegramTransportService.preWarmBotToken(companyId, decryptedBotToken);
    }
  }

  // Start rules loading NOW — in parallel with lead resolution — instead of waiting
  const rulesLoadPromise = (async (): Promise<any[]> => {
    const rulesCacheKey = `rules:${companyId}`;
    const cachedRules = rulesCache.get(rulesCacheKey);
    if (cachedRules && Date.now() - cachedRules.cachedAt < RULES_CACHE_TTL) {
      return cachedRules.rules;
    }
    const rules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
          { OR: [{ groupId: null }, { group: { isEnabled: true } }] },
        ],
      },
      select: {
        id: true, name: true, triggerKeywords: true, triggerType: true, conditions: true,
        templateBody: true, useAI: true, brandVoice: true, targetLanguage: true, sourcePrompt: true,
      },
    });
    rulesCache.set(rulesCacheKey, { rules, cachedAt: Date.now() });
    return rules;
  })();

  const config = (companyContext.botConfiguration as any) || {};
  const activeContext: TenantContext = {
    companyId: companyContext.id,
    currencyCode: (companyContext as any).currencyCode || "USD",
    currencySymbol: (companyContext as any).currencySymbol || "$",
    timezone: (companyContext as any).timezone || "UTC",
    priorityRules: config.priority_rules || null,
    templates: config.templates || {},
    aiModelTarget: config.ai_model_target || "llama-3.3-70b-versatile",
    outputProtocolSchema: config.output_protocol_schema || "JSON_ONLY",
    intentMatrix: config.intent_matrix,
    localizedHeuristics: config.localizedHeuristics,
    businessRulesSchema: config.businessRulesSchema || config.business_rules_schema
  };

  return tenantContextStorage.run(activeContext, async () => {
    const tenantPrisma = getTenantPrismaContext(companyId);
    const channel = frame.channel;
    const text = (frame.text || "").trim();


    const contact = frame.externalChatId.trim();

    // ⚡ Fast, protected Lead & Conversation resolution
    const { lead, conversation: initialConversation } = await resolveOrCreateLeadAndConversation(
      companyContext.id,
      contact,
      channel,
      frame.contactName || "User",
      existingLead,
      tenantPrisma,
      traceId
    );

    let conversation: any = initialConversation;

    // Start messages + draft order fetch immediately after conversation ID is known
    // (parallel with surface bypass, rules, and language detection)
    const messagesDraftPromise = Promise.all([
      tenantPrisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getActiveDraftOrder(companyId, conversation.id),
    ]);

    P("lead lock RELEASED (conv ready)");
    // Note: Platform-native command handling was removed — no StandardMessageFrame
    // construction site ever populated isPlatformCommand/rawPayload.

    const processingText = frame.isCallback ? (frame.callbackData || "") : frame.text;

    // 🧠 Debounced Triage Trigger: Enqueue ai-triage-job based on time (30s window).
    // Bypasses the 30s debounce instantly if customer expresses cancellation/complaint keywords.
    const lastTriagedAt = (conversation as any).sessionState?.lastTriagedAt;
    const isRecentlyTriaged = lastTriagedAt && (Date.now() - new Date(lastTriagedAt).getTime() < 30000);
    const complaintKeywords = ["cancel", "refund", "complaint", "angry", "wrong", "terrible", "bad", "stop", "ridiculous", "issue", "problem"];
    const isComplaintSignal = complaintKeywords.some(kw => (processingText || "").toLowerCase().includes(kw));
    const shouldTriggerTriage = !isRecentlyTriaged || isComplaintSignal;

    P("mode check passed (BOT)");
    if (shouldTriggerTriage && (conversation as any).mode !== "BOT") {
      console.log(`[Orchestrator] 🧠 Triggering ai-triage-job in HUMAN mode (recentlyTriaged=${!!isRecentlyTriaged}, isComplaintSignal=${isComplaintSignal})`);
      try {
        pgBossService.getBoss().send(
          "ai-triage-job",
          { conversationId: conversation.id, companyId: companyContext.id, traceId },
          isComplaintSignal
            ? { startAfter: 1 }
            : { startAfter: 2, singletonKey: `triage-${conversation.id}`, singletonSeconds: 30 }
        ).catch(() => {});
      } catch (err) {}
    }

    // ✅ AI gate: only auto-reply when the conversation is in BOT mode.
    // In HUMAN mode (staff takeover) we still persist the inbound client message
    // and emit realtime updates, but we do NOT run rule matching or LLM reply.
    if ((conversation as any).mode !== "BOT") {
      const clientMsg = await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
        return await tx.message.create({
          data: {
            companyId,
            conversationId: conversation.id,
            content: text,
            sender: MessageSender.CLIENT,
          },
        });
      });
      emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
      await tenantPrisma.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
      await tenantPrisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
      safeEmitConversationUpdate(conversation, "conversation_updated", {
        conversationId: conversation.id,
        lastContent: text,
        updatedAt: new Date().toISOString(),
      });
      console.log(`🤚 [Orchestrator] Conversation ${conversation.id} is in HUMAN mode — skipping AI auto-reply.`);
      return { skipped: true, reason: "HUMAN_MODE" };
    }

    P("conversation already resolved (no reload needed)");
    // ── Phase 1.5: Tapped-button / slash-command bypass ──
    // A tapped inline button (callback_query) carries the rule id in callback_data.
    // A typed "/command" resolves to a surfaced rule. Either way we execute the
    // rule's reply directly and skip keyword/RAG/LLM matching entirely.
    if (frame.channel === Channel.TELEGRAM) {
      let resolvedRuleId: string | null = null;
      let surfacePath: "tap" | "command" | null = null;

      if (frame.isCallback && frame.callbackData) {
        if (frame.callbackData === "back_root") {
          console.log(`[Orchestrator] 🎯 Navigation bypass → back_root`);
          if (frame.callbackQueryId) {
            await telegramSurfaceAdapter.answerCallbackQuery(companyId, frame.callbackQueryId).catch(() => {});
          }
          if (frame.callbackMessageId) {
            try {
              const company = await prisma.company.findUnique({
                where: { id: companyId },
                select: { botWelcomeMessage: true }
              });
              const welcomeText = company?.botWelcomeMessage || "Welcome! Please choose an option from the menu below:";
              const surfaced = await telegramSurfaceAdapter.getActiveSurfacedRules(companyId, null, "BUTTON");
              const kb = telegramSurfaceAdapter.buildInlineKeyboard(surfaced, null);
              await outboundDispatcherService.editMessageFrame(
                frame.channel as any,
                frame.externalChatId,
                frame.callbackMessageId,
                { bodyText: welcomeText, replyMarkup: kb || undefined }
              );
            } catch (err: any) {
              console.error(`[Orchestrator] Failed to render root menu for back_root:`, err.message);
            }
          }
          return { surfacePath: "tap", ruleId: "root" };
        }

        // callback_data stores the rule id (uuid)
        const exists = await prisma.conversationalRule.findUnique({
          where: { id: frame.callbackData },
          select: { id: true, isEnabled: true },
        });
        if (exists && exists.isEnabled) {
          resolvedRuleId = exists.id;
          surfacePath = "tap";
        }
      } else if (processingText && processingText.startsWith("/")) {
        resolvedRuleId = await conversationalAutoReplyService.resolveByCommand(companyId, processingText.trim());
        if (resolvedRuleId) {
          surfacePath = "command";
        } else if (processingText.trim().toLowerCase() === "/start") {
          // Explicit /start command with no custom rule override -> render root menu with root buttons
          const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { botWelcomeMessage: true }
          });
          const welcomeText = company?.botWelcomeMessage || "Welcome! Please choose an option from the menu below:";
          let replyMarkup: any = undefined;
          if (frame.channel === "TELEGRAM") {
            const surfaced = await telegramSurfaceAdapter.getActiveSurfacedRules(companyId, null, "BUTTON");
            const kb = telegramSurfaceAdapter.buildInlineKeyboard(surfaced, null);
            if (kb) replyMarkup = kb;
          }
          await outboundDispatcherService.sendMessageFrame(
            frame.channel as any,
            frame.externalChatId,
            conversation.id,
            { bodyText: welcomeText, interactivePayload: null, replyMarkup },
            "BOT"
          );

          const clientMsg = await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
            return await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: "/start", sender: MessageSender.CLIENT }
            });
          });
          emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
          await tenantPrisma.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
          await tenantPrisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});

          safeEmitConversationUpdate(conversation, "conversation_updated", {
            conversationId: conversation.id,
            lastContent: welcomeText,
            updatedAt: new Date().toISOString(),
          });

          return { surfacePath: "command", ruleId: "start" };
        }
      }

      if (resolvedRuleId && surfacePath) {
        // PART B: Do not bypass if we are actively in an ORDERING intent or have an active DraftOrder
        const draft = await tenantPrisma.draftOrder.findFirst({
          where: { conversationId: conversation.id, companyId, status: { in: ["DRAFTING", "AWAITING_CONFIRMATION"] } }
        });
        const activeDraftOrder = !!draft;
        const isOrdering = (conversation as any).intent === "ORDERING" || activeDraftOrder;

        if (isOrdering && surfacePath === "tap") {
           console.log(`[Orchestrator] 🛑 Surface tap ignored due to active order flow`);
           if (frame.callbackQueryId) {
             await telegramSurfaceAdapter.answerCallbackQuery(companyId, frame.callbackQueryId, "Menu unavailable during active order").catch(() => {});
           }
           if (frame.callbackMessageId && frame.externalChatId && frame.channel === "TELEGRAM") {
             // Strip the stale inline keyboard
             await outboundDispatcherService.editMessageFrame(
               frame.channel as any,
               frame.externalChatId,
               frame.callbackMessageId,
               { bodyText: frame.text || "Menu (Unavailable)", replyMarkup: { inline_keyboard: [] } }
             ).catch(() => {});
           }
           return { surfacePath, ruleId: resolvedRuleId, ignored: true, reason: "active_order" };
        }

        console.log(`[Orchestrator] 🎯 Surface bypass (${surfacePath}) → rule ${resolvedRuleId}`);
        try {
          await conversationalAutoReplyService.executeRuleById(resolvedRuleId, {
            companyId,
            conversationId: conversation.id,
            leadId: lead.id,
            messageText: processingText || "",
            customerName: lead.name || undefined,
            customerSegment: lead.segment,
            customerLanguage: lead.preferredLanguage || undefined,
            channel: (channel === Channel.TELEGRAM ? "TELEGRAM" : channel === Channel.WHATSAPP ? "WHATSAPP" : "INSTAGRAM") as any,
            contact: lead.contact,
            isCallback: frame.isCallback,
            callbackQueryId: frame.callbackQueryId,
            callbackMessageId: frame.callbackMessageId,
          });
        } catch (err: any) {
          console.error(`[Orchestrator] Surface rule execution failed:`, err.message);
        }

        // Clear the button spinner for taps
        if (surfacePath === "tap" && frame.callbackQueryId) {
          await telegramSurfaceAdapter.answerCallbackQuery(companyId, frame.callbackQueryId).catch(() => {});
        }

        // Persist inbound message + update conversation state (no AI reply)
        const clientMsg = await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
          return await tx.message.create({
            data: { companyId, conversationId: conversation.id, content: processingText || "", sender: MessageSender.CLIENT }
          });
        });
        emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
        await tenantPrisma.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
        await tenantPrisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});

        safeEmitConversationUpdate(conversation, "conversation_updated", {
          conversationId: conversation.id,
          lastContent: "[Rule triggered by tap/command]",
          updatedAt: new Date().toISOString(),
        });

        return { surfacePath, ruleId: resolvedRuleId };
      }
    }

    // Rules were loaded in parallel with lead resolution — just await the promise
    const activeConversationalRules = await rulesLoadPromise;

    P("rules loaded");
    const rulesAsContext = activeConversationalRules.length > 0
      ? activeConversationalRules.map(r => {
          if (r.useAI) {
            return `[Rule Instruction: ${r.name}] Keywords: ${(r.triggerKeywords as string[]).join(", ")} → Behavior: ${r.sourcePrompt || r.name} (AI should draft response dynamically using shop context and live inventory)`;
          } else {
            return `[Rule Canned Reply: ${r.name}] Keywords: ${(r.triggerKeywords as string[]).join(", ")} → Response: ${r.templateBody || ""}`;
          }
        }).join("\n")
      : "No custom conversational rules active.";

    // Phase 2a: Start language detection in parallel with rule matching (both only need processingText)
    // detectLanguage always returns a result (never throws — falls back to Unicode on API failure)
    const langPromise = process.env.SARVAM_API_KEY && processingText
      ? detectLanguage(processingText, process.env.SARVAM_API_KEY)
      : Promise.resolve({ language: "en" as const, confidence: 0 });

    let ruleMatched = false;
    if (processingText && activeConversationalRules.length > 0) {
      try {
        const ruleResult = await conversationalAutoReplyService.evaluateMessage({
          companyId,
          conversationId: conversation.id,
          leadId: lead.id,
          messageText: processingText,
          customerName: lead.name || undefined,
          channel: (channel === Channel.TELEGRAM ? "TELEGRAM" : channel === Channel.WHATSAPP ? "WHATSAPP" : "INSTAGRAM") as ChannelType,
          contact: lead.contact,
        });

        if (ruleResult.matched && ruleResult.responseAlreadySent) {
          console.log(`[Orchestrator] ✅ Rule matched: "${ruleResult.ruleName}" — AI reply skipped, rule response sent.`);
          ruleMatched = true;

          P("rule evaluation matched");
          // Still log the customer message and update conversation state
          const clientMsg = await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
            return await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
            });
          });
          emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
          await tenantPrisma.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
          await tenantPrisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }).catch(() => {});
          P("rule-matched msg persistence done");

          safeEmitConversationUpdate(conversation, "conversation_updated", {
            conversationId: conversation.id,
            lastContent: ruleResult.response || "[Rule auto-replied]",
            updatedAt: new Date().toISOString()
          });
          return { ruleMatched: true, ...ruleResult };
        }
      } catch (err: any) {
        console.error(`[Orchestrator] Conversational rule evaluation failed: ${err.message}`);
        // Fall through to main AI if rule evaluation errors
      }
      P("rule evaluation done (no match or fall through)");
    }

    // Phase 2b: Await language detection (started in parallel with rule matching, likely already resolved)
    const detectedLanguage = (await langPromise).language;
    P("lang detection awaited");

    // Retrieve product chunks or policy chunks based on pre-flight intent classification
    let menuSnapshotForAi = config?.botStructuredMenu;
    let triageMatchedProduct: any = null;
    const totalPipelineStart = Date.now();
    let classificationTime = 0;

    // Messages + draft order were fetched in parallel with surface bypass / rules — await
    const [recentMessagesDesc, activeDraftOrder] = await messagesDraftPromise;
    P("Promise.all messages+draft done");

    let classification: PreFlightClassification | null = null;
    if (processingText) {
      // 1. Build thread history for classification context (most recent 6 messages, chronological)
      let threadHistoryStr = "";
      let lastBotMsg: string | null = null;
      try {
        const botMsgObj = recentMessagesDesc.find((m: any) => m.sender === "BOT" || m.sender === "AGENT");
        if (botMsgObj && botMsgObj.content) lastBotMsg = botMsgObj.content;

        threadHistoryStr = recentMessagesDesc
          .slice(0, 6)
          .reverse()
          .map((m: any) => `${m.sender}: ${m.content}`)
          .join("\n");
      } catch (err: any) {
        console.error("[Orchestrator] Error building thread history for classification:", err.message);
      }

      const bypassContext = {
        activeDraftOrder,
        lastBotMessage: lastBotMsg,
      };

      // 2. Run pre-flight classifier and RAG product match in parallel
      P("before intent classification & RAG search");
      const metrics = (job as any)._latencyMetrics || {};
      metrics.t_intent_start = Date.now();
      metrics.t_rag_start = metrics.t_intent_start;
      metrics.stage2a_msg_to_intent_start = metrics.t_intent_start - (metrics.t_worker_pickup || metrics.t_intent_start);

      const startClassificationTime = Date.now();
      const [classificationRes, precomputedProductMatch] = await Promise.all([
        classifyMessageIntentWithTimeout(processingText, threadHistoryStr, 2000, bypassContext),
        matchProductForMessage(companyId, processingText),
      ]);

      classification = classificationRes;
      metrics.t_intent_end = Date.now();
      metrics.t_rag_end = metrics.t_intent_end;
      classificationTime = metrics.t_intent_end - metrics.t_intent_start;
      metrics.stage2b_intent_duration = classificationTime;
      metrics.stage3a_intent_to_rag_start = 0;

      P(`after intent classification & RAG search (${classification!.intent}, ${classification!.inquiryType || "N/A"})`);
      console.log(`⚙️ [Orchestrator Intent & RAG] "${processingText}" → Classified as: ${classification!.intent} (${classification!.inquiryType || "N/A"})`);

      // 3. Conditional context injection based on classified intent
      if (classification.intent === "ProductInquiry") {
        // Semantic product matching result computed in parallel
        triageMatchedProduct = precomputedProductMatch;
        if (triageMatchedProduct) {
          if (triageMatchedProduct.candidates && triageMatchedProduct.candidates.length > 1) {
            const candidateLines = triageMatchedProduct.candidates.map((c: any, idx: number) => {
              const stockNote = c.stockStatus === "OUT_OF_STOCK" ? " (OUT OF STOCK)" : c.stockStatus === "LOW_STOCK" ? " (LOW STOCK)" : "";
              const tierNote = c.confidenceTier === "LOW" ? " (UNVERIFIED)" : "";
              return `${idx + 1}. ${c.name}${c.variant ? ` (${c.variant})` : ""} — Confidence: ${c.confidenceTier}${tierNote}${stockNote}`;
            }).join("\n");
            menuSnapshotForAi = `Multiple Close Product Candidates Found (scores are very close — present all options to customer and ask which one they meant):\n${candidateLines}`;
            console.log(`[Orchestrator RAG] Semantic multi-candidate match (${triageMatchedProduct.candidates.length} options):`, triageMatchedProduct.candidates.map((c: any) => c.name).join(", "));
          } else {
            const tier = triageMatchedProduct.confidenceTier;
            const stockNote = triageMatchedProduct.stockStatus === "OUT_OF_STOCK" ? " (OUT OF STOCK)" : triageMatchedProduct.stockStatus === "LOW_STOCK" ? " (LOW STOCK)" : "";
            const tierNote = tier === "LOW" ? " (UNVERIFIED — ask customer to confirm)" : "";
            const variantLines = triageMatchedProduct.variants && triageMatchedProduct.variants.length > 0
              ? triageMatchedProduct.variants.map((v: any) =>
                  `  - Variant "${v.attributeValue}": Price ₹${v.price ?? 'N/A'}, Stock: ${v.stock ?? 0} units (${v.stockStatus})`
                ).join("\n")
              : "";
            menuSnapshotForAi = `Matched Product: ${triageMatchedProduct.name}${triageMatchedProduct.variant ? ` (Mentioned: ${triageMatchedProduct.variant})` : ""} — Confidence: ${tier}${tierNote}${stockNote}${variantLines ? `\nAvailable Variants & Live Stock Breakdown:\n${variantLines}` : ""}`;
            console.log(`[Orchestrator RAG] Semantic match: ${triageMatchedProduct.name} (${tier}) with ${triageMatchedProduct.variants?.length || 0} variants`);
          }
        } else if (classification.inquiryType === "general") {
          // Semantic matcher returned null — genuine catalog-browsing query
          // (e.g. "what do you have?", "show me the menu").
          // Return broad product list as fallback.
          try {
            const cached = productMenuCache.get(companyId);
            if (cached && Date.now() - cached.cachedAt < PRODUCT_MENU_CACHE_TTL) {
              console.log(`[Orchestrator RAG] Broad DB retrieval served from cache (age=${Date.now() - cached.cachedAt}ms)`);
              menuSnapshotForAi = cached.snapshot;
            } else {
              console.log(`[Orchestrator RAG] Broad DB retrieval query initiated for companyId: "${companyId}"`);
              const dbProducts = await prisma.inventoryProduct.findMany({
                where: { companyId, isActive: true },
                take: 15,
                include: { variants: { where: { isActive: true } } }
              });
              console.log(`[Orchestrator RAG] Broad DB retrieval completed. Found ${dbProducts.length} active products for companyId: "${companyId}"`);
              if (dbProducts.length > 0) {
                menuSnapshotForAi = "Available products:\n" + dbProducts.map((p) => {
                  const parts = [`Product: ${p.name}`];
                  if (p.description) parts.push(`Description: ${p.description}`);
                  if (p.hasVariants && p.variants.length > 0 && p.variantAttributeName) {
                    const variantVals = p.variants.map((v) => `${v.attributeValue} (Price: ₹${v.price})`).join(", ");
                    parts.push(`${p.variantAttributeName}: ${variantVals}`);
                  }
                  parts.push(`Price: ₹${p.basePrice}`);
                  return `- ` + parts.join(", ");
                }).join("\n");
              } else {
                menuSnapshotForAi = config?.botStructuredMenu || "No products currently available.";
              }
              productMenuCache.set(companyId, { snapshot: menuSnapshotForAi, cachedAt: Date.now() });
            }
          } catch (dbErr: any) {
            console.error("[Orchestrator] Fallback broad inventory query failed:", dbErr.message);
            menuSnapshotForAi = config?.botStructuredMenu || "No products currently available.";
          }
        } else {
          // Specific inquiry with no match — clean "not found" message
          menuSnapshotForAi = "No matching products found.";
          console.log(`[Orchestrator RAG] Semantic match: none (null)`);
        }
      } else if (classification.intent === "Support/Policy") {
        try {
          const policyChunks = await retrieveSimilarChunks(companyId, processingText, 5, "POLICY");
          console.log(`[Orchestrator RAG] Policy retrieval size: ${policyChunks.length}`);
          if (policyChunks.length > 0) {
            menuSnapshotForAi = "Company Policies & Info:\n" + policyChunks.map((p) => `- ${p.content}`).join("\n");
          } else {
            menuSnapshotForAi = config?.botPolicies || "No specific policy guidelines registered.";
          }
        } catch (err: any) {
          console.error("[Orchestrator] Policy chunk retrieval failed, using fallback:", err.message);
          menuSnapshotForAi = config?.botPolicies || "No specific policy guidelines registered.";
        }
      } else {
        menuSnapshotForAi = "";
        console.log(`[Orchestrator RAG] Skipping product catalog lookup for intent "${classification.intent}"`);
      }
      metrics.t_rag_end = Date.now();
      metrics.stage3b_rag_duration = metrics.t_rag_end - metrics.t_rag_start;
      P("after RAG context retrieval");

      // 🧠 Debounced Triage Trigger: Enqueue ai-triage-job after RAG context retrieval
      // so precomputed product match can be passed via job payload to prevent duplicate RAG execution.
      if (shouldTriggerTriage) {
        const hasPrecomputedProductMatch = classification?.intent === "ProductInquiry";
        console.log(`[Orchestrator] 🧠 Triggering ai-triage-job (recentlyTriaged=${!!isRecentlyTriaged}, isComplaintSignal=${isComplaintSignal}, hasPrecomputedProductMatch=${hasPrecomputedProductMatch}, matchName=${triageMatchedProduct?.name || "null"})`);
        try {
          pgBossService.getBoss().send(
            "ai-triage-job",
            {
              conversationId: conversation.id,
              companyId: companyContext.id,
              traceId,
              // Precomputed result from orchestrator's matchProductForMessage call passed through job payload
              precomputedProductMatch: triageMatchedProduct,
              hasPrecomputedProductMatch
            },
            isComplaintSignal
              ? { startAfter: 1 }
              : { startAfter: 2 }
          ).then((jobId: any) => {
            console.log(`[Orchestrator] ✅ Enqueued ai-triage-job ${jobId} (hasPrecomputedProductMatch=${hasPrecomputedProductMatch})`);
          }).catch((err: any) => {
            console.error("[Orchestrator] ❌ Error sending ai-triage-job:", err?.message || err);
          });
        } catch (err) {}
      }
    }

    // Conversation memory window from shared 10-message fetch (chronological order)
    const conversationHistory = [...recentMessagesDesc].reverse().map((m: any) => ({
      sender: m.sender,
      content: m.content
    }));

    const metrics = (job as any)._latencyMetrics || {};
    metrics.t_ai_call_start = Date.now();
    metrics.stage4_rag_done_to_ai_start = metrics.t_ai_call_start - (metrics.t_rag_end || metrics.t_intent_end || metrics.t_intent_start || metrics.t_worker_pickup);

    // ⚡ FAST PATH: Lightweight model for non-commerce queries
    // Uses llama-3.1-8b-instant instead of the full 70B commerce prompt.
    // This keeps latency low (~500ms-2s vs 10s) while remaining contextual
    // — it handles the customer's actual language, business personality,
    // and mixed messages like "hi, are you open?" correctly.
    let aiTurnResult: UnifiedShopResponse;
    const tLlmStart = performance.now();
    if (classification?.intent === "Greeting/SmallTalk") {
      const fastReply = await generateFastReply({
        user_message: processingText,
        detected_language: detectedLanguage || "en",
        business_name: companyContext?.name || "our store",
      });
      aiTurnResult = {
        intent_type: fastReply.intent_type as any || "Query",
        tool_call: null,
        replyText: fastReply.replyText || "Hello! How can I help you today?",
        thread_summary: "Greeting — fast path (llama-3.1-8b-instant).",
        suggested_human_response: "",
        detected_meta: { language: detectedLanguage || "en", sentiment: "POSITIVE", confidence: 1.0 },
        extracted_order: { items: [], total_amount: 0, recipient_name: undefined, recipient_phone: undefined, address_details: { raw_input: "", house_or_plot: "", street_or_gully: "", landmark: "", city: "", state: "", pincode: "" }, needs_follow_up: false, follow_up_reason: undefined }
      };
      console.log(`⚡ [Orchestrator] Greeting fast-path: lang=${detectedLanguage}, reply="${fastReply.replyText}"`);
    } else {
      aiTurnResult = await generateShopReply({
        tenant_id: companyId,
        user_message: processingText,
        session_state: (conversation as any)?.sessionState || {},
        menu_snapshot: menuSnapshotForAi,
        matched_product: triageMatchedProduct,
        detected_language: detectedLanguage,
        activeRules: rulesAsContext,
        conversation_history: conversationHistory,
        active_draft_order: activeDraftOrder,
      });
    }
    const tLlmEnd = performance.now();
    metrics.t_ai_call_end = Date.now();
    metrics.ai_call_duration = Math.round(tLlmEnd - tLlmStart);

    P(`after generateShopReply LLM call (took ${Math.round(tLlmEnd - tLlmStart)}ms)`);

    const totalPipelineDuration = Date.now() - totalPipelineStart;
    console.log(`⏱️ [Pipeline Latency] Intent classifier: ${classificationTime}ms, Total: ${totalPipelineDuration}ms (including main generation)`);
    P("AI gen done — Pipeline Latency logged");

    const sessionStateObj: any = (conversation as any)?.sessionState || {};
    const cartItemsCount = sessionStateObj.cart?.items?.length || 0;
    const orderTotal = sessionStateObj.cart?.items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
    const priorityInput = { extracted_order_total: (aiTurnResult?.extracted_order?.total_amount ?? orderTotal), extracted_items_count: (aiTurnResult?.extracted_order?.items?.length ?? cartItemsCount) };
    const priority = evaluateTenantPriorityRules(priorityInput, activeContext.priorityRules);
    const { replyText, detected_meta, tool_call, thread_summary, suggested_human_response, intent_type: rawIntentType } = aiTurnResult;
    const intent_type = rawIntentType as string;
    const sentimentScoreMap: Record<string, number> = { "POSITIVE": 1, "NEUTRAL": 0, "NEGATIVE": -1 };
    const resolvedScore = sentimentScoreMap[detected_meta?.sentiment] ?? 0;

    P("session state processed");

    // 🛡️ PRE-SEND GUARD: Fresh PK lookup with fail-closed fallback.
    let modeIsBot = false;
    let guardMode: string | null = null;
    try {
      P("guard: before findUnique");
      const guardConv = await directPrisma.conversation.findUnique({
        where: { id: conversation.id, companyId },
        select: { mode: true }
      });
      P("guard: after findUnique");
      if (guardConv) {
        guardMode = guardConv.mode;
        modeIsBot = guardMode === "BOT";
      }
    } catch (guardErr: any) {
      console.error(`🛡️ [Orchestrator] Pre-send guard query failed for conversation ${conversation.id}: ${guardErr?.message || String(guardErr)}`);
      // modeIsBot stays false → dispatch skipped (fail closed)
    }
    P("pre-send guard done");

    let dispatchStatus: "SENT" | "FAILED" = "SENT";
    let dispatchError: string | undefined = undefined;
    let persistedBotMsg: any = null;

    // ⚡ STEP 1: DB BOOKKEEPING, ORDER SYNCS & PERSISTENCE (Synchronous & Blocking)
    try {
      const res = await stepProfiler.time(
        "Post-Generation Window Total (Guard Done -> Socket Emit Done)",
        "ai.orchestrator.worker.ts:955",
        "DB query",
        `Complete post-generation persistence window for conversation ${conversation.id}`,
        true,
        async () => {
          // 🛒 1. Sync / Update DraftOrder from AI extracted order output
          if (aiTurnResult?.extracted_order && Array.isArray(aiTurnResult.extracted_order.items) && aiTurnResult.extracted_order.items.length > 0) {
            await stepProfiler.time(
              "syncDraftOrderFromAi",
              "ai.orchestrator.worker.ts:957",
              "DB query",
              `DraftOrder sync for conversation ${conversation.id}`,
              true,
              async () => {
                const syncedDraft = await syncDraftOrderFromAi({
                  companyId,
                  conversationId: conversation.id,
                  leadId: lead.id,
                  extractedOrder: aiTurnResult.extracted_order,
                  rawUserMessage: processingText
                }).catch((e) => console.error("[Orchestrator] Draft order sync failed:", e.message));
                if (syncedDraft) {
                  console.log(`📝 [Orchestrator] Synced DraftOrder ${syncedDraft.id} status=${syncedDraft.status}`);
                }
              }
            );
          }

          // 🛒 2. Confirm active DraftOrder when intent is OrderConfirmed
          const confirmationPhrases = [
            "confirm", "confirm order", "confirm my order", "yes confirm",
            "book it", "confirm it", "yes book it", "confirm order please"
          ];
          const isExplicitConfirmation = confirmationPhrases.includes(processingText.trim().toLowerCase());
          const isOrderConfirmed = intent_type === "OrderConfirmed" || isExplicitConfirmation;

          if (isOrderConfirmed) {
            console.log(`🛒 [Orchestrator] Confirming active DraftOrder...`);
            await stepProfiler.time(
              "confirmActiveDraftOrder",
              "ai.orchestrator.worker.ts:983",
              "DB query",
              `Confirm DraftOrder for conversation ${conversation.id}`,
              true,
              async () => {
                await confirmActiveDraftOrder(companyId, conversation.id).catch((e) =>
                  console.error("[Orchestrator] Order confirmation failed:", e.message)
                );
              }
            );
          }

          // 🔄 PHASE 1 — Run in parallel: Lead pending order sync (Op 1) & App-level message dedup check (Op 2)
          const [_, recentDuplicate] = await stepProfiler.time(
            "Phase 1 — Pre-Lock Parallel (Ops 1 & 2)",
            "ai.orchestrator.worker.ts:1003",
            "DB query",
            `Phase 1 parallel execution of Op 1 & Op 2 for conversation ${conversation.id}`,
            true,
            async () => {
              return await Promise.all([
                stepProfiler.time(
                  "syncLeadPendingOrderState",
                  "ai.orchestrator.worker.ts:1004",
                  "DB query",
                  `Sync lead pending order state for lead ${lead.id}`,
                  true,
                  async () => {
                    await syncLeadPendingOrderState(companyId, lead.id, conversation.id).catch(() => {});
                  }
                ),
                stepProfiler.time(
                  "App-level Message Dedup Check (findFirst)",
                  "ai.orchestrator.worker.ts:1020",
                  "DB query",
                  `findFirst Message in last 60s for conversation ${conversation.id}`,
                  true,
                  async () => {
                    const sixtySecondsAgo = new Date(Date.now() - 60000);
                    return await tenantPrisma.message.findFirst({
                      where: {
                        conversationId: conversation.id,
                        content: text,
                        sender: MessageSender.CLIENT,
                        createdAt: { gte: sixtySecondsAgo }
                      },
                      select: { id: true }
                    });
                  }
                )
              ]);
            }
          );

          if (recentDuplicate) {
            console.log(`⏭️ [Orchestrator] Duplicate webhook detected for conversation ${conversation.id} — skipping (existing msg ${recentDuplicate.id})`);
            return { clientMsg: null, botMsg: null, isDuplicate: true };
          }

          // 💾 PHASE 2 — Isolated: Atomic Client & Bot Message Persistence (Op 3)
          const timeBucket = Math.floor(Date.now() / 60000).toString();
          const dedupKey = crypto.createHash("sha256").update(`${conversation.id}:${text}:${timeBucket}`).digest("hex");
          const { clientMsg, botMsg } = await ConcurrencyLock.withConversationLock(
            conversation.id,
            async (tx) => {
              try {
                const clientMsgPromise = tx.message.create({
                  data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
                });
                const botMsgPromise = modeIsBot
                  ? tx.message.create({
                      data: {
                        companyId,
                        conversationId: conversation.id,
                        content: replyText,
                        sender: MessageSender.BOT,
                        platform: (frame.channel === "TELEGRAM" ? Channel.TELEGRAM : frame.channel === "WHATSAPP" ? Channel.WHATSAPP : Channel.INSTAGRAM) as Channel,
                        deliveryStatus: dispatchStatus,
                        ...(dispatchError ? { deliveryError: dispatchError } : {})
                      }
                    })
                  : Promise.resolve(null);

                const [clientMsg, botMsg] = await Promise.all([clientMsgPromise, botMsgPromise]);
                return { clientMsg, botMsg };
              } catch (createErr: any) {
                if (createErr.code === "P2002" && createErr.meta?.target?.includes("dedupKey")) {
                  return { clientMsg: null, botMsg: null };
                }
                throw createErr;
              }
            }
          );

          // 🛡️ DB-level dedup caught the race
          if (!clientMsg) {
            console.log(`⏭️ [Orchestrator] DB-level dedup caught race for conversation ${conversation.id} — ignoring`);
            return { clientMsg: null, botMsg: null, isDuplicate: true };
          }

          metrics.t_db_write_done = Date.now();
          metrics.stage5_ai_end_to_db_write = metrics.t_db_write_done - (metrics.t_ai_call_end || metrics.t_db_write_done);

          // 📡 PHASE 3 — Run in parallel: Combined Lead & Conversation update transaction (Ops 4 & 5) and Socket emissions
          await stepProfiler.time(
            "Phase 3 — Post-Lock Parallel (Ops 4, 5 & Sockets)",
            "ai.orchestrator.worker.ts:1085",
            "DB query",
            `Phase 3 combined execution of Ops 4, 5 & Sockets for conversation ${conversation.id}`,
            true,
            async () => {
              await Promise.all([
                stepProfiler.time(
                  "Combined Lead & Conversation Update Transaction",
                  "ai.orchestrator.worker.ts:1083",
                  "DB query",
                  `update lead ${lead.id} and conversation ${conversation.id}`,
                  true,
                  async () => {
                    await tenantPrisma.$transaction([
                      tenantPrisma.lead.update({
                        where: { id: lead.id },
                        data: {
                          aiPriority: priority === "URGENT" ? "HIGH" : priority === "HIGH" ? "MEDIUM" : "LOW",
                          lastActiveAt: new Date()
                        }
                      }),
                      tenantPrisma.conversation.update({
                        where: { id: conversation.id },
                        data: { updatedAt: new Date() }
                      })
                    ]).catch((e) => console.error("[Orchestrator] Non-critical lead/conversation update transaction failed:", e.message));
                  }
                ),
                stepProfiler.time(
                  "Socket Updates Emission",
                  "ai.orchestrator.worker.ts:1119",
                  "External call",
                  `emitToConversation & safeEmitConversationUpdate for conversation ${conversation.id}`,
                  true,
                  async () => {
                    if (clientMsg) {
                      emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
                    }
                    if (botMsg) {
                      emitToConversation(conversation.id, "new_message", { ...botMsg, conversationId: conversation.id });
                      if (contact) {
                        emitToVisitor(contact, "new_message", { ...botMsg, conversationId: conversation.id });
                      }
                    }
                    safeEmitConversationUpdate(conversation, "conversation_updated", {
                      conversationId: conversation.id,
                      lastContent: replyText,
                      updatedAt: new Date().toISOString()
                    });
                  }
                )
              ]);
            }
          );

          metrics.t_socket_emit_done = Date.now();
          metrics.stage6_db_write_to_socket_emit = metrics.t_socket_emit_done - metrics.t_db_write_done;

          return { clientMsg, botMsg, isDuplicate: false };
        }
      );

      if (res?.isDuplicate) {
        return { status: "duplicate_ignored" };
      }
      persistedBotMsg = res?.botMsg;
      P("socket emit done");
    } catch (bgErr: any) {
      console.error("⚠️ [Orchestrator] Persistence error:", bgErr.message);
      return aiTurnResult;
    }

      if (process.env.DEBUG_LATENCY === "true") {
        const totalNonAi = (metrics.stage2a_msg_to_intent_start || 0) + 
                           (metrics.stage2b_intent_duration || 0) + 
                           (metrics.stage3a_intent_to_rag_start || 0) + 
                           (metrics.stage3b_rag_duration || 0) + 
                           (metrics.stage4_rag_done_to_ai_start || 0) + 
                           (metrics.stage5_ai_end_to_db_write || 0) + 
                           (metrics.stage6_db_write_to_socket_emit || 0) + 
                           (metrics.queue_delay || 0);

        console.log(`
===================== LATENCY BENCHMARK REPORT =====================
Stage 1: Telegram polling delay                     | ~1500 ms (setTimeout loop)
Stage 2a: Msg received -> Intent classification start | ${metrics.stage2a_msg_to_intent_start || 0} ms
Stage 2b: Intent classification duration             | ${metrics.stage2b_intent_duration || 0} ms
Stage 3a: Intent classified -> RAG retrieval start   | ${metrics.stage3a_intent_to_rag_start || 0} ms
Stage 3b: RAG retrieval duration                     | ${metrics.stage3b_rag_duration || 0} ms
Stage 4: RAG done -> AI model call START             | ${metrics.stage4_rag_done_to_ai_start || 0} ms
[AI Model Call Execution Time (EXCLUDED)]            | ${metrics.ai_call_duration || 0} ms
Stage 5: AI model call END -> DB write of reply      | ${metrics.stage5_ai_end_to_db_write || 0} ms
Stage 6: DB write -> Socket.IO emit                  | ${metrics.stage6_db_write_to_socket_emit || 0} ms
Stage 7: pg-boss queue (enqueued -> picked up)       | ${metrics.queue_delay || 0} ms
================================================================────
Total Non-AI Pipeline Latency: ${totalNonAi} ms (excluding polling delay)
================================================================────
        `);
      }
      P("socket emit done");

    // ⚡ STEP 2: OUTBOUND TELEGRAM DISPATCH — Only after successful persistence
    if (modeIsBot) {
      P("before outboundDispatcherService.sendTransportOnlyFrame");
      let replyMarkup: any = undefined;
      const dispatchResult = await outboundDispatcherService.sendTransportOnlyFrame(
        frame.channel as any,
        frame.externalChatId,
        { bodyText: replyText, interactivePayload: tool_call ? JSON.parse(JSON.stringify(tool_call)) : null, replyMarkup }
      );
      dispatchStatus = dispatchResult.deliveryStatus;
      dispatchError = dispatchResult.transportError;
      P("transport dispatch done");

      if (persistedBotMsg?.id) {
        await prisma.message.update({
          where: { id: persistedBotMsg.id },
          data: {
            deliveryStatus: dispatchStatus,
            ...(dispatchError ? { deliveryError: dispatchError } : { deliveryError: null })
          }
        }).catch((err: any) => console.error(`[Orchestrator] Delivery status update failed for message ${persistedBotMsg.id}:`, err.message));
      }
    } else {
      console.log(
        `🛡️ [Orchestrator] Conversation ${conversation.id} mode is "${guardMode ?? "UNKNOWN"}" at send time — aborting AI reply dispatch.`
      );
    }

    P("FULL PIPELINE EXIT");
    return aiTurnResult;
  });
});
}

// Tracks job IDs processed in this process lifetime to prevent duplicate
// execution from pg-boss retries or crash-recovery replay.
const processedJobIds = new Set<string>();

// Cache for general product menu queries (broad inventoryProduct.findMany).
// 60s TTL means catalog changes by admin take up to 60s to reflect in chat;
// this is an accepted latency-vs-consistency tradeoff for a ~1.2s query.
const productMenuCache = new Map<string, { snapshot: string; cachedAt: number }>();
const PRODUCT_MENU_CACHE_TTL = 60_000;

// Cache for active conversational rules (admin UI updates push new rules, but
// a 30s staleness window is acceptable given the ~967ms query cost per message).
const rulesCache = new Map<string, { rules: any[]; cachedAt: number }>();
const RULES_CACHE_TTL = 30_000;

const JOB_ID_CLEANUP_INTERVAL = 3600_000; // 1 hour

// Periodically trim the processed-job Set to prevent unbounded memory growth.
setInterval(() => { processedJobIds.clear(); }, JOB_ID_CLEANUP_INTERVAL).unref();

export async function startOrchestratorWorker(): Promise<void> {
  const PROCESS_PROFILE = process.env.PROCESS_PROFILE || "COMBINED";
  if (PROCESS_PROFILE !== "WORKER" && PROCESS_PROFILE !== "COMBINED") {
    console.log(`👷 [Orchestrator] Skipping startup. Processor profile is "${PROCESS_PROFILE}" (Requires WORKER or COMBINED)`);
    return;
  }
  console.log("👷 [Orchestrator] Activating pg-boss worker subscription loop...");
  try {
    const boss = pgBossService.getBoss();
    await boss.work("webhook.process", { batchSize: 5 }, async (jobs: Array<any>) => {
      await Promise.all(
        jobs.map(async (job) => {
          if (processedJobIds.has(job.id)) {
            console.log(`⏭️ [Orchestrator] Skipping already-processed job ${job.id}`);
            return;
          }
          processedJobIds.add(job.id);
          try {
            await processWebhookJob(job);
          } catch (jobErr) {
            console.error(`❌ [Orchestrator] Job execution failed for ID ${job.id}:`, jobErr);
            throw jobErr;
          }
        })
      );
    });
    console.log('✅ [Orchestrator] Successfully registered subscription loop to pg-boss queue "webhook.process"');
  } catch (initErr) { console.error("❌ [Orchestrator] Failed registering subscriber loop:", initErr); }
}