import "dotenv/config";
import { performance } from "perf_hooks";
import { prisma } from "../src/lib/prisma";
import { pgBossService } from "../src/services/infrastructure/pgboss/pgboss.service";
import { startOrchestratorWorker } from "../src/services/workers/ai.orchestrator.worker";
import { ensureRerankerReady } from "../src/services/knowledge/productMatch.service";
import { onnxWorkerPool } from "../src/utils/onnxWorkerPool";
import { Channel, StandardMessageFrame } from "../src/interfaces/messaging.interface";

const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";

const CONCURRENT_MESSAGES = [
  { phone: "+919999900001", name: "Load Customer 1", text: "do you have silk sarees?" },
  { phone: "+919999900002", name: "Load Customer 2", text: "do you have cotton pants?" },
  { phone: "+919999900003", name: "Load Customer 3", text: "anything in polyester?" },
  { phone: "+919999900004", name: "Load Customer 4", text: "Do u have any branded pants" },
  { phone: "+919999900005", name: "Load Customer 5", text: "do you deliver internationally" },
];

// Event loop heartbeat / tick monitor
class HeartbeatMonitor {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private lastTick: number = 0;
  private ticks: number = 0;
  private totalLag: number = 0;
  private maxLag: number = 0;
  private lagsOver15ms: number = 0;
  private lagsOver50ms: number = 0;
  private lagsOver100ms: number = 0;

  constructor(intervalMs = 10) {
    this.intervalMs = intervalMs;
  }

