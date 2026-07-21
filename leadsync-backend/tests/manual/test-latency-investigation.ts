/**
 * Latency investigation: instruments every step of the message-processing pipeline.
 *
 * This test creates a company/lead/conversation, then runs the exact same
 * processing steps as the production orchestrator worker — measuring each one.
 *
 * Steps measured (in order):
 *  1. Parallel DB reads (company + lead lookup)
 *  2. Concurrency lock + lead/conversation resolution
 *  3. Active rules DB read
 *  4. Rule matching (evaluateMessage → RAG + keyword scoring)
 *  5. Language detection
 *  6. Conversation history fetch (DB read)
 *  7. Intent classification (Groq llama-3.1-8b-instant + 2s timeout)
 *  8. Conditional RAG retrieval (product or policy chunks)
 *  9. Recent 10 messages fetch (DB read)
 * 10. Active draft order fetch (DB read)
 * 11. AI call (generateShopReply — Groq llama-3.3-70b-versatile)
 * 12. DB writes (message create + lead update + conversation update)
 * 13. Outbound dispatch (sendMessageFrame to Telegram)
 *
 * NO FIXES — instrumentation only.
 */
import { prisma, getTenantPrismaContext } from "../../src/lib/prisma";
import { ConcurrencyLock } from "../../src/utils/concurrencyLock";
import { Channel, MessageSender, ConversationStatus } from "@prisma/client";
import { generateShopReply, classifyMessageIntentWithTimeout } from "../../src/services/ai/ai.service";
import { retrieveProductChunks, retrieveSimilarChunks } from "../../src/services/knowledge/knowledgeRetriever.service";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { detectLanguage } from "../../src/services/ai/languageDetection.service";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { getActiveDraftOrder } from "../../src/services/draftOrder/draftOrder.service";
import { outboundDispatcherService } from "../../src/services/outbound.dispatcher";
import { withTestCompany } from "./testCompanyFactory";

const TS = () => Date.now();

