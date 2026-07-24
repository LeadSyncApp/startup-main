import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.DEBUG_LATENCY = "true";
process.env.PROCESS_PROFILE = "WORKER";

import { PrismaClient } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { startAiTriageWorker } from "../../src/services/workers/ai.triage.worker";
import { stepProfiler, StepProfileRecord } from "../../src/utils/stepProfiler";

const prisma = new PrismaClient();

const TEST_MESSAGES = [
  "Do you have Kanchipuram silk saree in red color?",
  "What products do you have available in your store?",
  "What is your return policy and delivery shipping time?",
  "Hello! How are you doing today?",
  "I want to place an order for a silk saree"
];

async function run5MessagesTest() {
  console.log("🚀 Starting 5-Message Pipeline Latency Test Suite...\n");
  const companyId = "3102a85e-1798-45bb-b6c5-d94ea436f775";
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true }
  });
  console.log(`Target Tenant Company: ${company?.name} (${company?.id})\n`);

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
  await prisma.$executeRawUnsafe("DELETE FROM pgboss.job WHERE name = 'ai-triage-job' AND state != 'completed';").catch(() => {});
  startAiTriageWorker();

  const traceIds: string[] = [];

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const runId = i + 1;
    const messageText = TEST_MESSAGES[i];
    const traceId = `msg-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    traceIds.push(traceId);
    stepProfiler.setRunId(runId);
    stepProfiler.setTraceId(traceId);
    
    console.log(`\n======================================================`);
    console.log(`RUN ${runId}/5: Processing message: "${messageText}"`);
    console.log(`Trace ID: ${traceId}`);
    console.log(`======================================================`);

    const enqueuedAt = Date.now();
    const frame: any = {
      channel: "TELEGRAM",
      externalChatId: lead.contact,
      contactName: lead.name || "Test User",
      text: messageText,
      companyId,
      isCallback: false,
      callbackData: null,
      rawPayload: {},
      context: {},
      _enqueuedAt: enqueuedAt,
      traceId
    };

    const fakeJob = {
      id: `test-latency-run${runId}-${Date.now()}`,
      data: frame,
      createdOn: new Date(enqueuedAt)
    };

    try {
      await stepProfiler.runWithContext({ traceId, runId }, async () => {
        await processWebhookJob(fakeJob as any);
      });
    } catch (err: any) {
      console.error(`❌ Error in Run ${runId}:`, err.message);
    }

    // Wait for triage jobs to complete - they run async with startAfter: 2-5s
    // Give them enough time to finish before the next run
    await new Promise((r) => setTimeout(r, 10000));
  }

  // Wait extra time for final triage job to complete
  await new Promise((r) => setTimeout(r, 10000));

  console.log("\n\n==========================================================================");
  console.log("             PER-TRACE-ID STEP PROFILER SUMMARY                          ");
  console.log("==========================================================================\n");

  const allTraces = stepProfiler.getAllTraces();
  const stepStatsMap = new Map<string, {
    stepName: string;
    fileLine: string;
    category: string;
    queryOrDetails: string;
    isSequential: boolean;
    durations: number[];
  }>();

  for (const [traceId, records] of allTraces.entries()) {
    console.log(`--- TRACE ${traceId} Step Breakdown (${records.length} instrumented steps) ---`);
    let traceTotal = 0;
    for (const r of records) {
      traceTotal += r.durationMs;
      console.log(`  • [${r.category}] ${r.stepName} (${r.fileLine}): ${r.durationMs}ms`);
      
      const key = `${r.stepName} | ${r.fileLine}`;
      if (!stepStatsMap.has(key)) {
        stepStatsMap.set(key, {
          stepName: r.stepName,
          fileLine: r.fileLine,
          category: r.category,
          queryOrDetails: r.queryOrDetails,
          isSequential: r.isSequential,
          durations: []
        });
      }
      stepStatsMap.get(key)!.durations.push(r.durationMs);
    }
    console.log(`Trace ${traceId} Total Instrumented Time: ${Math.round(traceTotal * 100) / 100}ms\n`);
  }

  console.log("\n==========================================================================");
  console.log("             AGGREGATED METRICS PER STEP ACROSS ALL TRACES                ");
  console.log("==========================================================================\n");

  for (const [key, stat] of stepStatsMap.entries()) {
    const count = stat.durations.length;
    const min = Math.min(...stat.durations);
    const max = Math.max(...stat.durations);
    const sum = stat.durations.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / count) * 100) / 100;
    console.log(`STEP: ${stat.stepName}`);
    console.log(`  File:Line : ${stat.fileLine}`);
    console.log(`  Category  : ${stat.category}`);
    console.log(`  Min/Max/Avg: ${min}ms / ${max}ms / ${avg}ms (over ${count} traces)`);
    console.log(`  Sequential: ${stat.isSequential ? "YES" : "NO"}`);
    console.log(`  Details   : ${stat.queryOrDetails}\n`);
  }

  // Compute average total per-trace time
  let totalAllTraces = 0;
  let traceCount = 0;
  for (const [traceId, records] of allTraces.entries()) {
    const traceTotal = records.reduce((sum, r) => sum + r.durationMs, 0);
    totalAllTraces += traceTotal;
    traceCount++;
  }
  const avgPerTrace = traceCount > 0 ? Math.round((totalAllTraces / traceCount) * 100) / 100 : 0;
  console.log(`\n📊 Average Total Per-Trace Instrumented Time: ${avgPerTrace}ms (across ${traceCount} traces)`);

  await prisma.$disconnect();
  console.log("🏁 All 5 test runs completed.");
  process.exit(0);
}

run5MessagesTest().catch((err) => {
  console.error("❌ Test Runner Failed:", err);
  process.exit(1);
});
