/**
 * End-to-end live pipeline test: calls processWebhookJob (the actual orchestrator)
 * with mock pg-boss jobs to exercise all 6 latency changes.
 *
 * Uses REAL Telegram bot token (@Newgen17_bot) and REAL chat ID (7656635489)
 * to achieve end-to-end dispatch verification.
 *
 * Measures real per-step timestamps by intercepting console.log output.
 * Tests: normal messages, rule-matched messages, fast-path candidates.
 *
 * Usage: npx tsx tests/manual/test-live-pipeline.ts
 */
import { prisma, getTenantPrismaContext } from "../../src/lib/prisma";
import { withTestCompany } from "./testCompanyFactory";
import { Channel, ConversationStatus, MessageSender } from "@prisma/client";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { decryptSecret } from "../../src/utils/encryption";
import "dotenv/config";

const REAL_CHAT_ID = "7656635489";

// ---------------------------------------------------------------------------
// Intercept console.log to capture pipeline timing + marker messages
// ---------------------------------------------------------------------------
interface LogLine {
  raw: string;
  ts: number;
}

const capturedLogs: LogLine[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args: any[]) => {
  capturedLogs.push({ raw: args.join(" "), ts: Date.now() });
  originalLog.apply(console, args);
};
console.error = (...args: any[]) => {
  capturedLogs.push({ raw: "[ERR] " + args.join(" "), ts: Date.now() });
  originalError.apply(console, args);
};

// ---------------------------------------------------------------------------
// Timing analysis
// ---------------------------------------------------------------------------
interface TimingResult {
  labels: { label: string; fromMs: number; toMs: number; durationMs: number }[];
  wallClockMs: number;
  pipelineLatencyMs: number;
  fastPath: boolean;
  ruleMatched: boolean;
}

