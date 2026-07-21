import PgBoss from "pg-boss";
import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { ConcurrencyLock } from "../../utils/concurrencyLock";
import { outboundDispatcherService } from "../outbound.dispatcher";
import { Channel, MessageSender, ConversationStatus } from "@prisma/client";
import { generateShopReply, classifyMessageIntentWithTimeout, PreFlightClassification } from "../ai/ai.service";
import { retrieveProductChunks, retrieveSimilarChunks, RetrievedChunk } from "../knowledge/knowledgeRetriever.service";
import { StandardMessageFrame } from "../../interfaces/messaging.interface";
import { tenantContextStorage, TenantContext } from "../context/tenantContext.provider";
import { safeEmitConversationUpdate, emitToConversation, getIO } from "../../lib/socket";
import { conversationalAutoReplyService } from "../automation/conversationalAutoReply.service";
import { telegramSurfaceAdapter } from "../automation/telegramSurface.adapter";
import { detectLanguage } from "../ai/languageDetection.service";
import { ChannelType } from "../../interfaces/outbound.interface";
import { reapGhostsForCompany } from "../infrastructure/ghostReaper.service";
import { newOrderArrivalService } from "../workflow/newOrderArrival.service";
import { getActiveDraftOrder, syncDraftOrderFromAi, confirmActiveDraftOrder, syncLeadPendingOrderState } from "../draftOrder/draftOrder.service";

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

    // Note: Platform-native command handling was removed — no StandardMessageFrame
    // construction site ever populated isPlatformCommand/rawPayload.

    const processingText = frame.isCallback ? (frame.callbackData || "") : frame.text;

    // 🧠 Debounced Triage Trigger: Enqueue ai-triage-job based on time (30s window).
    // Bypasses the 30s debounce instantly if customer expresses cancellation/complaint keywords.
    const lastTriagedAt = (conversation as any).sessionState?.lastTriagedAt;
    const isRecentlyTriaged = lastTriagedAt && (Date.now() - new Date(lastTriagedAt).getTime() < 30000);
    const complaintKeywords = ["cancel", "refund", "complaint", "angry", "wrong", "terrible", "bad", "stop", "ridiculous", "issue", "problem"];
    const isComplaintSignal = complaintKeywords.some(kw => (processingText || "").toLowerCase().includes(kw));

    if (!isRecentlyTriaged || isComplaintSignal) {
      console.log(`[Orchestrator] 🧠 Triggering ai-triage-job (recentlyTriaged=${!!isRecentlyTriaged}, isComplaintSignal=${isComplaintSignal})`);
      pgBossService.getBoss().send(
        "ai-triage-job",
        { conversationId: conversation.id, companyId: companyContext.id },
        isComplaintSignal
          ? { startAfter: 1 }
          : { startAfter: 2, singletonKey: `triage-${conversation.id}`, singletonSeconds: 30 }
      );
    }

    // ✅ AI gate: only auto-reply when the conversation is in BOT mode.
    // In HUMAN mode (staff takeover) we still persist the inbound client message
    // and emit realtime updates, but we do NOT run rule matching or LLM reply.
    if ((conversation as any).mode !== "BOT") {
      await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
        const clientMsg = await tx.message.create({
          data: {
            companyId,
            conversationId: conversation.id,
            content: text,
            sender: MessageSender.CLIENT,
          },
        });
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

          await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
            const clientMsg = await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: "/start", sender: MessageSender.CLIENT }
            });
            emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
            await tx.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } });
            await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
          });

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
        await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
          const clientMsg = await tx.message.create({
            data: { companyId, conversationId: conversation.id, content: processingText || "", sender: MessageSender.CLIENT }
          });
          emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
          await tx.lead.update({ where: { id: lead.id }, data: { lastActiveAt: new Date() } });
          await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
        });

        safeEmitConversationUpdate(conversation, "conversation_updated", {
          conversationId: conversation.id,
          lastContent: "[Rule triggered by tap/command]",
          updatedAt: new Date().toISOString(),
        });

        return { surfacePath, ruleId: resolvedRuleId };
      }
    }

    // Load active rules to use for BOTH rule matching AND AI context
    const activeConversationalRules = await prisma.conversationalRule.findMany({
      where: {
        companyId,
        isEnabled: true,
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
          {
            // Cascading disable: skip rules whose flow (RuleGroup) is disabled.
            OR: [
              { groupId: null },
              { group: { isEnabled: true } },
            ],
          },
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
        sourcePrompt: true,
      },
    });

    // Build a text summary of active rules to feed to the main AI as context
    const rulesAsContext = activeConversationalRules.length > 0
      ? activeConversationalRules.map(r => {
          if (r.useAI) {
            return `[Rule Instruction: ${r.name}] Keywords: ${(r.triggerKeywords as string[]).join(", ")} → Behavior: ${r.sourcePrompt || r.name} (AI should draft response dynamically using shop context and live inventory)`;
          } else {
            return `[Rule Canned Reply: ${r.name}] Keywords: ${(r.triggerKeywords as string[]).join(", ")} → Response: ${r.templateBody || ""}`;
          }
        }).join("\n")
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
          channel: (channel === Channel.TELEGRAM ? "TELEGRAM" : channel === Channel.WHATSAPP ? "WHATSAPP" : "INSTAGRAM") as ChannelType,
          contact: lead.contact,
        });

        if (ruleResult.matched && ruleResult.responseAlreadySent) {
          console.log(`[Orchestrator] ✅ Rule matched: "${ruleResult.ruleName}" — AI reply skipped, rule response sent.`);
          ruleMatched = true;

          // Still log the customer message and update conversation state
          // But DON'T send a second AI reply — the rule already handled it
          await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
            const clientMsg = await tx.message.create({
              data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
            });
            emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
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

    // Retrieve product chunks or policy chunks based on pre-flight intent classification
    let menuSnapshotForAi = config?.botStructuredMenu;
    const totalPipelineStart = Date.now();
    let classificationTime = 0;

    // Single fetch of 10 messages, shared by classification context (needs 6) and conversation history (needs all 10)
    const recentMessagesDesc = await tenantPrisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (processingText) {
      // 1. Build thread history for classification context (most recent 6 messages, chronological)
      let threadHistoryStr = "";
      try {
        threadHistoryStr = recentMessagesDesc
          .slice(0, 6)
          .reverse()
          .map((m: any) => `${m.sender}: ${m.content}`)
          .join("\n");
      } catch (err: any) {
        console.error("[Orchestrator] Error building thread history for classification:", err.message);
      }

      // 2. Run pre-flight classifier
      const startClassificationTime = Date.now();
      const classification = await classifyMessageIntentWithTimeout(processingText, threadHistoryStr, 2000);
      classificationTime = Date.now() - startClassificationTime;

      console.log(`⚙️ [Orchestrator Intent] "${processingText}" → Classified as: ${classification.intent} (${classification.inquiryType || "N/A"})`);

      // 3. Conditional context injection based on classified intent
      if (classification.intent === "ProductInquiry") {
        if (classification.inquiryType === "specific") {
          // Specific Query -> narrow RAG semantic match
          const matchingProducts = await retrieveProductChunks(companyId, processingText, 5);
          console.log(`[Orchestrator RAG] Narrow retrieval match size: ${matchingProducts.length}`);
          if (matchingProducts.length > 0) {
            menuSnapshotForAi = "Available products:\n" + matchingProducts.map((p) => `- ${p.content}`).join("\n");
          } else {
            menuSnapshotForAi = "No matching products found.";
          }
        } else {
          // General Query -> broader DB lookup showing multiple relevant active products
          try {
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
          } catch (dbErr: any) {
            console.error("[Orchestrator] Fallback broad inventory query failed:", dbErr.message);
            menuSnapshotForAi = config?.botStructuredMenu || "No products currently available.";
          }
        }
      } else if (classification.intent === "Support/Policy") {
        // Support/Policy Query -> policy-only lookup
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
        // Greeting/SmallTalk, OrderRelated, Other -> zero product catalog injection
        menuSnapshotForAi = "";
        console.log(`[Orchestrator RAG] Skipping product catalog lookup for intent "${classification.intent}"`);
      }
    }



    // Conversation memory window from shared 10-message fetch (chronological order)
    const conversationHistory = [...recentMessagesDesc].reverse().map((m: any) => ({
      sender: m.sender,
      content: m.content
    }));

    // 🛒 Fetch current active draft order for context
    const activeDraftOrder = await getActiveDraftOrder(companyId, conversation.id);

    const aiTurnResult = await generateShopReply({
      tenant_id: companyId,
      user_message: processingText,
      session_state: (conversation as any)?.sessionState || {},
      menu_snapshot: menuSnapshotForAi,
      detected_language: detectedLanguage,
      activeRules: rulesAsContext,
      conversation_history: conversationHistory,
      active_draft_order: activeDraftOrder,
    });

    const totalPipelineDuration = Date.now() - totalPipelineStart;
    console.log(`⏱️ [Pipeline Latency] Intent classifier: ${classificationTime}ms, Total: ${totalPipelineDuration}ms (including main generation)`);

    const sessionStateObj: any = (conversation as any)?.sessionState || {};
    const cartItemsCount = sessionStateObj.cart?.items?.length || 0;
    const orderTotal = sessionStateObj.cart?.items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
    const priorityInput = { extracted_order_total: (aiTurnResult?.extracted_order?.total_amount ?? orderTotal), extracted_items_count: (aiTurnResult?.extracted_order?.items?.length ?? cartItemsCount) };
    const priority = evaluateTenantPriorityRules(priorityInput, activeContext.priorityRules);
    const { replyText, detected_meta, tool_call, thread_summary, suggested_human_response, intent_type: rawIntentType } = aiTurnResult;
    const intent_type = rawIntentType as string;
    const sentimentScoreMap: Record<string, number> = { "POSITIVE": 1, "NEUTRAL": 0, "NEGATIVE": -1 };
    const resolvedScore = sentimentScoreMap[detected_meta?.sentiment] ?? 0;

    // 🛒 Sync / Update DraftOrder from AI extracted order output
    let syncedDraft: any = null;
    if (aiTurnResult?.extracted_order && Array.isArray(aiTurnResult.extracted_order.items) && aiTurnResult.extracted_order.items.length > 0) {
      syncedDraft = await syncDraftOrderFromAi({
        companyId,
        conversationId: conversation.id,
        leadId: lead.id,
        extractedOrder: aiTurnResult.extracted_order,
        rawUserMessage: processingText
      });
      console.log(`📝 [Orchestrator] Synced DraftOrder ${syncedDraft?.id} status=${syncedDraft?.status} totalAmount=₹${syncedDraft?.totalAmount}`);
    }

    // 🛒 [INTERCEPT] Confirm active DraftOrder when intent is OrderConfirmed OR customer uses explicit confirmation phrase
    const confirmationPhrases = [
      "confirm", "confirm order", "confirm my order", "yes confirm",
      "book it", "confirm it", "yes book it", "confirm order please"
    ];
    const isExplicitConfirmation = confirmationPhrases.includes(processingText.trim().toLowerCase());
    const isOrderConfirmed = intent_type === "OrderConfirmed" || isExplicitConfirmation;

    if (isOrderConfirmed) {
      console.log(`🛒 [Orchestrator] Intercepted OrderConfirmed intent/phrase. Confirming active DraftOrder...`);
      const confirmResult = await confirmActiveDraftOrder(companyId, conversation.id);
      if (confirmResult.order) {
        console.log(`✅ [Orchestrator] Successfully confirmed Order ${confirmResult.order.id} via DraftOrder status lifecycle.`);
      } else {
        console.log(`🛡️ [Orchestrator] DraftOrder confirmation skipped (reason: ${confirmResult.reason}). No duplicate order created.`);
      }
    }

    // 🔄 Sync lead pending order state and conversation intent immediately
    await syncLeadPendingOrderState(companyId, lead.id, conversation.id);

    // 🛡️ PRE-SEND GUARD: re-fetch conversation.mode fresh from the database.
    // The mode gate at the top of the BOT path (≈line 219) used a value loaded
    // earlier in the pipeline (and the mid-pipeline reload selects only id/
    // companyId/claimedById, NOT mode). If staff toggled this conversation to
    // HUMAN between that gate and now, we must NOT dispatch the already-
    // drafted AI reply to the customer. Abort silently (log only, no throw)
    // and persist no message row for the aborted AI reply.
    // CRITICAL: The customer message persistence and conversation updates below
    // ALWAYS run — the guard only conditionally skips the outbound sendMessageFrame.
    const preSendConv = await (prisma.conversation as any).findUnique({
      where: { id: conversation.id },
      select: { mode: true },
    });
    const modeIsBot = !!preSendConv && (preSendConv as any).mode === "BOT";

    // Customer message persistence and conversation updates ALWAYS run
    await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
      const clientMsg = await tx.message.create({
        data: { companyId, conversationId: conversation.id, content: text, sender: MessageSender.CLIENT }
      });
      emitToConversation(conversation.id, "new_message", { ...clientMsg, conversationId: conversation.id });
      await tx.lead.update({ where: { id: lead.id }, data: { aiPriority: priority === "URGENT" ? "HIGH" : priority === "HIGH" ? "MEDIUM" : "LOW" } });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
    });

    // Add the outbound dispatcher ONLY if mode is still BOT
    if (modeIsBot) {
      // NOTE: Root-level surfaced buttons MUST NOT attach to ordinary AI-generated
      // replies during live free-text conversation. They only attach to explicit menu navigation
      // (e.g. /start or back_root or menu button taps).
      let replyMarkup: any = undefined;
      await outboundDispatcherService.sendMessageFrame(
        frame.channel as any,
        frame.externalChatId,
        conversation.id,
        { bodyText: replyText, interactivePayload: tool_call ? JSON.parse(JSON.stringify(tool_call)) : null, replyMarkup },
        "BOT"
      );
    } else {
      console.log(
        `🛡️ [Orchestrator] Conversation ${conversation.id} mode is "${(preSendConv as any)?.mode}" at send time — aborting AI reply dispatch (no message persisted).`
      );
    }

    safeEmitConversationUpdate(conversation, "conversation_updated", { conversationId: conversation.id, lastContent: replyText, updatedAt: new Date().toISOString() });
    return aiTurnResult;
  });
}

// Tracks job IDs processed in this process lifetime to prevent duplicate
// execution from pg-boss retries or crash-recovery replay.
const processedJobIds = new Set<string>();
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
      for (const job of jobs) {
        if (processedJobIds.has(job.id)) {
          console.log(`⏭️ [Orchestrator] Skipping already-processed job ${job.id}`);
          continue;
        }
        processedJobIds.add(job.id);
        try { await processWebhookJob(job); }
        catch (jobErr) { console.error(`❌ [Orchestrator] Job execution failed for ID ${job.id}:`, jobErr); throw jobErr; }
      }
    });
    console.log('✅ [Orchestrator] Successfully registered subscription loop to pg-boss queue "webhook.process"');
  } catch (initErr) { console.error("❌ [Orchestrator] Failed registering subscriber loop:", initErr); }
}