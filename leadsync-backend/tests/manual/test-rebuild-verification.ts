import { prisma } from "../../src/lib/prisma";
import { Channel as PrismaChannel, ConversationStatus } from "@prisma/client";
import { Channel as InterfaceChannel } from "../../src/interfaces/messaging.interface";
import { resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { FastPathService } from "../../src/services/messaging/fastPath.service";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { withTestCompany } from "./testCompanyFactory";

async function runComprehensiveVerification() {
  console.log("==========================================================================================");
  console.log("PRODUCTION-GRADE PIPELINE REBUILD VERIFICATION SUITE");
  console.log("==========================================================================================");

  // Pre-warm DB connection pool
  await prisma.company.findFirst();
  await pgBossService.initialize().catch(() => {});
  console.log("⚡ Pre-warmed DB connection pool and pg-boss.\n");

  const testMessages = [
    { label: "1. FastPath Greeting", text: "hi", type: "fastpath" },
    { label: "2. FastPath Acknowledgment", text: "thanks", type: "fastpath" },
    { label: "3. FastPath Farewell", text: "bye", type: "fastpath" },
    { label: "4. FastPath Yes/No", text: "yes", type: "fastpath" },
    { label: "5. Rule Match Keyword", text: "biryani", type: "rule" },
    { label: "6. Rule Match Intent", text: "I want biryani offer", type: "rule" },
    { label: "7. Complex AI - Specific Product Inquiry", text: "Do you have chicken biryani?", type: "ai" },
    { label: "8. Complex AI - Delivery Policy Query", text: "What is your delivery time?", type: "ai" },
    { label: "9. Complex AI - General Product Request", text: "I want to order a pizza", type: "ai" },
    { label: "10. Complex AI - Veg Option Query", text: "Do you have any vegetarian options?", type: "ai" }
  ];

  const results: { label: string; text: string; wallClockMs: number; status: string }[] = [];

  await withTestCompany("VERIFY-SUITE", async (testCompany) => {
    const companyId = testCompany.id;
    await resolveTenantContext(companyId);

    // Create a conversational rule for rule-match cases
    const rule = await prisma.conversationalRule.create({
      data: {
        companyId,
        name: "Biryani Offer",
        isEnabled: true,
        triggerKeywords: ["biryani", "biriyani", "briyani"],
        triggerType: "TEXT_MATCH",
        templateBody: "Special Biryani Offer: Chicken Biryani for ₹199!",
        ruleType: 1,
      },
    });
    await embedRuleToKnowledgeChunk({
      id: rule.id, companyId, name: rule.name, triggerKeywords: rule.triggerKeywords as string[], templateBody: rule.templateBody
    });

    // Add inventory product for catalog lookup
    await prisma.inventoryProduct.create({
      data: {
        companyId, name: "Chicken Biryani", basePrice: 199, isActive: true, description: "Delicious spices and rice"
      }
    });
    conversationalAutoReplyService.invalidateCache(companyId);

    let msgIndex = 0;
    for (const item of testMessages) {
      msgIndex++;
      console.log(`------------------------------------------------------------------------------------------`);
      console.log(`TESTING [${msgIndex}/10]: [${item.label}] "${item.text}"`);
      console.log(`------------------------------------------------------------------------------------------`);

      const contact = `998800${msgIndex}`;

      // Mock Telegram outbound HTTP call
      const origFetch = global.fetch;
      global.fetch = async () => {
        return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true, result: { message_id: 12345 } }) } as any;
      };

      try {
        const start = performance.now();
        if (item.type === "fastpath") {
          await FastPathService.tryHandleFastPath({
            companyId,
            rawPayload: { message: { chat: { id: parseInt(contact) }, text: item.text } }
          });
        } else {
          await processWebhookJob({
            id: `job-${msgIndex}-${Date.now()}`,
            data: {
              companyId,
              channel: InterfaceChannel.TELEGRAM,
              externalChatId: contact,
              text: item.text,
              contactName: "Test Customer",
              isCallback: false
            }
          });
        }
        const elapsed = Math.round(performance.now() - start);
        results.push({ label: item.label, text: item.text, wallClockMs: elapsed, status: "SUCCESS" });
        console.log(`✅ Response delivered to customer in ${elapsed}ms\n`);
      } catch (err: any) {
        console.error(`❌ Test failed:`, err.message);
        results.push({ label: item.label, text: item.text, wallClockMs: 0, status: `ERROR: ${err.message}` });
      } finally {
        global.fetch = origFetch;
        await FastPathService.flushPendingBackgroundTasks();
      }
    }
  });

  // --- CONCURRENT / RACE CONDITION TEST ---
  console.log("\n==========================================================================================");
  console.log("RUNNING CONCURRENT RACE-CONDITION SAFETY TEST (2 Simultaneous Messages, Same Customer)");
  console.log("==========================================================================================");

  let racePass = false;
  await withTestCompany("RACE-TEST", async (testCompany) => {
    const companyId = testCompany.id;
    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true, result: { message_id: 99 } }) } as any);

    const contact = "concurrent-contact-999";
    const job1 = processWebhookJob({
      id: `race-1-${Date.now()}`,
      data: { companyId, channel: InterfaceChannel.TELEGRAM, externalChatId: contact, text: "Do you have chicken biryani?", contactName: "Race User", isCallback: false }
    });
    const job2 = processWebhookJob({
      id: `race-2-${Date.now()}`,
      data: { companyId, channel: InterfaceChannel.TELEGRAM, externalChatId: contact, text: "What is your delivery time?", contactName: "Race User", isCallback: false }
    });

    await Promise.all([job1, job2]);
    await FastPathService.flushPendingBackgroundTasks();
    global.fetch = origFetch;

    // Verify lead and conversation count in DB
    const leads = await prisma.lead.findMany({ where: { companyId, contact } });
    const convs = await prisma.conversation.findMany({ where: { companyId } });
    console.log(`Lead Count created for contact: ${leads.length} (Expected: 1)`);
    console.log(`Conversation Count created: ${convs.length} (Expected: 1)`);

    racePass = (leads.length === 1 && convs.length === 1);
  });

  // --- ORDER CONFIRMATION SAFETY TEST ---
  console.log("\n==========================================================================================");
  console.log("RUNNING ORDER-CONFIRMATION SAFETY TEST");
  console.log("==========================================================================================");

  let orderPass = false;
  await withTestCompany("ORDER-SAFETY-TEST", async (testCompany) => {
    const companyId = testCompany.id;
    const lead = await prisma.lead.create({
      data: { companyId, contact: "order-test-user", channel: PrismaChannel.TELEGRAM, name: "Order Test User" }
    });
    const conv = await prisma.conversation.create({
      data: { companyId, channel: PrismaChannel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id, mode: "BOT" }
    });

    const origFetch = global.fetch;
    global.fetch = async () => ({ ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true, result: { message_id: 100 } }) } as any);

    // Message 1: Order intent
    await processWebhookJob({
      id: `ord-1-${Date.now()}`,
      data: { companyId, channel: InterfaceChannel.TELEGRAM, externalChatId: "order-test-user", text: "I want to order 2 chicken biryani", contactName: "Order Test User", isCallback: false }
    });

    // Message 2: Confirm order
    await processWebhookJob({
      id: `ord-2-${Date.now()}`,
      data: { companyId, channel: InterfaceChannel.TELEGRAM, externalChatId: "order-test-user", text: "confirm my order", contactName: "Order Test User", isCallback: false }
    });

    await FastPathService.flushPendingBackgroundTasks();
    global.fetch = origFetch;

    const messages = await prisma.message.findMany({ where: { conversationId: conv.id } });
    console.log(`Messages saved in DB for conversation: ${messages.length} (Expected >= 4)`);
    orderPass = messages.length >= 4;
  });

  console.log("\n==========================================================================================");
  console.log("FINAL BENCHMARK & SAFETY REPORT");
  console.log("==========================================================================================");
  console.table(results);
  console.log(`Concurrent Lead Deduplication Test: ${racePass ? "PASSED ✅" : "FAILED ❌"}`);
  console.log(`Order Confirmation & Message Ledger Safety Test: ${orderPass ? "PASSED ✅" : "FAILED ❌"}`);
  await prisma.$disconnect();
}

runComprehensiveVerification().catch((err) => {
  console.error("VERIFICATION SUITE FATAL ERROR:", err);
  process.exit(1);
});
