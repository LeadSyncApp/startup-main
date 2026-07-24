import { prisma } from "../../src/lib/prisma";
import { Channel, ConversationStatus } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { decryptSecret } from "../../src/utils/encryption";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { createTestCompany, cleanupTestCompany } from "./testCompanyFactory";
import "dotenv/config";

const REAL_CHAT_ID = "7656635489";
const NUM_CONVERSATIONS = 8;

interface ConnSnapshot {
  ts: string;
  active: number;
  idle: number;
  waiting: number;
  longTxns: number;
}

async function getConnStats(): Promise<ConnSnapshot> {
  const [active, idle, waiting, longRunning] = await Promise.all([
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'`
    ),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle'`
    ),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND wait_event IS NOT NULL AND state = 'active'`
    ),
    prisma.$queryRawUnsafe<{ pid: number; duration_s: number; query: string }[]>(
      `SELECT pid, EXTRACT(EPOCH FROM (now() - xact_start))::int as duration_s, LEFT(query, 100) as query
       FROM pg_stat_activity
       WHERE datname = current_database() AND state = 'active' AND xact_start < now() - interval '3 seconds'
       ORDER BY xact_start ASC`
    ),
  ]);
  return {
    ts: new Date().toISOString().split("T")[1].split(".")[0],
    active: Number(active[0]?.count ?? 0),
    idle: Number(idle[0]?.count ?? 0),
    waiting: Number(waiting[0]?.count ?? 0),
    longTxns: longRunning.length,
  };
}

async function runMultiConversationConcurrencyTest() {
  console.log("==========================================================================================");
  console.log(`MULTI-CONVERSATION CONCURRENCY TEST — ${NUM_CONVERSATIONS} PARALLEL CONVERSATIONS`);
  console.log("==========================================================================================");
  console.log("Tests: peak connection count, P1017/P1001 errors, setImmediate queueing\n");

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

  const testCompany = await createTestCompany("MULTI-CONV");
  const companyId = testCompany.id;

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { telegramBotToken: REAL_BOT_TOKEN, telegramConnected: true }
    });

    // Create N leads + conversations
    console.log(`Creating ${NUM_CONVERSATIONS} leads + conversations...`);
    const conversations: { leadId: string; conversationId: string; chatId: string; name: string }[] = [];

    for (let i = 0; i < NUM_CONVERSATIONS; i++) {
      const chatId = `MULTI_CONV_${i}_${Date.now()}`;
      const lead = await prisma.lead.create({
        data: {
          companyId,
          contact: chatId,
          channel: Channel.TELEGRAM,
          name: `Multi-Conv Customer ${i}`,
        },
      });
      const conv = await prisma.conversation.create({
        data: {
          companyId,
          channel: Channel.TELEGRAM,
          status: ConversationStatus.OPEN,
          leadId: lead.id,
          mode: "BOT",
        },
      });
      conversations.push({ leadId: lead.id, conversationId: conv.id, chatId, name: `Customer ${i}` });
    }

    console.log(`Created ${conversations.length} conversations\n`);

    // Baseline snapshot
    const baseline = await getConnStats();
    console.log(`📊 Baseline: active=${baseline.active}, idle=${baseline.idle}, waiting=${baseline.waiting}`);

    // Connection snapshot array
    const snapshots: ConnSnapshot[] = [baseline];
    let monitorRunning = true;

    // Background connection monitor — 300ms interval
    const monitorInterval = setInterval(async () => {
      if (!monitorRunning) return;
      try {
        snapshots.push(await getConnStats());
      } catch (_) {}
    }, 300);

    // ── FIRE ALL CONVERSATIONS SIMULTANEOUSLY ──
    console.log(`\n--- FIRING ${NUM_CONVERSATIONS} MESSAGES TO DIFFERENT CONVERSATIONS SIMULTANEOUSLY ---\n`);

    const messages = [
      "I want to order 5 widgets for $200",
      "What brands do you carry?",
      "I need a refund for order #1234",
      "Can I get bulk pricing on 50 units?",
      "Where is my shipment?",
      "I'd like to speak to a manager",
      "Do you have this in red?",
      "Cancel my subscription please",
    ];

    const jobErrors: string[] = [];
    const jobLatencies: { conv: number; ms: number }[] = [];

    const fireStart = Date.now();
    const firePromises = conversations.map(async (conv, i) => {
      const jobId = `multi-conv-${i}-${Date.now()}`;
      const mockJob = {
        id: jobId,
        data: {
          companyId,
          channel: Channel.TELEGRAM,
          externalChatId: conv.chatId,
          text: messages[i % messages.length],
          contactName: conv.name,
          isCallback: false,
        },
      };

      const t0 = performance.now();
      try {
        await processWebhookJob(mockJob as any);
        const ms = Math.round(performance.now() - t0);
        jobLatencies.push({ conv: i, ms });
        console.log(`✅ [Conv ${i}] "${messages[i % messages.length]}" — ${ms}ms`);
      } catch (err: any) {
        const ms = Math.round(performance.now() - t0);
        jobLatencies.push({ conv: i, ms });
        jobErrors.push(`Conv${i}: ${err.message}`);
        console.error(`❌ [Conv ${i}] "${messages[i % messages.length]}" — ${ms}ms — ${err.message}`);
      }
    });

    await Promise.all(firePromises);
    const fireDuration = Date.now() - fireStart;
    console.log(`\n⏱️ All ${NUM_CONVERSATIONS} jobs fired in ${fireDuration}ms`);

    // ── SETTLE ──
    console.log(`⏳ Waiting 12s for background setImmediate blocks + triage to finish...`);
    await new Promise(r => setTimeout(r, 12_000));

    monitorRunning = false;
    clearInterval(monitorInterval);

    // Final snapshot
    try {
      snapshots.push(await getConnStats());
    } catch (_) {}

    // ── DATA VERIFICATION ──
    console.log("\n==========================================================================================");
    console.log("DATA VERIFICATION");
    console.log("==========================================================================================");

    // Count messages per conversation
    let totalClient = 0;
    let totalBot = 0;
    let dupCount = 0;
    const convResults: { conv: number; client: number; bot: number; dups: number }[] = [];

    for (let i = 0; i < conversations.length; i++) {
      const msgs = await prisma.message.findMany({
        where: { conversationId: conversations[i].conversationId },
      });
      const client = msgs.filter(m => m.sender === "CLIENT").length;
      const bot = msgs.filter(m => m.sender === "BOT").length;

      // Check for duplicate client content
      const clientMsgs = msgs.filter(m => m.sender === "CLIENT");
      const contents = new Map<string, number>();
      for (const m of clientMsgs) {
        const key = m.content.trim().toLowerCase();
        contents.set(key, (contents.get(key) || 0) + 1);
      }
      const dups = [...contents.values()].filter(c => c > 1).reduce((a, b) => a + b - 1, 0);

      totalClient += client;
      totalBot += bot;
      dupCount += dups;
      convResults.push({ conv: i, client, bot, dups });
    }

    console.log(`\n📨 Message totals across ${NUM_CONVERSATIONS} conversations:`);
    console.log(`   Total client messages: ${totalClient} (expected: ${NUM_CONVERSATIONS})`);
    console.log(`   Total bot messages: ${totalBot} (expected: ${NUM_CONVERSATIONS})`);
    console.log(`   Duplicate client messages: ${dupCount}`);

    if (dupCount > 0) {
      console.error(`   🚨 DUPLICATE MESSAGES FOUND`);
    } else {
      console.log(`   ✅ No duplicates`);
    }

    // Connection pressure analysis
    const peakActive = Math.max(...snapshots.map(s => s.active));
    const peakWaiting = Math.max(...snapshots.map(s => s.waiting));
    const avgActive = (snapshots.reduce((sum, s) => sum + s.active, 0) / snapshots.length).toFixed(1);

    console.log(`\n📊 Connection pool pressure:`);
    console.log(`   Peak active connections: ${peakActive}/15`);
    console.log(`   Peak waiting queries: ${peakWaiting}`);
    console.log(`   Average active: ${avgActive}`);
    console.log(`   Pool limit: 15 (Prisma) / 30 (Supabase)`);

    if (peakActive >= 12) {
      console.error(`   🚨 HIGH PRESSURE: ${peakActive}/15 — P1017 risk under real load`);
    } else if (peakActive >= 9) {
      console.warn(`   ⚠️ MODERATE: ${peakActive}/15 — monitor in production`);
    } else {
      console.log(`   ✅ Safe range: ${peakActive}/15`);
    }

    // Print connection snapshot timeline (condensed — every 5th snapshot)
    console.log(`\n📊 Connection snapshots (${snapshots.length} total, showing every 5th):`);
    console.table(snapshots.filter((_, i) => i % 5 === 0 || i === snapshots.length - 1).map((s, i) => ({
      time: s.ts,
      active: s.active,
      idle: s.idle,
      waiting: s.waiting,
      longTxns: s.longTxns,
    })));

    // Job error check
    console.log(`\n🔍 Job execution:`);
    console.log(`   Errors: ${jobErrors.length === 0 ? "✅ None" : jobErrors.join("; ")}`);
    console.log(`   P1017/P1001: ${jobErrors.some(e => e.includes("P1017") || e.includes("P1001")) ? "🚨 DETECTED" : "✅ None"}`);

    const avgLatency = jobLatencies.length > 0
      ? Math.round(jobLatencies.reduce((a, b) => a + b.ms, 0) / jobLatencies.length)
      : 0;
    console.log(`   Average latency: ${avgLatency}ms`);

    // ── FINAL VERDICT ──
    console.log("\n==========================================================================================");
    console.log("FINAL VERDICT");
    console.log("==========================================================================================");

    const checks = [
      { name: `No duplicate messages across ${NUM_CONVERSATIONS} conversations`, passed: dupCount === 0 },
      { name: `Exactly ${NUM_CONVERSATIONS} client messages`, passed: totalClient === NUM_CONVERSATIONS },
      { name: `Exactly ${NUM_CONVERSATIONS} bot messages`, passed: totalBot === NUM_CONVERSATIONS },
      { name: "No P1017/P1001 errors", passed: !jobErrors.some(e => e.includes("P1017") || e.includes("P1001")) },
      { name: `Peak connections < 12 (got ${peakActive})`, passed: peakActive < 12 },
    ];

    let allPassed = true;
    for (const check of checks) {
      const icon = check.passed ? "✅" : "❌";
      console.log(`  ${icon} ${check.name}`);
      if (!check.passed) allPassed = false;
    }

    if (allPassed) {
      console.log(`\n🎉 ALL CHECKS PASSED — ${NUM_CONVERSATIONS} concurrent conversations handled within pool limits`);
    } else {
      console.error(`\n❌ ONE OR MORE CHECKS FAILED`);
      process.exit(1);
    }

  } finally {
    await cleanupTestCompany(companyId);
  }

  await prisma.$disconnect();
}

runMultiConversationConcurrencyTest().catch((err) => {
  console.error("MULTI-CONVERSATION TEST ERROR:", err);
  process.exit(1);
});