async function runPipeline(label: string, messageText: string, companyId: string, leadId: string, conversationId: string) {
  const timings: { step: string; ms: number }[] = [];
  let t0 = TS();

  // ===== STEP 1: Parallel DB reads (company + lead) =====
  const t1a = TS();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { conversations: { where: { companyId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5 } },
  });
  timings.push({ step: "1. Parallel DB reads (company + lead)", ms: TS() - t1a });

  // ===== STEP 2: Concurrency lock + conversation resolution =====
  const t2a = TS();
  let conversation: any = null;
  const localLead = lead;
  const localActiveConv = (localLead?.conversations || []).find(
    (c: any) => c.lifecycleStatus === "active" || !c.lifecycleStatus
  );
  if (localActiveConv) {
    conversation = localActiveConv;
  } else {
    // Simulate conversation create (exactly as orchestrator does)
    conversation = await getTenantPrismaContext(companyId).conversation.create({
      data: { channel: "TELEGRAM" as any, companyId, status: ConversationStatus.OPEN, leadId, isReturningCustomer: false },
      include: { lead: true },
    });
  }
  timings.push({ step: "2. Conversation resolution", ms: TS() - t2a });

  // ===== STEP 3: Active rules DB read =====
  const t3a = TS();
  const activeRules = await prisma.conversationalRule.findMany({
    where: { companyId, isEnabled: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
    select: { id: true, name: true, triggerKeywords: true, triggerType: true, templateBody: true, useAI: true },
  });
  timings.push({ step: "3. Active rules DB read", ms: TS() - t3a });

  // ===== STEP 4: Rule matching (RAG + keyword scoring) =====
  const t4a = TS();
  let ruleMatchResult: any = null;
  if (activeRules.length > 0) {
    try {
      ruleMatchResult = await conversationalAutoReplyService.evaluateMessage({
        companyId, conversationId: conversation.id, leadId, messageText,
        customerName: "Test User", channel: "TELEGRAM", contact: lead!.contact,
      });
    } catch (e: any) {
      console.log(`       Rule matching error (non-fatal, expected if no match): ${e.message.substring(0, 80)}`);
    }
  }
  timings.push({ step: "4. Rule matching (RAG + keyword scoring)", ms: TS() - t4a });

  // ===== STEP 5: Language detection =====
  const t5a = TS();
  const sarvamKey = process.env.SARVAM_API_KEY;
  const detectedLang = sarvamKey ? (await detectLanguage(messageText, sarvamKey)).language : "en";
  timings.push({ step: "5. Language detection", ms: TS() - t5a });

  // ===== STEP 6: Fetch thread history =====
  const t6a = TS();
  const recentMsgs = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  const threadHistory = recentMsgs.reverse().map((m: any) => `${m.sender}: ${m.content}`).join("\n");
  timings.push({ step: "6. Thread history fetch", ms: TS() - t6a });

  // ===== STEP 7: Intent classification (Groq 8b, 2s timeout) =====
  const t7a = TS();
  let classification: any = null;
  try {
    classification = await classifyMessageIntentWithTimeout(messageText, threadHistory, 2000);
  } catch (e: any) {
    console.log(`       Classification error: ${e.message.substring(0, 80)}`);
  }
  timings.push({ step: "7. Intent classification (Groq 8b)", ms: TS() - t7a });

  // ===== STEP 8: Conditional RAG retrieval =====
  const t8a = TS();
  let menuSnapshot: any = null;
  if (classification) {
    if (classification.intent === "ProductInquiry" && classification.inquiryType === "specific") {
      const products = await retrieveProductChunks(companyId, messageText, 5);
      menuSnapshot = products.length > 0
        ? "Available products:\n" + products.map((p: any) => `- ${p.content}`).join("\n")
        : "No matching products found.";
    } else {
      menuSnapshot = ""; // Skip for non-product intents
    }
  }
  timings.push({ step: "8. Conditional RAG retrieval", ms: TS() - t8a });

  // ===== STEP 9: Recent 10 messages fetch =====
  const t9a = TS();
  const convHistory = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" }, take: 10,
  });
  timings.push({ step: "9. Recent 10 messages fetch", ms: TS() - t9a });

  // ===== STEP 10: Active draft order fetch =====
  const t10a = TS();
  let draftOrder: any = null;
  try {
    draftOrder = await getActiveDraftOrder(companyId, conversation.id);
  } catch (e: any) {
    // non-fatal
  }
  timings.push({ step: "10. Active draft order fetch", ms: TS() - t10a });

  // ===== STEP 11: AI call (generateShopReply — Groq 70b) =====
  const t11a = TS();
  let aiResult: any = null;
  let aiError: string | null = null;
  try {
    aiResult = await generateShopReply({
      tenant_id: companyId,
      user_message: messageText,
      session_state: {},
      menu_snapshot: menuSnapshot || "No menu",
      detected_language: detectedLang,
      activeRules: "No custom rules active.",
      conversation_history: convHistory.reverse().map((m: any) => ({ sender: m.sender, content: m.content })),
      active_draft_order: draftOrder,
    });
  } catch (e: any) {
    aiError = e.message;
  }
  timings.push({ step: "11. AI call (Groq 70b — generateShopReply)", ms: TS() - t11a });

  // ===== STEP 12: DB writes (message + lead + conversation) =====
  const t12a = TS();
  await ConcurrencyLock.withConversationLock(conversation.id, async (tx) => {
    await tx.message.create({
      data: { companyId, conversationId: conversation.id, content: messageText, sender: MessageSender.CLIENT },
    });
    await tx.lead.update({ where: { id: leadId }, data: { lastActiveAt: new Date() } });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  });
  timings.push({ step: "12. DB writes (message + lead + conversation)", ms: TS() - t12a });

  // ===== STEP 13: Outbound dispatch (sendMessageFrame) =====
  const t13a = TS();
  let dispatchError: string | null = null;
  // Intercept Telegram call so we don't actually send to Telegram
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
  };
  try {
    await outboundDispatcherService.sendMessageFrame(
      "TELEGRAM" as any,
      lead!.contact,
      conversation.id,
      { bodyText: aiResult?.replyText || "Test reply", interactivePayload: null, replyMarkup: undefined },
      "BOT"
    );
  } catch (e: any) {
    dispatchError = e.message;
  } finally {
    global.fetch = originalFetch;
  }
  timings.push({ step: "13. Outbound dispatch (sendMessageFrame)", ms: TS() - t13a });

  return { timings, aiResult, aiError, ruleMatchResult };
}

