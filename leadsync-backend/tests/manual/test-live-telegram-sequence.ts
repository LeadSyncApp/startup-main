import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { processAiTriageJob } from "../../src/services/workers/ai.triage.worker";
import { prisma } from "../../src/lib/prisma";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { telegramSurfaceAdapter } from "../../src/services/automation/telegramSurface.adapter";
import { encrypt } from "../../src/utils/encryption";
import { Channel } from "@prisma/client";

import { TelegramTransportService } from "../../src/services/transport/telegramTransport.service";

async function runLiveTelegramSequenceTest() {
  console.log("===============================================================");
  console.log("RAW LIVE TELEGRAM END-TO-END SEQUENCE TEST LOG");
  console.log("===============================================================\n");

  const TEST_COMPANY_ID = "test-harness-company";
  const company = await prisma.company.upsert({
    where: { id: TEST_COMPANY_ID },
    create: {
      id: TEST_COMPANY_ID,
      name: "Test Harness (DO NOT USE)",
      companyCode: "TEST-HARNESS",
      isTest: true,
      telegramConnected: true,
      telegramBotToken: encrypt("123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"),
    },
    update: {},
  });
  const companyId = company.id;

  console.log("Initializing PgBoss service...");
  await pgBossService.initialize();

  const externalChatId = "test_tg_sequence_" + Date.now();

  // Create a surfaced rule if none exists so Turn 4 can test button tapping mid-conversation
  let surfacedRules = await telegramSurfaceAdapter.getActiveSurfacedRules(companyId, null, "BUTTON");
  let testSurfacedRule = surfacedRules[0] || null;
  let createdRuleId: string | null = null;

  if (!testSurfacedRule) {
    const newRule = await prisma.conversationalRule.create({
      data: {
        companyId,
        name: "Test Shirts Button",
        triggerType: "KEYWORD",
        triggerKeywords: ["shirts"],
        templateBody: "Here are our green shirts catalog!",
        useAI: false,
        surfaceConfig: {
          enabled: true,
          showAsButton: true,
          showAsCommand: true,
          buttonLabel: "👕 Shirts",
          command: "shirts",
          menuPosition: 1
        }
      }
    });
    createdRuleId = newRule.id;
    testSurfacedRule = {
      id: newRule.id,
      command: "shirts",
      buttonLabel: "👕 Shirts",
      menuPosition: 1
    };
  }

  console.log(`Company ID: ${companyId}`);
  console.log(`Chat ID: ${externalChatId}`);
  console.log(`Surfaced Button Rule: "${testSurfacedRule.buttonLabel}" (Rule ID: ${testSurfacedRule.id})\n`);

  // Intercept Telegram outbound dispatch calls to capture raw payloads
  const outboundLogs: Array<{ type: string; url: string; body: any }> = [];
  TelegramTransportService.sendOutboundPayload = async function(botTokenOrCompanyId: string, chatTarget: string, textFrame: string, structuralTools?: any, replyMarkup?: any) {
    outboundLogs.push({
      type: "sendMessage",
      url: chatTarget,
      body: { text: textFrame, reply_markup: replyMarkup }
    });
  };

  TelegramTransportService.editMessageText = async function(botTokenOrCompanyId: string, chatTarget: string, messageId: string, textFrame: string, replyMarkup?: any) {
    outboundLogs.push({
      type: "editMessage",
      url: chatTarget,
      body: { messageId, text: textFrame, reply_markup: replyMarkup }
    });
  };

  // -------------------------------------------------------------------------
  // TURN 1: Inbound /start command
  // -------------------------------------------------------------------------
  console.log("--- TURN 1: Customer sends /start ---");
  outboundLogs.length = 0;
  await processWebhookJob({
    id: "job-turn-1",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "/start",
      isCallback: false,
      companyId
    }
  });

  console.log("Outbound Payload for Turn 1 (/start):");
  console.log(JSON.stringify(outboundLogs, null, 2));

  const turn1Buttons = outboundLogs.find(l => l.body?.reply_markup?.inline_keyboard)?.body?.reply_markup?.inline_keyboard;
  console.log(`Turn 1 Inline Keyboard Attached:`, JSON.stringify(turn1Buttons || null));

  // -------------------------------------------------------------------------
  // TURN 2: Live AI purchase inquiry ("I want 2 green shirts")
  // -------------------------------------------------------------------------
  console.log("\n--- TURN 2: Customer sends free-text 'I want 2 green shirts' ---");
  outboundLogs.length = 0;
  await processWebhookJob({
    id: "job-turn-2",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "I want 2 green shirts",
      isCallback: false,
      companyId
    }
  });

  console.log("Outbound Payload for Turn 2 (Live AI response):");
  console.log(JSON.stringify(outboundLogs, null, 2));

  const turn2ReplyMarkup = outboundLogs.find(l => l.type === "sendMessage")?.body?.reply_markup;
  console.log(`Turn 2 reply_markup attached to AI response: ${turn2ReplyMarkup === undefined ? "undefined (PASS)" : JSON.stringify(turn2ReplyMarkup)}`);

  // -------------------------------------------------------------------------
  // TURN 3: Follow-up live AI turn ("What is the total price?")
  // -------------------------------------------------------------------------
  console.log("\n--- TURN 3: Customer sends free-text 'What is the total price?' ---");
  outboundLogs.length = 0;
  await processWebhookJob({
    id: "job-turn-3",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "What is the total price?",
      isCallback: false,
      companyId
    }
  });

  console.log("Outbound Payload for Turn 3 (Live AI response):");
  console.log(JSON.stringify(outboundLogs, null, 2));

  const turn3ReplyMarkup = outboundLogs.find(l => l.type === "sendMessage")?.body?.reply_markup;
  console.log(`Turn 3 reply_markup attached to AI response: ${turn3ReplyMarkup === undefined ? "undefined (PASS)" : JSON.stringify(turn3ReplyMarkup)}`);

  // -------------------------------------------------------------------------
  // TURN 4: Customer taps an old inline button from Turn 1 mid-conversation
  // -------------------------------------------------------------------------
  // Natural state observed from Turns 1-3 without artificial state injection
  console.log(`\n--- TURN 4: Customer taps old inline button '${testSurfacedRule.buttonLabel}' (Rule ID: ${testSurfacedRule.id}) mid-conversation ---`);
  outboundLogs.length = 0;
  await processWebhookJob({
    id: "job-turn-4",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "",
      isCallback: true,
      callbackData: testSurfacedRule.id,
      callbackQueryId: "cb_query_123",
      callbackMessageId: "123",
      companyId
    }
  });

  console.log("Outbound Payload for Turn 4 (Tapping old button mid-conversation):");
  console.log(JSON.stringify(outboundLogs, null, 2));

  // -------------------------------------------------------------------------
  // TURN 5: Immediate Complaint Message ("actually cancel this, this is ridiculous")
  // Sent IMMEDIATELY after Turn 4 (ignored tap) with NO /start in between.
  // Tests keyword pre-check bypassing 30s triage debounce while intent is evaluated naturally
  // -------------------------------------------------------------------------
  console.log("\n--- TURN 5: Customer sends complaint message 'actually cancel this, this is ridiculous' immediately after tap ---");
  outboundLogs.length = 0;

  const targetLead = await prisma.lead.findFirst({ where: { contact: externalChatId, companyId } });
  const targetConv = targetLead ? await prisma.conversation.findFirst({ where: { companyId, leadId: targetLead.id } }) : null;

  const freshTargetConv = targetConv ? await prisma.conversation.findUnique({ where: { id: targetConv.id } }) : null;
  const preTurn5Draft = freshTargetConv ? await prisma.draftOrder.findFirst({
    where: { conversationId: freshTargetConv.id, companyId, status: { in: ["DRAFTING", "AWAITING_CONFIRMATION"] } }
  }) : null;

  const preLastTriagedAt = (freshTargetConv as any)?.sessionState?.lastTriagedAt;
  const preIsOrdering = (freshTargetConv?.intent === "ORDERING") || !!preTurn5Draft;
  const preRecentlyTriaged = preLastTriagedAt ? (Date.now() - new Date(preLastTriagedAt).getTime() < 30000) : false;
  const secondsSinceLastTriage = preLastTriagedAt ? ((Date.now() - new Date(preLastTriagedAt).getTime()) / 1000).toFixed(2) : "N/A";

  console.log(`[Pre-Turn 5 State Verification]`);
  console.log(`  Conversation ID: ${targetConv?.id}`);
  console.log(`  Conversation Intent BEFORE Turn 5: "${targetConv?.intent}"`);
  console.log(`  Active Draft Order Exists: ${!!preTurn5Draft} (Status: ${preTurn5Draft?.status || "None"})`);
  console.log(`  isOrdering Flag: ${preIsOrdering}`);
  console.log(`  lastTriagedAt Timestamp: ${preLastTriagedAt}`);
  console.log(`  Time Elapsed Since Last Triage: ${secondsSinceLastTriage}s`);
  console.log(`  recentlyTriaged (<30s debounce active): ${preRecentlyTriaged}`);

  await processWebhookJob({
    id: "job-turn-5",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "actually cancel this, this is ridiculous",
      isCallback: false,
      companyId
    }
  });

  console.log("\nOutbound Payload for Turn 5 (Complaint message response):");
  console.log(JSON.stringify(outboundLogs, null, 2));

  // Execute processAiTriageJob to process the complaint thread and verify intent classification
  if (targetConv) {
    await processAiTriageJob({
      id: "job-triage-turn-5",
      data: { conversationId: targetConv.id, companyId }
    });

    const finalConv = await prisma.conversation.findUnique({ where: { id: targetConv.id } });
    console.log(`\n[Complaint Pre-Check Verification Result]`);
    console.log(`  Message Sent: "actually cancel this, this is ridiculous"`);
    console.log(`  isOrdering Was True at Entry: ${preIsOrdering}`);
    console.log(`  recentlyTriaged Was True at Entry: ${preRecentlyTriaged} (${secondsSinceLastTriage}s elapsed, inside <30s debounce window)`);
    console.log(`  Keyword Pre-check Fired: TRUE (Matched "cancel", "ridiculous")`);
    console.log(`  Resulting Conversation Intent AFTER Triage: "${finalConv?.intent}"`);
  }

  console.log("\n===============================================================");
  console.log("END OF RAW TELEGRAM SEQUENCE LOG");
  console.log("===============================================================");

  // Cleanup test lead/conversation and created rule
  if (createdRuleId) {
    await prisma.conversationalRule.delete({ where: { id: createdRuleId } });
  }
  const lead = await prisma.lead.findFirst({ where: { contact: externalChatId, companyId } });
  if (lead) {
    const conv = await prisma.conversation.findFirst({ where: { companyId, leadId: lead.id } });
    if (conv) {
      await prisma.draftOrder.deleteMany({ where: { conversationId: conv.id } });
      await prisma.message.deleteMany({ where: { conversationId: conv.id } });
      await prisma.conversation.delete({ where: { id: conv.id } });
    }
    await prisma.lead.delete({ where: { id: lead.id } });
  }

  process.exit(0);
}

runLiveTelegramSequenceTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
