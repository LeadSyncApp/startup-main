import { prisma } from "../../src/lib/prisma";
import { Channel, ConversationStatus } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { decryptSecret } from "../../src/utils/encryption";
import "dotenv/config";

const { processWebhookJob } = require("../../src/services/workers/ai.orchestrator.worker");
const { createTestCompany, cleanupTestCompany } = require("./testCompanyFactory");

const REAL_CHAT_ID = "7656635489";

async function runFastPathTrace() {
  console.log("==========================================================================================");
  console.log("FAST-PATH DETAILED STEP TIMING TRACE - Message: 'hi'");
  console.log("==========================================================================================");

  // Load real company to get bot token
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

  const timings: { step: string; fileLine: string; elapsedMs: number; stepMs: number }[] = [];
  let prevTs = performance.now();
  const startTs = prevTs;

  function mark(step: string, fileLine: string) {
    const now = performance.now();
    const elapsedMs = Math.round((now - startTs) * 10) / 10;
    const stepMs = Math.round((now - prevTs) * 10) / 10;
    timings.push({ step, fileLine, elapsedMs, stepMs });
    prevTs = now;
  }

  const testCompany = await createTestCompany("FASTPATH-TRACE");
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
        name: "Trace User",
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

    const mockJob = {
      id: `trace-job-${Date.now()}`,
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        externalChatId: REAL_CHAT_ID,
        text: "hi",
        contactName: "Trace User",
        isCallback: false,
      },
    };

    mark("Harness setup & DB company/lead/conversation prepared", "test-fastpath-trace.ts");
    mark("Invoke processWebhookJob", "ai.orchestrator.worker.ts:42");

    const t0 = performance.now();
    const result = await processWebhookJob(mockJob as any);
    const t1 = performance.now();

    mark(`First processWebhookJob completed (Duration: ${Math.round(t1 - t0)}ms)`, "ai.orchestrator.worker.ts");

    console.log("\n--- RUNNING SECOND WARM FAST-PATH MESSAGE ---");
    const mockJob2 = {
      id: `trace-job-2-${Date.now()}`,
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        externalChatId: REAL_CHAT_ID,
        text: "hello",
        contactName: "Trace User",
        isCallback: false,
      },
    };

    const t2 = performance.now();
    const result2 = await processWebhookJob(mockJob2 as any);
    const t3 = performance.now();

    mark(`Second warm processWebhookJob completed (Duration: ${Math.round(t3 - t2)}ms)`, "ai.orchestrator.worker.ts");

    console.log("\n--- RUNNING THIRD RETURNING USER FAST-PATH MESSAGE ---");
    const mockJob3 = {
      id: `trace-job-3-${Date.now()}`,
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        externalChatId: REAL_CHAT_ID,
        text: "hi",
        contactName: "Trace User",
        isCallback: false,
      },
    };

    const t4 = performance.now();
    const result3 = await processWebhookJob(mockJob3 as any);
    const t5 = performance.now();

    mark(`Third returning fast-path completed (Duration: ${Math.round(t5 - t4)}ms)`, "ai.orchestrator.worker.ts");

    console.log("\nORCHESTRATOR RESULT 1:");
    console.log(JSON.stringify(result, null, 2));
    console.log("\nORCHESTRATOR RESULT 2:");
    console.log(JSON.stringify(result2, null, 2));
    console.log("\nORCHESTRATOR RESULT 3:");
    console.log(JSON.stringify(result3, null, 2));

  } finally {
    await cleanupTestCompany(companyId);
  }

  console.log("\n==========================================================================================");
  console.log("PER-STEP TIMING BREAKDOWN TABLE");
  console.log("==========================================================================================");
  console.table(timings);

  await prisma.$disconnect();
}

runFastPathTrace().catch((err) => {
  console.error("TRACE ERROR:", err);
  process.exit(1);
});