  public start() {
    this.ticks = 0;
    this.totalLag = 0;
    this.maxLag = 0;
    this.lagsOver15ms = 0;
    this.lagsOver50ms = 0;
    this.lagsOver100ms = 0;
    this.lastTick = performance.now();

    this.timer = setInterval(() => {
      const now = performance.now();
      const actualDelta = now - this.lastTick;
      const lag = Math.max(0, actualDelta - this.intervalMs);

      this.ticks++;
      this.totalLag += lag;
      if (lag > this.maxLag) this.maxLag = lag;
      if (lag > 15) this.lagsOver15ms++;
      if (lag > 50) this.lagsOver50ms++;
      if (lag > 100) this.lagsOver100ms++;

      this.lastTick = now;
    }, this.intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStats() {
    const avgLag = this.ticks > 0 ? this.totalLag / this.ticks : 0;
    return {
      totalTicks: this.ticks,
      avgLagMs: Number(avgLag.toFixed(2)),
      maxLagMs: Number(this.maxLag.toFixed(2)),
      lagsOver15ms: this.lagsOver15ms,
      lagsOver50ms: this.lagsOver50ms,
      lagsOver100ms: this.lagsOver100ms,
      responsivePercent: Number((((this.ticks - this.lagsOver50ms) / Math.max(1, this.ticks)) * 100).toFixed(2)),
    };
  }
}

async function waitForBotResponse(companyId: string, phone: string, startTime: Date, timeoutMs = 90000): Promise<{ botMsg: any; latencyMs: number }> {
  const t0 = performance.now();
  const deadline = t0 + timeoutMs;

  while (performance.now() < deadline) {
    const lead = await prisma.lead.findFirst({
      where: { companyId, contact: { contains: phone.slice(-10) } },
      select: { id: true }
    });

    if (lead) {
      const conv = await prisma.conversation.findFirst({
        where: { companyId, leadId: lead.id, lifecycleStatus: "active" },
        select: { id: true }
      });

      if (conv) {
        const botMsg = await prisma.message.findFirst({
          where: {
            conversationId: conv.id,
            sender: "BOT",
            createdAt: { gte: new Date(startTime.getTime() - 2000) }
          },
          orderBy: { createdAt: "desc" }
        });

        if (botMsg) {
          const latencyMs = Math.round(performance.now() - t0);
          return { botMsg, latencyMs };
        }
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  throw new Error(`Timeout waiting for BOT reply for phone ${phone} after ${timeoutMs}ms`);
}

async function main() {
  console.log("=" .repeat(80));
  console.log("🚀 STARTING E2E CONCURRENT PIPELINE LOAD TEST");
  console.log(`Pool Size: ${onnxWorkerPool.getPoolSize()} (ONNX_WORKER_POOL_SIZE = ${process.env.ONNX_WORKER_POOL_SIZE || "default: 1"})`);
  console.log(`Simultaneous Conversations: ${CONCURRENT_MESSAGES.length}`);
  console.log("=" .repeat(80));

  // 1. Initialize DB, Worker Pool, PgBoss, Reranker, and Worker
  console.log("\n📦 Phase 1: Booting pipeline components...");
  await onnxWorkerPool.init();
  await prisma.$connect();
  await pgBossService.initialize();
  await ensureRerankerReady();
  await startOrchestratorWorker();

  onnxWorkerPool.clearMetrics();
  const heartbeat = new HeartbeatMonitor(10);
  heartbeat.start();

  console.log("✅ Pipeline components ready. Starting tick heartbeat monitor.");

  // 2. Prepare frames
  const testStartTime = new Date();
  const frames: StandardMessageFrame[] = CONCURRENT_MESSAGES.map((msg) => ({
    channel: Channel.TELEGRAM,
    externalChatId: msg.phone,
    contactName: msg.name,
    text: msg.text,
    companyId: COMPANY_ID,
    isCallback: false,
  }));

  console.log("\n" + "=" .repeat(80));
  console.log(`⚡ Phase 2: Enqueuing ${frames.length} messages simultaneously (within 0ms window)...`);
  console.log("=" .repeat(80));

  const boss = pgBossService.getBoss();
  const sendTime = Date.now();
  const perfSendStart = performance.now();

  // Fire all 5 messages concurrently into pg-boss queue
  const enqueueResults = await Promise.all(
    frames.map(async (frame, idx) => {
      const sendStart = performance.now();
      const jobId = await boss.send("webhook.process", frame, { retryLimit: 0 });
      const sendDur = Math.round(performance.now() - sendStart);
      return { idx, phone: frame.externalChatId, text: frame.text, jobId, sendDur };
    })
  );

  console.log("Enqueued all 5 jobs to pg-boss queue:");
  enqueueResults.forEach((res) => {
    console.log(`  [Job #${res.idx + 1}] ID: ${res.jobId} | Phone: ${res.phone} | Enqueue time: ${res.sendDur}ms`);
  });

  // 3. Await end-to-end completion for all 5 conversations
  console.log("\n⏳ Phase 3: Waiting for end-to-end processing & BOT reply generation for all 5 conversations...");
  
  const results = await Promise.allSettled(
    CONCURRENT_MESSAGES.map(async (msg, idx) => {
      const { botMsg, latencyMs } = await waitForBotResponse(COMPANY_ID, msg.phone, testStartTime);
      const totalE2eFromEnqueue = Math.round(performance.now() - perfSendStart);
      return {
        idx: idx + 1,
        phone: msg.phone,
        query: msg.text,
        botReply: botMsg.content,
        botMsgId: botMsg.id,
        pollLatencyMs: latencyMs,
        totalE2eFromEnqueue,
      };
    })
  );

  heartbeat.stop();
  const heartbeatStats = heartbeat.getStats();
  const workerMetrics = onnxWorkerPool.getMetrics();
  const maxQueueDepth = onnxWorkerPool.getMaxQueueDepth();

  console.log("\n" + "=" .repeat(80));
  console.log("📊 LOAD TEST RESULTS & BENCHMARK REPORT");
  console.log("=" .repeat(80));

  // Report 1: End-to-End Latency
  console.log("\n1. TOTAL END-TO-END LATENCY PER MESSAGE UNDER CONCURRENT LOAD:");
  console.log("-".repeat(80));

  let totalE2e = 0;
  const e2eTimes: number[] = [];

  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      const val = res.value;
      e2eTimes.push(val.totalE2eFromEnqueue);
      totalE2e += val.totalE2eFromEnqueue;
      console.log(
        `  Msg #${val.idx} ("${val.query}"): ${val.totalE2eFromEnqueue} ms | BOT: "${val.botReply.substring(0, 70)}..."`
      );
    } else {
      console.error(`  Msg #${i + 1} FAILED:`, res.reason);
    }
  });

  if (e2eTimes.length > 0) {
    const minE2e = Math.min(...e2eTimes);
    const maxE2e = Math.max(...e2eTimes);
    const avgE2e = Math.round(totalE2e / e2eTimes.length);
    const sortedE2e = [...e2eTimes].sort((a, b) => a - b);
    const medianE2e = sortedE2e[Math.floor(sortedE2e.length / 2)];

    console.log(`\n  E2E Latency Summary (N=${e2eTimes.length}):`);
    console.log(`    Min Latency:    ${minE2e} ms`);
    console.log(`    Max Latency:    ${maxE2e} ms`);
    console.log(`    Avg Latency:    ${avgE2e} ms`);
    console.log(`    Median Latency: ${medianE2e} ms`);
  }

  // Report 2: Worker Pool Queueing Analysis
  console.log("\n2. ONNX WORKER POOL QUEUEING & LATENCY ANALYSIS (Pool Size = 1):");
  console.log("-".repeat(80));
  console.log(`  Max Queue Depth Reached: ${maxQueueDepth} tasks`);
  console.log(`  Total Tasks Processed:   ${workerMetrics.length} tasks`);

  const embedMetrics = workerMetrics.filter((m) => m.type === "EMBED");
  const rerankMetrics = workerMetrics.filter((m) => m.type === "RERANK");

  console.log("\n  [EMBED Tasks Metrics] (Count: " + embedMetrics.length + ")");
  let totalEmbedWait = 0, totalEmbedExec = 0;
  embedMetrics.forEach((m, idx) => {
    totalEmbedWait += m.queueWaitMs;
    totalEmbedExec += m.execMs;
    console.log(
      `    EMBED #${idx + 1}: Queue Wait = ${m.queueWaitMs} ms | Execution = ${m.execMs} ms | Total = ${m.totalMs} ms`
    );
  });
  const avgEmbedWait = embedMetrics.length ? (totalEmbedWait / embedMetrics.length).toFixed(1) : "0";
  const avgEmbedExec = embedMetrics.length ? (totalEmbedExec / embedMetrics.length).toFixed(1) : "0";
  console.log(`    --> EMBED Avg Queue Wait: ${avgEmbedWait} ms | Avg Exec: ${avgEmbedExec} ms`);

  console.log("\n  [RERANK Tasks Metrics] (Count: " + rerankMetrics.length + ")");
  let totalRerankWait = 0, totalRerankExec = 0;
  rerankMetrics.forEach((m, idx) => {
    totalRerankWait += m.queueWaitMs;
    totalRerankExec += m.execMs;
    console.log(
      `    RERANK #${idx + 1}: Queue Wait = ${m.queueWaitMs} ms | Execution = ${m.execMs} ms | Total = ${m.totalMs} ms`
    );
  });
  const avgRerankWait = rerankMetrics.length ? (totalRerankWait / rerankMetrics.length).toFixed(1) : "0";
  const avgRerankExec = rerankMetrics.length ? (totalRerankExec / rerankMetrics.length).toFixed(1) : "0";
  console.log(`    --> RERANK Avg Queue Wait: ${avgRerankWait} ms | Avg Exec: ${avgRerankExec} ms`);

  const grandTotalWait = totalEmbedWait + totalRerankWait;
  const grandTotalExec = totalEmbedExec + totalRerankExec;
  console.log(`\n  Worker Pool Queue Overhead Summary:`);
  console.log(`    Total Queue Wait Time across all tasks: ${grandTotalWait} ms`);
  console.log(`    Total Execution Time across all tasks:  ${grandTotalExec} ms`);
  console.log(`    Queue Wait Ratio:                       ${((grandTotalWait / Math.max(1, grandTotalWait + grandTotalExec)) * 100).toFixed(1)}% of ONNX inference time spending in worker queue`);

  // Report 3: Main Thread Responsiveness
  console.log("\n3. MAIN THREAD EVENT LOOP RESPONSIVENESS (Heartbeat/Tick Method):");
  console.log("-".repeat(80));
  console.log(`  Heartbeat Sample Count:  ${heartbeatStats.totalTicks} (at 10ms target interval)`);
  console.log(`  Average Event Loop Lag:  ${heartbeatStats.avgLagMs} ms`);
  console.log(`  Maximum Event Loop Lag:  ${heartbeatStats.maxLagMs} ms`);
  console.log(`  Ticks > 15ms lag:        ${heartbeatStats.lagsOver15ms}`);
  console.log(`  Ticks > 50ms lag:        ${heartbeatStats.lagsOver50ms}`);
  console.log(`  Ticks > 100ms lag:       ${heartbeatStats.lagsOver100ms}`);
  console.log(`  Main Thread Smoothness:  ${heartbeatStats.responsivePercent}% ticks processed without blocking (>50ms)`);

  console.log("\n" + "=" .repeat(80));
  console.log("🏁 LOAD TEST COMPLETED CLEANLY");
  console.log("=" .repeat(80));

  // Cleanup resources
  await pgBossService.stop();
  await onnxWorkerPool.shutdown();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("\n❌ LOAD TEST FATAL ERROR:", err);
  try {
    await pgBossService.stop();
    await onnxWorkerPool.shutdown();
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
