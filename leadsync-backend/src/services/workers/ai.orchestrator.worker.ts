import PgBoss from "pg-boss";
import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { ConcurrencyLock } from "../../utils/concurrencyLock";
import { outboundDispatcherService } from "../outbound.dispatcher";
import { Channel, MessageSender, ConversationStatus } from "@prisma/client";
import { generateShopReply } from "../ai/ai.service";
import { retrieveProductChunks, RetrievedChunk } from "../knowledge/knowledgeRetriever.service";
import { StandardMessageFrame } from "../../interfaces/messaging.interface";
import { tenantContextStorage, TenantContext } from "../context/tenantContext.provider";
import { safeEmitConversationUpdate, emitToConversation, emitToCompanyAdmin, emitToCompany, emitToAgent, getIO } from "../../lib/socket";
import { triggerLeadWelcome } from "../automation/autoReplyEventListeners";
import { conversationalAutoReplyService } from "../automation/conversationalAutoReply.service";
import { detectLanguage } from "../ai/languageDetection.service";
import { ChannelType } from "../../interfaces/outbound.interface";
import { reapGhostsForCompany } from "../infrastructure/ghostReaper.service";
import { findLeastLoadedStaff } from "../assignment.service";

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

export async function processWebhookJob(job: { id: string; data: StandardMessageFrame }) {
  const incomingId = job.id;
  const frame = job.data;
  const companyId = frame.companyId;

  console.log(`👷 [OrchestratorWorker] Initiating loop frame for Webhook ${incomingId}`);

  if (!companyId || typeof companyId !== "string" || companyId.trim() === "") {
    console.error(`🚨 [Security Exception] Webhook ${incomingId} execution aborted: Lacks a valid bound companyId.`);
    throw new Error("Multi-Tenant Security Exception: Missing active tenant binding.");
  }

  const [companyContext, currentInventory, existingLead] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { botConfiguration: true }
    }),
    prisma.product.findMany({ where: { companyId, isActive: true } }),
    prisma.lead.findFirst({
      where: { companyId, contact: frame.externalChatId.trim(), channel: frame.channel },
      include: {
        conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 }
      }
    })
  ]);

  if (!companyContext) throw new Error(`Routing Exception: No tenant registered for ID ${companyId}`);

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

    // 🧹 Realtime ghost sweep — fire-and-forget. Any ghost conversations in
    // this tenant (orphan / null-name lead, zero messages, stale) are
    // soft-deleted before this webhook can interact with them. The 15m
    // interval sweep is the safety net for tenants with no inbound traffic.
    reapGhostsForCompany(companyContext.id).catch((err) =>
      console.error("[Orchestrator] Ghost sweep failed:", err)
    );

    // Returning customer logic: if the lead has any archived conversation, the
    // new inbound message should start a fresh thread rather than reusing an
    // already-completed conversation. Active conversations are still reused.
    //
    // Concurrency: this block MUST run under a lock keyed by the lead. Two
    // near-simultaneous inbound messages for the same returning lead can
    // otherwise both pass the `if (!conversation)` check and create duplicate
    // threads. The per-conversation locks used later in this worker cannot
    // protect the create path because the conversation ID does not exist
    // until after `conversation.create`. We therefore key the lock on the
    // lead ID (or a deterministic placeholder for first-touch leads) and
    // re-check inside the lock whether a concurrent webhook just created
    // the lead or an active conversation while we were waiting.
    const contact = frame.externalChatId.trim();
    const leadLockKey = existingLead?.id
      ? `lead:${existingLead.id}`
      : `lead-pending:${companyContext.id}:${contact}:${frame.channel}`;

    let conversation: any = null;
    let lead: any = existingLead;

    await ConcurrencyLock.withConversationLock(leadLockKey, async () => {
      let freshExistingLead: any = null;
      try {
        freshExistingLead = await prisma.lead.findFirst({
          where: { companyId: companyContext.id, contact, channel },
          include: {
            conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 },
          },
        });
      } catch (err) {
        console.error("[Orchestrator] lead re-check inside lock failed:", err);
      }

      const localActiveConv = (freshExistingLead?.conversations || []).find(
        (c: any) => c.lifecycleStatus === "active" || !c.lifecycleStatus
      ) as any | undefined;
      const localHasArchivedHistory = (freshExistingLead?.conversations || []).some(
        (c: any) => c.lifecycleStatus === "archived"
      );

      let localConversation: any = localActiveConv || null;
      let localLead: any = freshExistingLead;

      if (!localConversation) {
        let newLead = freshExistingLead;
        if (!newLead) {
          newLead = await tenantPrisma.lead.create({
            data: { companyId: companyContext.id, contact, channel, name: frame.contactName || "User" },
          });
        } else if (frame.contactName) {
          newLead = await tenantPrisma.lead.update({ where: { id: newLead.id }, data: { name: frame.contactName } });
        }
        localLead = newLead;
        localConversation = await tenantPrisma.conversation.create({
          data: {
            channel: frame.channel,
            companyId: companyContext.id,
            status: ConversationStatus.OPEN,
            leadId: newLead.id,
            isReturningCustomer: localHasArchivedHistory,
          },
          include: { lead: true },
        });

        triggerLeadWelcome(newLead.id, companyContext.id).catch(err =>
          console.error("[Orchestrator] Failed to trigger lead welcome:", err)
        );
        pgBossService.getBoss().send(
          "ai-triage-job",
          { conversationId: localConversation.id, companyId: companyContext.id },
          { startAfter: 5 }
        );

        try {
          const io = getIO();
          if (io) {
            io.to(`company:${companyContext.id}`).emit("conversation:new", {
              conversationId: localConversation.id,
              isReturningCustomer: localHasArchivedHistory,
            });
          }
        } catch (err) {
          console.error("[Orchestrator] Failed to emit conversation:new:", err);
        }
      } else if (localHasArchivedHistory && !localConversation.isReturningCustomer) {
        await tenantPrisma.conversation.update({
          where: { id: localConversation.id },
          data: { isReturningCustomer: true },
        });
      }

      conversation = localConversation;
      lead = localLead;
    });

    // 🔌 SHORT-CIRCUIT: Platform-native commands should not trigger AI/rules/escalation.
    // Let triggerLeadWelcome still fire for lead creation, but skip processing.
    // This prevents Telegram commands like /start from falsely triggering order_confirm escalation.
    if (frame.isPlatformCommand) {
      console.log(`[Orchestrator] Ignoring platform-native command: ${frame.rawPayload?.message?.text || "unknown"}`);
      // For EXISTING leads, send a brief "Welcome back!" reply to avoid silence.
      // (New leads already get triggerLeadWelcome in the !localConversation branch above.)
      const isExistingLead = existingLead !== null;
      if (isExistingLead) {
        await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
          // Persist the platform command as CLIENT message for context
          await tx.message.create({
            data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
          });
        });
        // Send welcome-back reply via outbound dispatcher (handles its own transaction + SYSTEM message)
        await outboundDispatcherService.dispatch({
          companyId,
          conversationId: conversation.id,
          to: lead.contact,
          channel: channel === Channel.TELEGRAM ? "TELEGRAM" : "WHATSAPP",
          content: { text: "Welcome back! How can I help you today?" },
          sender: "SYSTEM"
        });
      }
      return { skipped: true, reason: "PLATFORM_NATIVE_COMMAND" };
    }

    const processingText = frame.isCallback ? (frame.callbackData || "") : frame.text;

    // ✅ AI gate: only auto-reply when the conversation is in BOT mode.
    // In HUMAN mode (staff takeover) we still persist the inbound client message
    // and emit realtime updates, but we do NOT run rule matching or LLM reply.
    if ((conversation as any).mode !== "BOT") {
      await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
        let clientMsg = await tx.message.findFirst({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 1
        });
        if (!clientMsg) {
          clientMsg = await tx.message.create({
            data: {
              companyId,
              conversationId: conversation.id,
              content: text,
              sender: MessageSender.CLIENT,
            },
          });
        }
        await tx.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });
        emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
      });
      safeEmitConversationUpdate(conversation, "conversation_updated", {
        conversationId: conversation.id,
        lastContent: text,
        updatedAt: new Date().toISOString(),
      });
      console.log(`🤚 [Orchestrator] Conversation ${conversation.id} is in HUMAN mode — skipping AI auto-reply.`);
      return { skipped: true, reason: "HUMAN_MODE" };
    }

    // 🧠 Phase 2: Evaluate conversational smart rules against the inbound message
    // Always re-load latest assignment state before any socket/inbox updates.
    // Keep strict-null-safety: `findFirst` can return null.
    const freshConversation = await tenantPrisma.conversation.findFirst({
      where: { id: conversation.id, companyId, deletedAt: null },
      select: { id: true, companyId: true, claimedById: true },
    });

    if (!freshConversation) {
      console.error(`[OrchestratorWorker] Conversation missing or soft-deleted after reload: ${conversation.id}`);
      return { skipped: true, reason: "CONVERSATION_SOFT_DELETED" };
    }

    conversation = freshConversation as any;

    // Load active rules to use for BOTH rule matching AND AI context
    const activeConversationalRules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      select: {
        id: true,
        name: true,
        triggerKeywords: true,
        triggerType: true,
        conditions: true,
        templateBody: true,
        useAI: true,
        brandVoice: true,
        targetLanguage: true,
      },
    });

    // Build a text summary of active rules to feed to the main AI as context
    const rulesAsContext = activeConversationalRules.length > 0
      ? activeConversationalRules.map(r =>
          `[Rule: ${r.name}] Keywords: ${(r.triggerKeywords as string[]).join(", ")} → Response: ${(r.templateBody as string || "").substring(0, 120)}`
        ).join("\n")
      : "No custom conversational rules active.";

    // Phase 2a: Try rule matching first (now blocking/awaited)
    let ruleMatched = false;
    if (processingText && activeConversationalRules.length > 0) {
      try {
        const ruleResult = await conversationalAutoReplyService.evaluateMessage({
          companyId,
          conversationId: conversation.id,
          leadId: lead.id,
          messageText: processingText,
          customerName: lead.name || undefined,
          channel: ((channel as string) === "telegram" ? "TELEGRAM" : (channel as string) === "whatsapp" ? "WHATSAPP" : "INSTAGRAM") as ChannelType,
          contact: lead.contact,
        });

        if (ruleResult.matched && ruleResult.responseAlreadySent) {
          console.log(`[Orchestrator] ✅ Rule matched: "${ruleResult.ruleName}" — AI reply skipped, rule response sent.`);
          ruleMatched = true;

          // Still log the customer message and update conversation state
          // But DON'T send a second AI reply — the rule already handled it
          await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
            let clientMsg = await tx.message.findFirst({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: 'desc' },
              take: 1
            });
            if (!clientMsg) {
              clientMsg = await tx.message.create({
                data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
              });
              emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
            }
            await tx.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } });
            await tx.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() }
            });
          });

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
    }

    // Phase 2b: Only run main AI if no rule matched
    // Detect language using Sarvam AI (with Unicode fallback)
    const detectedLanguage = process.env.SARVAM_API_KEY && processingText
      ? (await detectLanguage(processingText, process.env.SARVAM_API_KEY)).language
      : "en";

    // Retrieve product chunks for RAG grounding if processing text exists
    let menuSnapshotForAi = config?.botStructuredMenu;
    if (processingText) {
      const matchingProducts = await retrieveProductChunks(companyId, processingText, 10);
      console.log("[DEBUG] matchingProducts length:", matchingProducts.length);
      if (matchingProducts.length > 0) {
        menuSnapshotForAi = "Available products:\n" + matchingProducts.map((p) => `- ${p.content}`).join("\n");
      }
      console.log("[DEBUG] menuSnapshotForAi:", menuSnapshotForAi?.substring(0, 200));
    }

    const aiTurnResult = await generateShopReply({
      tenant_id: companyId,
      user_message: processingText,
      session_state: (conversation as any)?.sessionState || {},
      retrieved_items: currentInventory,
      menu_snapshot: menuSnapshotForAi,
      detected_language: detectedLanguage,
      activeRules: rulesAsContext,
    });

    const sessionStateObj: any = (conversation as any)?.sessionState || {};
    const cartItemsCount = sessionStateObj.cart?.items?.length || 0;
    const orderTotal = sessionStateObj.cart?.items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
    const priorityInput = { extracted_order_total: (aiTurnResult?.extracted_order?.total_amount ?? orderTotal), extracted_items_count: (aiTurnResult?.extracted_order?.items?.length ?? cartItemsCount) };
    const priority = evaluateTenantPriorityRules(priorityInput, activeContext.priorityRules);
    const { replyText, detected_meta, tool_call, thread_summary, suggested_human_response, intent_type: rawIntentType } = aiTurnResult;
    const intent_type = rawIntentType as string;
    const sentimentScoreMap: Record<string, number> = { "POSITIVE": 1, "NEUTRAL": 0, "NEGATIVE": -1 };
    const resolvedScore = sentimentScoreMap[detected_meta?.sentiment] ?? 0;

    // ============================================================
    // 🔔 ESCALATION TRIGGERS — before sending AI reply
    // ============================================================
    // Check if the AI classified this as needing human handoff:
    // 1. intent_type === "HUMAN_HANDOFF" (fallback/parse failure)
    // 2. suggested_human_response is meaningful (non-empty string)
    // 3. intent_type hints at complaint/refund/order_confirm
    // 4. Sentiment is very negative
    const needsHumanEscalation =
      intent_type === "HUMAN_HANDOFF" ||
      intent_type === "Support" ||
      (detected_meta?.sentiment === "NEGATIVE" && resolvedScore < 0);

    let escalationReason: string | null = null;
    let isHardLockEscalation = false; // true for order_confirm (billing reasons)

    if (needsHumanEscalation) {
      if (intent_type === "HUMAN_HANDOFF") {
        escalationReason = "manual_request";
      } else if (intent_type === "Support") {
        escalationReason = "complaint";
      } else if (detected_meta?.sentiment === "NEGATIVE") {
        escalationReason = "complaint";
      } else {
        escalationReason = "manual_request";
      }
    }

    // Check for order confirmation (reuse existing order-intent detection)
    // The AI signals order confirmation via tool_call or extracted_order data
    // Only consider it confirmed if items were actually extracted
    const isOrderConfirmed =
      tool_call ||
      (aiTurnResult?.extracted_order?.items?.length > 0);

    if (isOrderConfirmed) {
      escalationReason = "order_confirm";
      isHardLockEscalation = true; // Billing/order reasons = HARD-LOCK
    }

    // ============================================================

    await Promise.all([
      outboundDispatcherService.sendMessageFrame(frame.channel as any, frame.externalChatId, conversation.id, { bodyText: replyText, interactivePayload: tool_call ? JSON.parse(JSON.stringify(tool_call)) : null }, "BOT"),
      ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
        const clientMsg = await tx.message.create({
          data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
        });
        emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
        await tx.lead.update({ where: { id: lead.id }, data: { aiPriority: priority === "URGENT" ? "HIGH" : priority === "HIGH" ? "MEDIUM" : "LOW" } });

        // If escalation is needed, set mode + reason + assignment atomically
        // HARD-LOCK vs NOTIFY-ONLY classification:
        // - order_confirm (isHardLockEscalation=true): Sets mode=HUMAN, permanently silences AI
        // - manual_request/complaint/support (isHardLockEscalation=false): Only sets needsStaffReason, AI continues
        const convoUpdateData: any = { updatedAt: new Date() };
        if (escalationReason) {
          // Only set mode=HUMAN for hard-lock escalations (order/billing)
          if (isHardLockEscalation) {
            convoUpdateData.mode = "HUMAN";
          }
          convoUpdateData.needsStaffReason = escalationReason;

          // Try to find and assign the least-loaded staff member
          const staff = await findLeastLoadedStaff(companyId);
          if (staff) {
            convoUpdateData.claimedById = staff.id;
            convoUpdateData.claimedByName = `${staff.firstName} ${staff.lastName || ""}`.trim();
            convoUpdateData.claimedAt = new Date();
          }
        }

        await tx.conversation.update({
          where: { id: conversation.id },
          data: convoUpdateData,
        });
      })
    ]);

    // If escalation was triggered, emit events outside the lock
    if (escalationReason) {
      const escalatedConvo = await (prisma.conversation as any).findUnique({
        where: { id: conversation.id },
        include: {
          lead: { select: { id: true, name: true, contact: true, channel: true } },
          claimedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const eventPayload: any = {
        conversationId: escalatedConvo.id,
        companyId: escalatedConvo.companyId,
        leadId: escalatedConvo.leadId,
        lead: escalatedConvo.lead,
        mode: escalatedConvo.mode,
        status: escalatedConvo.status,
        needsStaffReason: escalatedConvo.needsStaffReason,
        assignedTo: escalatedConvo.claimedBy
          ? { id: escalatedConvo.claimedBy.id, name: escalatedConvo.claimedByName }
          : null,
        escalatedAt: new Date().toISOString(),
        reason: escalationReason,
      };

      if (escalatedConvo.claimedBy) {
        safeEmitConversationUpdate(escalatedConvo, "conversation.escalated", eventPayload);
        emitToAgent(escalatedConvo.claimedBy.id, "conversation.escalated", eventPayload);
      } else {
        // No staff available — broadcast to company admin room
        emitToCompanyAdmin(escalatedConvo.companyId, "conversation.escalated", eventPayload);
        emitToCompany(escalatedConvo.companyId, "conversation.escalated", {
          ...eventPayload,
          _note: "UNASSIGNED — No online staff available. Manual claim required.",
        });
      }

      console.log(
        `[Orchestrator] Conversation ${conversation.id} escalated to HUMAN` +
        `${escalatedConvo.claimedBy ? `, assigned to ${escalatedConvo.claimedBy.firstName}` : " (UNASSIGNED)"}` +
        `. Reason: ${escalationReason}`
      );
    }

    safeEmitConversationUpdate(conversation, "conversation_updated", { conversationId: conversation.id, lastContent: replyText, updatedAt: new Date().toISOString() });
    return aiTurnResult;
  });
}

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
      for (const job of jobs) {
        try { await processWebhookJob(job); }
        catch (jobErr) { console.error(`❌ [Orchestrator] Job execution failed for ID ${job.id}:`, jobErr); throw jobErr; }
      }
    });
    console.log('✅ [Orchestrator] Successfully registered subscription loop to pg-boss queue "webhook.process"');
  } catch (initErr) { console.error("❌ [Orchestrator] Failed registering subscriber loop:", initErr); }
}