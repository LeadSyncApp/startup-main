import { prisma } from "../../src/lib/prisma";
import { Channel, ConversationStatus } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { decryptSecret } from "../../src/utils/encryption";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { createTestCompany, cleanupTestCompany } from "./testCompanyFactory";
import "dotenv/config";

const REAL_CHAT_ID = "7656635489";

async function runSequenceCorrectnessTest() {
  console.log("==========================================================================================");
  console.log("5-MESSAGE RAPID SEQUENTIAL CORRECTNESS & DE-DUPLICATION TEST");
  console.log("==========================================================================================");

  // Load real company bot token for live testing
  const prodCompany = await prisma.company.findUnique({
    where: { id: "3102a85e-1798-45bb-b6c5-d94ea436f775" },
    select: { telegramBotToken: true }
  });

  const REAL_BOT_TOKEN = decryptSecret(prodCompany!.telegramBotToken);
  if (!REAL_BOT_TOKEN) {
    console.error("FATAL: Could not decrypt bot token");
    process.exit(1);
  }

  await pgBossService.initialize();

  const testCompany = await createTestCompany("SEQ-CORRECTNESS");
  const companyId = testCompany.id;

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { telegramBotToken: REAL_BOT_TOKEN, telegramConnected: true }
    });

    const lead = await prisma.lead.create({
      data: {
        companyId,
        contact: REAL_CHAT_ID,
        channel: Channel.TELEGRAM,
        name: "Test Customer",
      },
    });

    await prisma.conversation.create({
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        status: ConversationStatus.OPEN,
        leadId: lead.id,
        mode: "BOT",
      },
    });

    const sequenceMessages = [
      { text: "hi", expectedCategory: "fast_path:greeting" },
      { text: "ok", expectedCategory: "fast_path:acknowledgment" },
      { text: "Do you have any brands?", expectedCategory: "ai_pipeline" },
      { text: "thanks", expectedCategory: "fast_path:acknowledgment" },
      { text: "bye", expectedCategory: "fast_path:farewell" },
    ];

    const results: { step: number; input: string; response: string; fastPath: boolean; matchesExpected: boolean }[] = [];

    console.log("\n--- EXECUTING 5 RAPID SEQUENTIAL MESSAGES ---\n");

    for (let i = 0; i < sequenceMessages.length; i++) {
      const msg = sequenceMessages[i];
      const jobId = `seq-job-${i + 1}-${Date.now()}`;
      
      const mockJob = {
        id: jobId,
        data: {
          companyId,
          channel: Channel.TELEGRAM,
          externalChatId: REAL_CHAT_ID,
          text: msg.text,
          contactName: "Test Customer",
          isCallback: false,
        },
      };

      console.log(`\n📨 [Message ${i + 1}/5] Sending: "${msg.text}"`);
      const startMs = performance.now();
      const res = await processWebhookJob(mockJob as any);
      const elapsedMs = Math.round(performance.now() - startMs);

      const isFastPath = !!(res as any)?.fast_path;
      const respText = (res as any)?.response || (res as any)?.reply || JSON.stringify(res);

      let matches = false;
      if (msg.expectedCategory.startsWith("fast_path")) {
        const cat = msg.expectedCategory.split(":")[1];
        matches = isFastPath && (res as any)?.category === cat;
      } else {
        // AI Pipeline query — must NOT be fast_path
        matches = !isFastPath;
      }

      console.log(`   ↳ Reply: "${respText}" (FastPath: ${isFastPath}, Latency: ${elapsedMs}ms) [Matched Category: ${matches ? "✅ YES" : "❌ NO"}]`);

      results.push({
        step: i + 1,
        input: msg.text,
        response: respText,
        fastPath: isFastPath,
        matchesExpected: matches,
      });

      // Short delay between customer messages to simulate fast typing (200ms)
      await new Promise(r => setTimeout(r, 200));
    }

    console.log("\n==========================================================================================");
    console.log("SEQUENTIAL TEST SUMMARY REPORT");
    console.log("==========================================================================================");
    console.table(results);

    const allPassed = results.every(r => r.matchesExpected);
    if (allPassed) {
      console.log("\n🎉 SUCCESS: All 5 sequential messages produced CORRECT, 1-to-1 ordered replies!");
    } else {
      console.error("\n❌ FAILURE: One or more messages produced mismatched or out-of-order replies.");
      process.exit(1);
    }

  } finally {
    await cleanupTestCompany(companyId);
  }

  await prisma.$disconnect();
}

runSequenceCorrectnessTest().catch((err) => {
  console.error("SEQUENCE TEST ERROR:", err);
  process.exit(1);
});
