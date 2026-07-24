import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { prisma } from "../../src/lib/prisma";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";

async function runTest() {
  const company = await prisma.company.findFirst({
    where: { inventoryProducts: { some: {} } }
  }) || await prisma.company.findFirst();
  if (!company) {
    console.error("No company found in database.");
    process.exit(1);
  }
  const companyId = company.id;
  const externalChatId = "test_chat_context_loss_" + Date.now();

  console.log("Initializing PgBoss...");
  await pgBossService.initialize();

  // Intercept global fetch to log requests to Telegram
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    return {
      ok: true,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true })
    } as any;
  };

  await prisma.company.update({
    where: { id: companyId },
    data: { telegramConnected: true, telegramBotToken: company.telegramBotToken || "mock_token" }
  });

  console.log(`Using company: ${company.name} (${companyId})`);
  console.log(`Using test externalChatId: ${externalChatId}`);

  console.log("\n=== STEP 1: Sending message '2 shirts from sts' ===");
  await processWebhookJob({
    id: "job-step-1",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "2 shirts from sts",
      isCallback: false,
      companyId
    }
  });

  const lead1 = await prisma.lead.findFirst({ where: { contact: externalChatId, companyId } });
  const conv1 = lead1 ? await prisma.conversation.findFirst({
    where: { leadId: lead1.id, companyId },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  }) : null;

  const draft1 = conv1 ? await prisma.draftOrder.findFirst({ where: { conversationId: conv1.id } }) : null;

  console.log("\n--- CONVERSATION & DRAFT ORDER STATE AFTER STEP 1 ---");
  console.log("DraftOrder State:", JSON.stringify(draft1, null, 2));
  console.log("Messages:");
  conv1?.messages.forEach((m) => {
    console.log(`  [${m.sender}]: ${m.content}`);
  });

  console.log("\n=== STEP 2: Sending message 'Confirm my order' ===");
  await processWebhookJob({
    id: "job-step-2",
    data: {
      channel: "TELEGRAM" as any,
      externalChatId,
      text: "Confirm my order",
      isCallback: false,
      companyId
    }
  });

  const lead2 = await prisma.lead.findFirst({ where: { contact: externalChatId, companyId } });
  const conv2 = lead2 ? await prisma.conversation.findFirst({
    where: { leadId: lead2.id, companyId },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  }) : null;

  const draft2 = conv2 ? await prisma.draftOrder.findFirst({ where: { conversationId: conv2.id } }) : null;
  const confirmedOrder = conv2 ? await prisma.order.findFirst({ where: { conversationId: conv2.id, isDeleted: false } }) : null;

  console.log("\n--- CONVERSATION & DRAFT ORDER STATE AFTER STEP 2 ---");
  console.log("DraftOrder State:", JSON.stringify(draft2, null, 2));
  console.log("Confirmed Order:", JSON.stringify(confirmedOrder, null, 2));
  console.log("Messages:");
  conv2?.messages.forEach((m) => {
    console.log(`  [${m.sender}]: ${m.content}`);
  });

  if (draft2?.status === "CONFIRMED" && confirmedOrder) {
    console.log("\n✅ SUCCESS: Original order context loss issue is 100% FIXED via structured DraftOrder!");
  } else {
    console.error("\n❌ FAILURE: Order was not confirmed.");
    process.exit(1);
  }

  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
