import { prisma } from "../../src/lib/prisma";
import { decryptSecret } from "../../src/utils/encryption";
import { FastPathService } from "../../src/services/messaging/fastPath.service";
import "dotenv/config";

const REAL_CHAT_ID = "7656635489";
const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";

async function runBenchmark() {
  console.log("==========================================================================================");
  console.log("WARMED TELEGRAM FAST-PATH REDESIGN BENCHMARK (5 Repeated Sends of 'hi')");
  console.log("==========================================================================================");

  // Pre-warm DB connection pool and token cache
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, telegramBotToken: true }
  });

  if (!company || !company.telegramBotToken) {
    console.error("FATAL: Could not find company or bot token");
    process.exit(1);
  }

  const token = decryptSecret(company.telegramBotToken);
  if (!token) {
    console.error("FATAL: Could not decrypt token");
    process.exit(1);
  }
  console.log(`Loaded real bot token (prefix: ${token.substring(0, 15)}...)`);
  console.log(`Pre-warmed DB connection pool. Starting test...\n`);

  const results: { run: number; message: string; wallClockMs: number; handled: boolean; category?: string }[] = [];

  // Run 5 repeated fast-path sends of "hi"
  for (let i = 1; i <= 5; i++) {
    const rawPayload = {
      update_id: 999000 + i,
      message: {
        message_id: 88000 + i,
        from: { id: parseInt(REAL_CHAT_ID), first_name: "WarmedBenchmarkUser" },
        chat: { id: parseInt(REAL_CHAT_ID), type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "hi"
      }
    };

    const start = performance.now();
    const result = await FastPathService.tryHandleFastPath({
      companyId: COMPANY_ID,
      rawPayload
    });
    const elapsed = Math.round(performance.now() - start);

    results.push({
      run: i,
      message: "hi",
      wallClockMs: elapsed,
      handled: result.handled,
      category: result.category
    });

    console.log(`Run ${i}: "hi" -> Handled=${result.handled} (${result.category}) in ${elapsed}ms`);

    // Short pause between sends
    await new Promise(r => setTimeout(r, 500));
  }

  // Safety Verification Run: Non-fast-path message must fall through (handled: false)
  console.log("\nSafety Verification: Testing complex query falling through...");
  const nonFastPathPayload = {
    update_id: 999999,
    message: {
      message_id: 88999,
      from: { id: parseInt(REAL_CHAT_ID), first_name: "WarmedBenchmarkUser" },
      chat: { id: parseInt(REAL_CHAT_ID), type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: "Do you have chicken biryani?"
    }
  };

  const fallthroughResult = await FastPathService.tryHandleFastPath({
    companyId: COMPANY_ID,
    rawPayload: nonFastPathPayload
  });

  console.log(`Fallthrough test: "Do you have chicken biryani?" -> Handled=${fallthroughResult.handled} (Correct behavior: false)`);

  console.log("\n==========================================================================================");
  console.log("BENCHMARK SUMMARY REPORT");
  console.log("==========================================================================================");
  console.table(results);

  const times = results.map(r => r.wallClockMs);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log(`\nAverage Fast-Path End-to-End Latency: ${avgTime}ms`);
  console.log(`Min: ${minTime}ms | Max: ${maxTime}ms`);
  console.log(`Original Baseline Latency: 9,900ms - 13,600ms (Average ~11,700ms)`);
  console.log(`Speedup Factor: ${(11700 / avgTime).toFixed(1)}x faster!`);

  await FastPathService.flushPendingBackgroundTasks();
  await prisma.$disconnect();
}

runBenchmark().catch(err => {
  console.error("BENCHMARK ERROR:", err);
  process.exit(1);
});
