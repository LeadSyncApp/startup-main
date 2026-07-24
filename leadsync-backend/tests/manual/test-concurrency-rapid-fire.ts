import { prisma } from "../../src/lib/prisma";
import { Channel, ConversationStatus, MessageSender } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { decryptSecret } from "../../src/utils/encryption";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { createTestCompany, cleanupTestCompany } from "./testCompanyFactory";
import "dotenv/config";

const REAL_CHAT_ID = "7656635489";
const RAPID_FIRE_DELAY_MS = 100; // 100ms between messages — fast enough to overlap processing
const SETTLE_TIME_MS = 10_000;   // Wait for background setImmediate + triage to finish

interface ConnectionSnapshot {
  timestamp: number;
  activeConnections: number;
  waitingQueries: number;
}

async function takeConnectionSnapshot(): Promise<ConnectionSnapshot> {
  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'`
  );
  const waiting = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND wait_event IS NOT NULL AND state = 'active'`
  );
  return {
    timestamp: Date.now(),
    activeConnections: Number(result[0]?.count ?? 0),
    waitingQueries: Number(waiting[0]?.count ?? 0),
  };
}

async function runConcurrencyRapidFireTest() {
  console.log("==========================================================================================");
  console.log("RAPID-FIRE 5-MESSAGE CONCURRENCY TEST — DATA VERIFICATION");
  console.log("==========================================================================================");
  console.log(`Delay between messages: ${RAPID_FIRE_DELAY_MS}ms`);
  console.log(`Settle time before verification: ${SETTLE_TIME_MS}ms`);

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

  const testCompany = await createTestCompany("CONCURRENCY-RF");
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
        name: "Concurrency Test Customer",
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        status: ConversationStatus.OPEN,
        leadId: lead.id,
        mode: "BOT",
      },
    });

    // Record baseline state
    const baselineMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
    });
    const baselineLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    console.log(`\n📊 Baseline: ${baselineMessages.length} messages, aiPriority=${baselineLead?.aiPriority}`);

    // Take initial connection snapshot
    const initialSnapshot = await takeConnectionSnapshot();
    console.log(`📊 Initial DB connections: ${initialSnapshot.activeConnections} active, ${initialSnapshot.waitingQueries} waiting`);

    // ── FIRE 5 MESSAGES RAPIDLY ──
    console.log("\n--- FIRING 5 MESSAGES IN RAPID SUCCESSION ---\n");

    const messages = [
      "I want to order 3 widgets",
      "Actually make it 5 widgets",
      "What brands do you have?",
      "Can I get a discount?",
      "Thanks, confirm my order",
    ];

    const connectionSnapshots: ConnectionSnapshot[] = [initialSnapshot];
    const jobResults: { step: number; input: string; latencyMs: number; error?: string }[] = [];

    // Snapshot connections every 500ms during firing
    const snapshotInterval = setInterval(async () => {
      try {
        connectionSnapshots.push(await takeConnectionSnapshot());
      } catch (_) {}
    }, 500);

    const fireStart = Date.now();
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const jobId = `rf-job-${i + 1}-${Date.now()}`;
      const mockJob = {
        id: jobId,
        data: {
          companyId,
          channel: Channel.TELEGRAM,
          externalChatId: REAL_CHAT_ID,
          text: msg,
          contactName: "Concurrency Test Customer",
          isCallback: false,
        },
      };

      const stepStart = performance.now();
      try {
        await processWebhookJob(mockJob as any);
        const elapsedMs = Math.round(performance.now() - stepStart);
        jobResults.push({ step: i + 1, input: msg, latencyMs: elapsedMs });
        console.log(`✅ [${i + 1}/5] "${msg}" — ${elapsedMs}ms`);
      } catch (err: any) {
        const elapsedMs = Math.round(performance.now() - stepStart);
        jobResults.push({ step: i + 1, input: msg, latencyMs: elapsedMs, error: err.message });
        console.error(`❌ [${i + 1}/5] "${msg}" — ${elapsedMs}ms — ERROR: ${err.message}`);
      }

      if (i < messages.length - 1) {
        await new Promise(r => setTimeout(r, RAPID_FIRE_DELAY_MS));
      }
    }
    clearInterval(snapshotInterval);
    const fireDuration = Date.now() - fireStart;
    console.log(`\n⏱️ All 5 jobs fired in ${fireDuration}ms`);

    // Take final connection snapshot during firing
    try {
      connectionSnapshots.push(await takeConnectionSnapshot());
    } catch (_) {}

    // ── SETTLE: Wait for background setImmediate + triage ──
    console.log(`\n⏳ Waiting ${SETTLE_TIME_MS}ms for background processing + triage to settle...`);
    await new Promise(r => setTimeout(r, SETTLE_TIME_MS));

    // ── DATA VERIFICATION ──
    console.log("\n==========================================================================================");
    console.log("DATA VERIFICATION");
    console.log("==========================================================================================");

    // 1. Duplicate message check
    const allMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, content: true, sender: true, createdAt: true },
    });

    console.log(`\n📨 Total messages in conversation: ${allMessages.length} (expected: 10 = 5 client + 5 bot)`);

    const clientMessages = allMessages.filter(m => m.sender === MessageSender.CLIENT);
    const botMessages = allMessages.filter(m => m.sender === MessageSender.BOT);
    console.log(`   Client messages: ${clientMessages.length} (expected: 5)`);
    console.log(`   Bot messages: ${botMessages.length} (expected: 5)`);

    // Check for duplicate client messages (same content)
    const contentCounts = new Map<string, number>();
    for (const msg of clientMessages) {
      const key = msg.content.trim().toLowerCase();
      contentCounts.set(key, (contentCounts.get(key) || 0) + 1);
    }
    const duplicates = [...contentCounts.entries()].filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
      console.error(`\n🚨 DUPLICATE CLIENT MESSAGES DETECTED:`);
      for (const [content, count] of duplicates) {
        console.error(`   "${content}" appears ${count} times`);
      }
    } else {
      console.log(`\n✅ No duplicate client messages — each message appears exactly once`);
    }

    // 2. aiPriority consistency check
    const finalLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    console.log(`\n🎯 Lead aiPriority: ${finalLead?.aiPriority} (expected: HIGH or MEDIUM — order messages should set priority)`);

    // 3. sessionState check (triage should have written lastTriagedAt)
    const finalConversation = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    const sessionState = (finalConversation as any)?.sessionState;
    const lastTriagedAt = sessionState?.lastTriagedAt;
    console.log(`\n🧠 Triage state: lastTriagedAt=${lastTriagedAt ? "SET" : "NOT SET"}, intent=${finalConversation?.intent ?? "null"}`);

    if (!lastTriagedAt) {
      console.error(`   ⚠️ Triage did not run — sessionState.lastTriagedAt is null`);
    }

    // 4. Connection pressure analysis
    console.log("\n📊 Connection snapshots during test:");
    const peakConnections = Math.max(...connectionSnapshots.map(s => s.activeConnections));
    const peakWaiting = Math.max(...connectionSnapshots.map(s => s.waitingQueries));
    console.log(`   Peak active connections: ${peakConnections}`);
    console.log(`   Peak waiting queries: ${peakWaiting}`);
    console.log(`   Pool limit: 15`);

    if (peakConnections >= 12) {
      console.error(`   🚨 HIGH CONNECTION PRESSURE: ${peakConnections}/15 — risk of P1017 timeouts`);
    } else if (peakConnections >= 9) {
      console.warn(`   ⚠️ MODERATE CONNECTION PRESSURE: ${peakConnections}/15 — monitor under real load`);
    } else {
      console.log(`   ✅ Connection pressure within safe range: ${peakConnections}/15`);
    }

    // Print full snapshot table
    console.table(connectionSnapshots.map((s, i) => ({
      snapshot: i,
      active: s.activeConnections,
      waiting: s.waitingQueries,
      timeMs: i === 0 ? 0 : s.timestamp - connectionSnapshots[0].timestamp,
    })));

    // 5. Job results summary
    console.log("\n📋 Job execution summary:");
    console.table(jobResults);
    const jobErrors = jobResults.filter(r => r.error);
    const avgLatency = Math.round(jobResults.reduce((sum, r) => sum + r.latencyMs, 0) / jobResults.length);

    // ── FINAL VERDICT ──
    console.log("\n==========================================================================================");
    console.log("FINAL VERDICT");
    console.log("==========================================================================================");

    const checks = [
      { name: "No duplicate client messages", passed: duplicates.length === 0 },
      { name: "Exactly 5 client messages", passed: clientMessages.length === 5 },
      { name: "Exactly 5 bot messages", passed: botMessages.length === 5 },
      { name: "No job execution errors", passed: jobErrors.length === 0 },
      { name: "Triage ran (lastTriagedAt set)", passed: !!lastTriagedAt },
      { name: "Peak connections < 12", passed: peakConnections < 12 },
    ];

    let allPassed = true;
    for (const check of checks) {
      const icon = check.passed ? "✅" : "❌";
      console.log(`  ${icon} ${check.name}`);
      if (!check.passed) allPassed = false;
    }

    console.log(`\n  Average job latency: ${avgLatency}ms`);
    console.log(`  Total fire duration: ${fireDuration}ms`);

    if (allPassed) {
      console.log("\n🎉 ALL CHECKS PASSED — concurrency fixes are working correctly");
    } else {
      console.error("\n❌ ONE OR MORE CHECKS FAILED — investigate before deploying");
      process.exit(1);
    }

  } finally {
    await cleanupTestCompany(companyId);
  }

  await prisma.$disconnect();
}

runConcurrencyRapidFireTest().catch((err) => {
  console.error("CONCURRENCY TEST ERROR:", err);
  process.exit(1);
});
