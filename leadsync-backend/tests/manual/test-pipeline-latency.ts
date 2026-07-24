import dotenv from "dotenv";
dotenv.config();

process.env.DEBUG_LATENCY = "true";
process.env.PROCESS_PROFILE = "WORKER";

import { PrismaClient } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🚀 Initializing Latency Test...");
  const companyId = "3102a85e-1798-45bb-b6c5-d94ea436f775";
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true }
  });
  console.log(`Found Company: ${company?.name} (${company?.id})`);

  let lead = await prisma.lead.findFirst({
    where: { companyId, channel: "TELEGRAM" }
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        companyId,
        channel: "TELEGRAM",
        contact: "tg_test_user_12345",
        name: "Test User Latency"
      }
    });
  }

  await pgBossService.initialize();

  const enqueuedAt = Date.now();
  const frame: any = {
    channel: "TELEGRAM",
    externalChatId: lead.contact,
    contactName: lead.name || "Test User",
    text: "What silk sarees do you have available?",
    companyId,
    isCallback: false,
    callbackData: null,
    rawPayload: {},
    context: {},
    _enqueuedAt: enqueuedAt
  };

  console.log(`📤 Enqueuing test message frame at timestamp: ${enqueuedAt}`);
  
  // Directly process job frame to capture detailed stage timings
  const fakeJob = {
    id: `test-latency-job-${Date.now()}`,
    data: frame,
    createdOn: new Date(enqueuedAt)
  };

  console.log("⚡ Executing processWebhookJob pipeline...");
  await processWebhookJob(fakeJob as any);

  await prisma.$disconnect();
  console.log("🏁 Test Execution Complete.");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ Latency Test Error:", err);
  process.exit(1);
});
