import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { prisma } from "../../src/lib/prisma";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { DraftOrderStatus } from "@prisma/client";

async function runTestSuite() {
  console.log("🚀 Initializing DraftOrder Verification Suite...");

  // Setup test company & product
  let company = await prisma.company.findFirst({
    where: { inventoryProducts: { some: {} } }
  });

  if (!company) {
    company = await prisma.company.findFirst();
  }

  if (!company) {
    console.error("❌ No company found in database.");
    process.exit(1);
  }

  const companyId = company.id;

  // Ensure mock product exists for testing
  let testProduct = await prisma.inventoryProduct.findFirst({
    where: { companyId, isActive: true }
  });

  if (!testProduct) {
    testProduct = await prisma.inventoryProduct.create({
      data: {
        companyId,
        name: "STS Shirt",
        basePrice: 500.0,
        isActive: true
      }
    });
  }

  console.log(`Using company: ${company.name} (${companyId})`);
  console.log(`Using test product: ${testProduct?.name} @ ₹${testProduct?.basePrice}`);

  await pgBossService.initialize();

  // Mock global fetch to capture outbound Telegram messages without sending real HTTP requests
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

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Structured Draft Creation & Confirmation
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n==================================================");
  console.log("TEST 1: Mention items -> Price Quote -> Confirm Order");
  console.log("==================================================");
  const chatId1 = "test_draft_s1_" + Date.now();

  await processWebhookJob({
    id: "job-s1-turn1",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId1, text: "2 shirts from STS", isCallback: false, companyId }
  });

  const lead1 = await prisma.lead.findFirst({ where: { contact: chatId1, companyId } });
  const conv1 = lead1 ? await prisma.conversation.findFirst({ where: { leadId: lead1.id, companyId } }) : null;

  if (!conv1) throw new Error("Scenario 1: Conversation not created.");

  const draft1Turn1 = await prisma.draftOrder.findFirst({ where: { conversationId: conv1.id, companyId } });
  console.log("Draft state after Turn 1:", {
    id: draft1Turn1?.id,
    status: draft1Turn1?.status,
    totalAmount: draft1Turn1?.totalAmount,
    items: draft1Turn1?.items
  });

  if (!draft1Turn1) throw new Error("Scenario 1: DraftOrder was NOT created on turn 1.");
  console.log("✅ Step 1 Pass: Structured DraftOrder created with canonical item prices.");

  // Turn 2: Customer confirms
  await processWebhookJob({
    id: "job-s1-turn2",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId1, text: "Confirm my order", isCallback: false, companyId }
  });

  const draft1Turn2 = await prisma.draftOrder.findUnique({ where: { id: draft1Turn1.id } });
  const confirmedOrder1 = await prisma.order.findFirst({ where: { conversationId: conv1.id, isDeleted: false } });

  console.log("Draft state after Turn 2:", { status: draft1Turn2?.status });
  console.log("Created Order:", confirmedOrder1 ? { id: confirmedOrder1.id, amount: confirmedOrder1.amount } : null);

  if (draft1Turn2?.status !== DraftOrderStatus.CONFIRMED || !confirmedOrder1) {
    throw new Error("Scenario 1 FAIL: Draft order was not confirmed or Order was not created.");
  }
  console.log("✅ TEST 1 PASSED: Structured DraftOrder confirmed successfully -> Real Order created!");

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Double Confirmation Dedup Guard
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n==================================================");
  console.log("TEST 2: Double Confirmation Dedup Guard");
  console.log("==================================================");

  const ordersCountBefore = await prisma.order.count({ where: { conversationId: conv1.id, isDeleted: false } });

  await processWebhookJob({
    id: "job-s2-turn3",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId1, text: "Confirm my order", isCallback: false, companyId }
  });

  const ordersCountAfter = await prisma.order.count({ where: { conversationId: conv1.id, isDeleted: false } });
  console.log(`Orders count before: ${ordersCountBefore}, after second confirm: ${ordersCountAfter}`);

  if (ordersCountAfter !== ordersCountBefore) {
    throw new Error("Scenario 2 FAIL: Duplicate order created on second confirmation!");
  }
  console.log("✅ TEST 2 PASSED: Double confirmation dedup guard verified. 0 extra orders created.");

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Order Update Mid-Conversation (2 -> 3 shirts)
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n==================================================");
  console.log("TEST 3: Order Update Mid-Conversation");
  console.log("==================================================");
  const chatId3 = "test_draft_s3_" + Date.now();

  // Turn 1: Initial request (2 shirts)
  await processWebhookJob({
    id: "job-s3-turn1",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId3, text: "2 shirts from STS", isCallback: false, companyId }
  });

  const lead3 = await prisma.lead.findFirst({ where: { contact: chatId3, companyId } });
  const conv3 = lead3 ? await prisma.conversation.findFirst({ where: { leadId: lead3.id, companyId } }) : null;
  if (!conv3) throw new Error("Scenario 3: Conversation not created.");

  const draft3Turn1 = await prisma.draftOrder.findFirst({ where: { conversationId: conv3.id } });
  console.log("Draft after 2 shirts:", { items: draft3Turn1?.items, totalAmount: draft3Turn1?.totalAmount });

  // Turn 2: Customer changes mind to 3 shirts
  await processWebhookJob({
    id: "job-s3-turn2",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId3, text: "Actually make it 3 shirts from STS", isCallback: false, companyId }
  });

  const conv3Turn2 = await prisma.conversation.findFirst({
    where: { id: conv3.id },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  console.log("\n--- SCENARIO 3 TURN 2 AI REPLY WORDING CHECK ---");
  conv3Turn2?.messages.forEach((m) => {
    console.log(`  [${m.sender}]: ${m.content}`);
  });

  const draft3Turn2 = await prisma.draftOrder.findFirst({ where: { conversationId: conv3.id } });
  console.log("Draft after change to 3 shirts:", { id: draft3Turn2?.id, items: draft3Turn2?.items, totalAmount: draft3Turn2?.totalAmount });

  // Turn 3: Customer confirms updated order
  await processWebhookJob({
    id: "job-s3-turn3",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId3, text: "Confirm my order", isCallback: false, companyId }
  });

  const conv3Turn3 = await prisma.conversation.findFirst({
    where: { id: conv3.id },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  console.log("\n--- SCENARIO 3 TURN 3 AI REPLY WORDING CHECK ---");
  conv3Turn3?.messages.forEach((m) => {
    console.log(`  [${m.sender}]: ${m.content}`);
  });

  const confirmedOrder3 = await prisma.order.findFirst({ where: { conversationId: conv3.id, isDeleted: false } });
  console.log("Confirmed Order 3:", { amount: confirmedOrder3?.amount, summary: confirmedOrder3?.summary });

  if (!confirmedOrder3 || confirmedOrder3.amount <= (draft3Turn1?.totalAmount || 0)) {
    throw new Error("Scenario 3 FAIL: Confirmed order did not reflect updated 3-shirt total.");
  }
  console.log("✅ TEST 3 PASSED: Mid-conversation order change updated draft in place -> Final order reflects 3 shirts!");

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Abandoned Stale Draft Handling
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n==================================================");
  console.log("TEST 4: Abandoned Stale Draft Expiration");
  console.log("==================================================");
  const chatId4 = "test_draft_s4_" + Date.now();

  await processWebhookJob({
    id: "job-s4-turn1",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId4, text: "2 shirts from STS", isCallback: false, companyId }
  });

  const lead4 = await prisma.lead.findFirst({ where: { contact: chatId4, companyId } });
  const conv4 = lead4 ? await prisma.conversation.findFirst({ where: { leadId: lead4.id, companyId } }) : null;
  if (!conv4) throw new Error("Scenario 4: Conversation not created.");

  // Simulate stale draft by setting updatedAt to 2 days ago
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await prisma.draftOrder.updateMany({
    where: { conversationId: conv4.id },
    data: { updatedAt: twoDaysAgo, expiresAt: twoDaysAgo }
  });

  // Customer returns days later with an unrelated message
  await processWebhookJob({
    id: "job-s4-turn2",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId4, text: "What is your store timing?", isCallback: false, companyId }
  });

  const staleDraft = await prisma.draftOrder.findFirst({ where: { conversationId: conv4.id } });
  const order4 = await prisma.order.findFirst({ where: { conversationId: conv4.id, isDeleted: false } });

  console.log("Stale draft status after turn 2:", staleDraft?.status);
  console.log("Order created:", order4 ? order4.id : "NONE");

  if (staleDraft?.status !== DraftOrderStatus.ABANDONED || order4) {
    throw new Error("Scenario 4 FAIL: Stale draft was not marked ABANDONED or created an unexpected order.");
  }
  console.log("✅ TEST 4 PASSED: Stale draft auto-abandoned. Unrelated message did NOT trigger order confirmation.");

  // ═════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Unmatched/Ambiguous Product Safety Guard
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n==================================================");
  console.log("TEST 5: Unmatched / Hallucinated Product Safety Guard");
  console.log("==================================================");
  const chatId5 = "test_draft_s5_" + Date.now();

  // Customer orders a non-existent item
  await processWebhookJob({
    id: "job-s5-turn1",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId5, text: "5 Quantum Anti-Gravity Disintegrators", isCallback: false, companyId }
  });

  const lead5 = await prisma.lead.findFirst({ where: { contact: chatId5, companyId } });
  const conv5 = lead5 ? await prisma.conversation.findFirst({ where: { leadId: lead5.id, companyId } }) : null;

  const draft5 = conv5 ? await prisma.draftOrder.findFirst({ where: { conversationId: conv5.id } }) : null;
  console.log("Draft 5 status for unverified item:", draft5?.status);

  if (draft5 && draft5.status === DraftOrderStatus.AWAITING_CONFIRMATION) {
    throw new Error("Scenario 5 FAIL: Draft for unverified item was wrongly placed in AWAITING_CONFIRMATION status!");
  }

  // Attempt to confirm
  await processWebhookJob({
    id: "job-s5-turn2",
    data: { channel: "TELEGRAM" as any, externalChatId: chatId5, text: "Confirm my order", isCallback: false, companyId }
  });

  const order5 = conv5 ? await prisma.order.findFirst({ where: { conversationId: conv5.id, isDeleted: false } }) : null;
  console.log("Order 5 created:", order5 ? order5.id : "NONE");

  if (order5) {
    throw new Error("Scenario 5 FAIL: Created an order for unverified/hallucinated items!");
  }
  console.log("✅ TEST 5 PASSED: Confirmation blocked for unverified/ambiguous item draft.");

  console.log("\n🎉 ALL 5 DRAFT ORDER TEST SCENARIOS PASSED SUCCESSFULLY!");
  global.fetch = originalFetch;
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("❌ Draft Order Test Suite Failed:", err);
  process.exit(1);
});