// --------------------------------------------------------------------------
// Run 3 test messages
// --------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(90));
  console.log("LATENCY INVESTIGATION — Pipeline step-by-step timing");
  console.log("=".repeat(90));
  console.log("");

  const testMessages = [
    "Do you have chicken biryani?",
    "What is your delivery time?",
    "I want to order a pizza",
  ];

  let runNumber = 0;
  for (const msg of testMessages) {
    runNumber++;
    console.log("-".repeat(90));
    console.log(`RUN ${runNumber}: "${msg}"`);
    console.log("-".repeat(90));

    await withTestCompany(`LATENCY-R${runNumber}`, async (testCompany) => {
      const companyId = testCompany.id;
      const contextStore = await resolveTenantContext(companyId);

      // Create a lead and conversation
      const lead = await prisma.lead.create({
        data: { companyId, contact: `latency-test-${runNumber}`, channel: Channel.TELEGRAM, name: "Latency Test User" },
      });
      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      // Ensure conversation is in BOT mode
      await prisma.conversation.update({ where: { id: conv.id }, data: { mode: "BOT" } });

      // Create a simple rule + inventory product for realistic context
      const rule = await prisma.conversationalRule.create({
        data: {
          companyId, name: "Biryani Offer",
          isEnabled: true, triggerKeywords: ["biryani", "biriyani", "briyani"],
          triggerType: "TEXT_MATCH",
          templateBody: "We have chicken biryani at Rs.199 and mutton biryani at Rs.299!",
        },
      });
      await embedRuleToKnowledgeChunk({
        id: rule.id, companyId, name: rule.name,
        triggerKeywords: rule.triggerKeywords as string[],
        templateBody: rule.templateBody,
      });

      await prisma.inventoryProduct.create({
        data: { companyId, name: "Chicken Biryani", basePrice: 199, isActive: true },
      });

      conversationalAutoReplyService.invalidateCache(companyId);

      await tenantContextStorage.run(contextStore, async () => {
        const result = await runPipeline(
          `Run ${runNumber}`,
          msg,
          companyId,
          lead.id,
          conv.id
        );

        // Print timeline
        let cumulative = 0;
        console.log("");
        console.log("  TIMELINE:");
        for (const t of result.timings) {
          cumulative += t.ms;
          const pct = ((t.ms / cumulative) * 100).toFixed(1);
          console.log(`  t=+${cumulative}ms  ${t.step}  (${t.ms}ms, ${pct}% so far)`);
        }

        // Print AI result summary
        console.log("");
        console.log("  AI RESULT:");
        if (result.aiResult) {
          console.log(`    Reply:   "${(result.aiResult.replyText || "").substring(0, 100)}"`);
          console.log(`    Intent:  ${result.aiResult.intent_type || "N/A"}`);
          console.log(`    Lang:    ${result.aiResult.detected_meta?.language || "N/A"}`);
        } else if (result.aiError) {
          console.log(`    ERROR:   ${result.aiError.substring(0, 150)}`);
        }

        // Print rule match summary
        console.log("");
        console.log("  RULE MATCH:");
        if (result.ruleMatchResult?.matched) {
          console.log(`    Matched: ${result.ruleMatchResult.ruleName}`);
        } else {
          console.log(`    No rule matched (fell through to AI)`);
        }
        console.log("");
      });
    });
  }

  console.log("=".repeat(90));
  console.log("DONE — 3 runs complete");
  console.log("=".repeat(90));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