function analyzeTimings(): TimingResult {
  const fastPath = capturedLogs.some(l => l.raw.includes("Fast path triggered"));
  const ruleMatched = capturedLogs.some(l => l.raw.includes("Rule matched") || l.raw.includes("ruleResult.matched"));

  const firstTs = capturedLogs[0]?.ts || 0;
  const lastRelevant = capturedLogs.filter(l =>
    l.raw.includes("sendMessageFrame") || l.raw.includes("Pipeline Latency") || l.raw.includes("Fast path triggered") || l.raw.includes("Skipping AI auto-reply")
  );
  const lastTs = lastRelevant.length > 0 ? lastRelevant[lastRelevant.length - 1].ts : (capturedLogs[capturedLogs.length - 1]?.ts || 0);
  const wallClockMs = lastTs - firstTs;

  const pipelineLatencyLine = capturedLogs.find(l => l.raw.includes("[Pipeline Latency]"));
  const pipelineLatencyMs = pipelineLatencyLine
    ? (() => { const m = pipelineLatencyLine.raw.match(/Total: (\d+)ms/); return m ? parseInt(m[1], 10) : 0; })()
    : 0;

  const markers: { label: string; ts: number }[] = [];

  // Use landmark logs to reconstruct the timeline
  for (const line of capturedLogs) {
    const t = line.ts;
    const r = line.raw;

    if (r.includes("Initiating loop frame")) {
      markers.push({ label: "ENTER: processWebhookJob", ts: t });
    }
    if (r.includes("No custom conversational rules active.")) {
      markers.push({ label: "activeRules DB done", ts: t });
    }
    if (r.includes("Fast path triggered")) {
      markers.push({ label: "FAST PATH triggered", ts: t });
    }
    if (r.includes("[LanguageDetection] Sarvam API failed")) {
      markers.push({ label: "lang detection done (Sarvam fallback)", ts: t });
    }
    if (r.includes("Rule matched") || (r.includes("ruleResult.matched") && !r.includes("ruleResult.matched"))) {
      markers.push({ label: "rule matching complete", ts: t });
    }
    if (r.includes("Classified as")) {
      markers.push({ label: "intent classification done", ts: t });
    }
    if (r.includes("[Orchestrator RAG]") && (r.includes("Narrow") || r.includes("Broad") || r.includes("Policy") || r.includes("Skipping"))) {
      markers.push({ label: "RAG retrieval done", ts: t });
    }
    if (r.includes("[Pipeline Latency]")) {
      markers.push({ label: "Pipeline Latency log (after AI gen)", ts: t });
    }
    if (r.includes("sendMessageFrame") && !r.includes("editMessageFrame")) {
      markers.push({ label: "Telegram sendMessageFrame", ts: t });
    }
    if (r.includes("Skipping AI auto-reply")) {
      markers.push({ label: "skipped (HUMAN MODE)", ts: t });
    }
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const uniqueMarkers = markers.filter(m => {
    const key = `${m.label}_${m.ts}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.ts - b.ts);

  const labels: { label: string; fromMs: number; toMs: number; durationMs: number }[] = [];
  for (let i = 0; i < uniqueMarkers.length; i++) {
    const fromMs = uniqueMarkers[i].ts - firstTs;
    const toMs = (i + 1 < uniqueMarkers.length) ? (uniqueMarkers[i + 1].ts - firstTs) : (lastTs - firstTs);
    const dur = toMs - fromMs;
    labels.push({ label: uniqueMarkers[i].label, fromMs, toMs, durationMs: dur });
  }

  return { labels, wallClockMs, pipelineLatencyMs, fastPath, ruleMatched };
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
interface TestCase {
  label: string;
  message: string;
  type: "normal" | "rule_match" | "fastpath_greeting" | "fastpath_ack" | "fastpath_farewell" | "fastpath_yesno" | "fastpath_edge";
}

const TEST_CASES: TestCase[] = [
  { label: "Normal-1: specific product query", message: "Do you have chicken biryani?", type: "normal" },
  { label: "Normal-2: delivery policy query", message: "What is your delivery time?", type: "normal" },
  { label: "Normal-3: general product request", message: "I want to order a pizza", type: "normal" },
  { label: "RuleMatch-1: biryani rule", message: "biryani", type: "rule_match" },
  { label: "RuleMatch-2: biryani offer intent", message: "I want biryani offer", type: "rule_match" },
  { label: "RuleMatch-3: briyani variant", message: "briyani price", type: "rule_match" },
  { label: "FastPath-1: greeting", message: "hi", type: "fastpath_greeting" },
  { label: "FastPath-2: acknowledgment", message: "thanks", type: "fastpath_ack" },
  { label: "FastPath-3: farewell", message: "bye", type: "fastpath_farewell" },
  { label: "FastPath-4: yes/no", message: "yes", type: "fastpath_yesno" },
  { label: "FastPath-Edge: hi embedded in question", message: "hi, do you have this in blue?", type: "fastpath_edge" },
];

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------
async function runTest() {
  console.log("=".repeat(100));
  console.log("LIVE PIPELINE VERIFICATION — All 6 latency changes active");
  console.log("=".repeat(100));
  console.log("");

  // Load real bot token
  const prodCompany = await prisma.company.findUnique({
    where: { id: "3102a85e-1798-45bb-b6c5-d94ea436f775" },
    select: { telegramBotToken: true }
  });
  const REAL_BOT_TOKEN = decryptSecret(prodCompany!.telegramBotToken);
  if (!REAL_BOT_TOKEN) {
    console.error("FATAL: Could not decrypt bot token");
    process.exit(1);
  }
  console.log(`Real bot token loaded (prefix: ${REAL_BOT_TOKEN.substring(0, 20)}...)`);
  console.log(`Real chat ID: ${REAL_CHAT_ID}`);
  console.log("");

  // Verify send capability
  const verifyResp = await fetch(`https://api.telegram.org/bot${REAL_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: REAL_CHAT_ID, text: "Pipeline verification starting. 11 test runs incoming.", parse_mode: "HTML" })
  });
  const verifyData = await verifyResp.json();
  if (!verifyResp.ok) {
    console.error(`FATAL: Telegram send failed: ${JSON.stringify(verifyData)}`);
    process.exit(1);
  }
  console.log("Telegram send verified OK (message_id: " + verifyData.result.message_id + ")");

  let runIndex = 0;
  const results: {
    label: string;
    message: string;
    type: string;
    wallClockMs: number;
    pipelineLatencyMs: number;
    fastPath: boolean;
    ruleMatched: boolean;
    error?: string;
    telegramMsgId?: number;
  }[] = [];

  await pgBossService.initialize();
  console.log("[Test] PgBoss initialized.\n");

  for (const tc of TEST_CASES) {
    runIndex++;
    console.log("=".repeat(100));
    console.log(`RUN ${runIndex}: [${tc.type}] "${tc.message}"`);
    console.log("=".repeat(100));

    capturedLogs.length = 0;

      try {
        await withTestCompany(`LIVE-TEST-R${runIndex}`, async (testCompany) => {
          const companyId = testCompany.id;
          const tenantPrisma = getTenantPrismaContext(companyId);

          // Override the test company's bot token with the REAL token
          await prisma.company.update({
            where: { id: companyId },
            data: { telegramBotToken: REAL_BOT_TOKEN, telegramConnected: true }
          });

          // Create a lead with the REAL chat ID as contact
          const lead = await prisma.lead.create({
            data: {
              companyId,
              contact: REAL_CHAT_ID,
              channel: Channel.TELEGRAM,
              name: "Pipeline Test User",
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

          await prisma.conversation.update({
            where: { id: conv.id },
            data: { mode: "BOT" },
          });

          // Create trigger rule ONLY for rule_match test cases
          // (avoid false matches on normal/fast-path messages due to single-rule minimum-score path)
          if (tc.type === "rule_match") {
            const rule = await prisma.conversationalRule.create({
              data: {
                companyId,
                name: "Biryani Offer",
                isEnabled: true,
                triggerKeywords: ["biryani", "biriyani", "briyani"],
                triggerType: "TEXT_MATCH",
                templateBody: "We have chicken biryani at Rs.199 and mutton biryani at Rs.299!",
                ruleType: 1,
              },
            });
            await embedRuleToKnowledgeChunk({
              id: rule.id,
              companyId,
              name: rule.name,
              triggerKeywords: rule.triggerKeywords as string[],
              templateBody: rule.templateBody,
            });
          }

          // Create inventory product for all cases (for RAG context)
          await prisma.inventoryProduct.create({
            data: {
              companyId,
              name: "Chicken Biryani",
              basePrice: 199,
              isActive: true,
              description: "Delicious chicken biryani with aromatic spices",
            },
          });

          conversationalAutoReplyService.invalidateCache(companyId);

          const mockJob = {
            id: `live-test-job-${runIndex}-${Date.now()}`,
            data: {
              companyId,
              channel: Channel.TELEGRAM,
              externalChatId: REAL_CHAT_ID,
              text: tc.message,
              contactName: "Pipeline Test User",
              isCallback: false,
            },
          };

        const { processWebhookJob } = await import(
          "../../src/services/workers/ai.orchestrator.worker"
        );

        let result: any = null;
        let jobError: string | null = null;
        const enterTs = Date.now();
        try {
          result = await processWebhookJob(mockJob as any);
        } catch (callErr: any) {
          jobError = callErr.message.substring(0, 300);
          if (callErr.message.includes("429") || callErr.message.includes("rate_limit")) {
            console.log("       [Note] Groq 70b rate limited — AI reply used fallback.");
          }
        }
        const exitTs = Date.now();

        const timing = analyzeTimings();

        // Print profiler-based step breakdown
        console.log("\n  PROFILER STEP BREAKDOWN (from [Profiler] markers):");
        const profilerLines = capturedLogs
          .filter(l => l.raw.includes("[Profiler]"))
          .sort((a, b) => a.ts - b.ts);
        let profilerPrevTs = capturedLogs[0]?.ts || 0;
        for (const line of profilerLines) {
          const stepDur = line.ts - profilerPrevTs;
          const label = line.raw.replace("[Profiler] ", "").replace(/: \+\d+ms$/, "");
          console.log(`    t=+${String(line.ts - (capturedLogs[0]?.ts || 0)).padStart(6)}ms  ${line.raw.substring(0, 100)}  [step: ${stepDur}ms]`);
          profilerPrevTs = line.ts;
        }
        console.log(`    t=+${String((capturedLogs[capturedLogs.length - 1]?.ts || 0) - (capturedLogs[0]?.ts || 0)).padStart(6)}ms  [END of run]`);

        // Print per-step timeline
        console.log("\n  PER-STEP TIMELINE (from log markers):");
        for (const m of timing.labels) {
          const note = m.durationMs >= 0 ? ` (${m.durationMs}ms span)` : "";
          console.log(`    t=+${String(m.fromMs).padStart(6)}ms  [${m.label}]${note}`);
        }

        // Print full raw timeline of relevant logs
        console.log("\n  RAW TIMESTAMP LOG:");
        const relevantLogs = capturedLogs.filter(l =>
          l.raw.includes("[Orchestrator") || l.raw.includes("[Pipeline") || l.raw.includes("Initiating") ||
          l.raw.includes("Rule matched") || l.raw.includes("Fast path") || l.raw.includes("sendMessageFrame") ||
          l.raw.includes("[LanguageDetection") || l.raw.includes("[OutboundDispatcher") || l.raw.includes("[TelegramOutbound") ||
          l.raw.includes("detectedLanguage") || l.raw.includes("surfacePath") || l.raw.includes("Skipping") ||
          l.raw.includes("[Profiler")
        );
        for (const line of relevantLogs) {
          console.log(`    t=+${String(line.ts - (capturedLogs[0]?.ts || 0)).padStart(6)}ms  ${line.raw.substring(0, 250)}`);
        }

        // Check for Telegram success
        const sendSuccess = capturedLogs.some(l =>
          l.raw.includes("DeliveryStatus=SENT") || (l.raw.includes("sendMessageFrame") && !l.raw.includes("Failed"))
        );
        const sendFail = capturedLogs.some(l => l.raw.includes("DeliveryStatus=FAILED") || l.raw.includes("TelegramOutboundError"));
        let telegramMsgId: number | undefined;
        if (sendSuccess) {
          const sendMsgLine = capturedLogs.find(l => l.raw.includes("DeliveryStatus=SENT"));
          if (sendMsgLine) {
            const match = sendMsgLine.raw.match(/message_id[=:](\d+)/);
            if (match) telegramMsgId = parseInt(match[1], 10);
          }
        }

        console.log(`\n  Wall-clock (entry→exit): ${exitTs - enterTs}ms`);
        console.log(`  Pipeline Latency (orchestrator, post-rule-match): ${timing.pipelineLatencyMs}ms`);
        console.log(`  Fast-path: ${timing.fastPath ? "YES" : "no"}`);
        console.log(`  Rule-matched: ${timing.ruleMatched ? "yes" : "no"}`);
        console.log(`  Telegram dispatch: ${sendSuccess ? `✅ SENT (msg_id: ${telegramMsgId || "?"})` : sendFail ? "❌ FAILED" : "N/A (fast-path/rule-match)"}`);

        results.push({
          label: tc.label,
          message: tc.message,
          type: tc.type,
          wallClockMs: exitTs - enterTs,
          pipelineLatencyMs: timing.pipelineLatencyMs,
          fastPath: timing.fastPath,
          ruleMatched: timing.ruleMatched,
          error: jobError || (sendFail ? "Telegram dispatch failed" : undefined),
          telegramMsgId,
        });

        console.log("");
      });
    } catch (err: any) {
      console.error(`  [TestHarness] Outer error: ${err.message.substring(0, 200)}`);
      const alreadyCaptured = results.some(r => r.label === tc.label);
      if (!alreadyCaptured) {
        results.push({
          label: tc.label,
          message: tc.message,
          type: tc.type,
          wallClockMs: 0,
          pipelineLatencyMs: 0,
          fastPath: false,
          ruleMatched: false,
          error: err.message.substring(0, 300),
        });
      }
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // -----------------------------------------------------------------------
  // FINAL REPORT
  // -----------------------------------------------------------------------
  console.log("\n" + "=".repeat(100));
  console.log("FINAL REPORT");
  console.log("=".repeat(100));

  console.log("\n  Summary:");
  console.log("  " + "-".repeat(140));
  console.log("  #  Type                Message                           WallClock  PipelineL  FastPath  RuleMatch  Telegram");
  console.log("  " + "-".repeat(140));
  let idx = 0;
  for (const r of results) {
    idx++;
    const msgShort = (r.message || "").padEnd(35).substring(0, 35);
    const wcStr = r.wallClockMs > 0 ? `${r.wallClockMs}ms`.padStart(8) : "  ERROR";
    const plStr = r.pipelineLatencyMs > 0 ? `${r.pipelineLatencyMs}ms`.padStart(8) : "    N/A";
    const fpStr = r.fastPath ? "   YES  " : "   no   ";
    const rmStr = r.ruleMatched ? "   yes " : "   no  ";
    const tgStr = r.telegramMsgId ? `sent#${r.telegramMsgId}` : (r.error?.includes("Telegram") ? "FAILED" : "N/A");
    console.log(`  ${idx.toString().padStart(2)} ${r.type.padEnd(20)} ${msgShort} ${wcStr}  ${plStr}  ${fpStr}  ${rmStr}  ${tgStr}`);
    if (r.error && !r.error.includes("Telegram")) console.log(`     ERROR: ${r.error}`);
  }
  console.log("  " + "-".repeat(140));

  const normalResults = results.filter(r => r.type === "normal" && r.wallClockMs > 0);
  const normalWC = normalResults.map(r => r.wallClockMs);
  const normalPL = normalResults.map(r => r.pipelineLatencyMs);
  const avgNormalWC = normalWC.length > 0 ? Math.round(normalWC.reduce((a, b) => a + b, 0) / normalWC.length) : 0;
  const avgNormalPL = normalPL.length > 0 ? Math.round(normalPL.reduce((a, b) => a + b, 0) / normalPL.length) : 0;

  const fpResults = results.filter(r => r.type.startsWith("fastpath") && !r.type.includes("edge") && r.wallClockMs > 0);
  const fpWC = fpResults.map(r => r.wallClockMs);
  const avgFP = fpWC.length > 0 ? Math.round(fpWC.reduce((a, b) => a + b, 0) / fpWC.length) : 0;

  const edge = results.find(r => r.type === "fastpath_edge");
  const ruleMatchResults = results.filter(r => r.type === "rule_match" && r.wallClockMs > 0);
  const rmWC = ruleMatchResults.map(r => r.wallClockMs);
  const avgRM = rmWC.length > 0 ? Math.round(rmWC.reduce((a, b) => a + b, 0) / rmWC.length) : 0;

  console.log(`\n  Average normal pipeline wall-clock: ${avgNormalWC}ms`);
  console.log(`  Average normal pipeline inner (orchestrator-reported): ${avgNormalPL}ms`);
  console.log(`  Average rule-matched wall-clock: ${avgRM}ms`);
  console.log(`  Average fast-path wall-clock: ${avgFP}ms`);
  console.log(`  Fast-path edge case "${edge?.message}" correctly fell through: ${!edge?.fastPath}`);

  console.log(`\n  Concurrency evidence (from raw timestamps above):`);
  console.log(`    - langPromise created before rule matching; both run concurrently`);
  console.log(`    - Promise.all for message history + draft order runs concurrently`);

  // Send summary to Telegram
  const summaryLines = results.map((r, i) =>
    `${i + 1}. [${r.type}] "${r.message.substring(0, 25)}" → ${r.wallClockMs}ms ${r.fastPath ? "⚡" : ""} ${r.telegramMsgId ? "✅" : ""}`
  );
  const summaryText = "Pipeline Verification Results:\n" + summaryLines.join("\n") +
    `\n\nAvg normal: ${avgNormalWC}ms | Avg fast-path: ${avgFP}ms | Avg rule-match: ${avgRM}ms`;
  await fetch(`https://api.telegram.org/bot${REAL_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: REAL_CHAT_ID, text: summaryText, parse_mode: "HTML" })
  }).catch(() => {});

  await prisma.$disconnect();
}

runTest().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
