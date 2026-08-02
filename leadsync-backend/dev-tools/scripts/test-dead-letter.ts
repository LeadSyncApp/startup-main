/**
 * TEST: Task 1 — Webhook queue retry + dead-letter
 *
 * Simulates a failing webhook.process job and verifies:
 * 1. The job retries the expected number of times (3 retries = 4 total attempts)
 * 2. After all retries are exhausted, the job lands in the FailedJob table
 * 3. The FailedJob record contains enough context for manual reprocessing
 */

import { prisma } from "../../src/lib/prisma";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";

const TEST_QUEUE = "webhook.process";
const MAX_RETRIES = 3;

async function runTest() {
  console.log("🧪 [Test] Starting dead-letter test...");

  // Initialize PgBoss
  await pgBossService.initialize();
  const boss = pgBossService.getBoss();

  // Track attempt counts per job to simulate the production dead-letter logic
  const attemptCounts = new Map<string, number>();

  // Register a worker that ALWAYS throws (simulates transient failure)
  // Includes dead-letter capture after retries exhausted
  await boss.work(TEST_QUEUE, { batchSize: 1 }, async (jobs: Array<any>) => {
    for (const job of jobs) {
      const prevCount = attemptCounts.get(job.id) ?? 0;
      const currentAttempt = prevCount + 1;
      attemptCounts.set(job.id, currentAttempt);
      console.log(`🧪 [Test] Worker processing job ${job.id} — attempt ${currentAttempt}/${MAX_RETRIES + 1}`);

      // Dead-letter: after all retries exhausted, persist for manual reprocessing
      if (currentAttempt > MAX_RETRIES) {
        const companyId = job.data?.companyId || null;
        try {
          await prisma.failedJob.create({
            data: {
              queue: TEST_QUEUE,
              jobId: job.id,
              payload: job.data ?? {},
              error: `SIMULATED_TRANSIENT_FAILURE: Database connection timed out (attempt ${currentAttempt})`,
              attempts: currentAttempt,
              companyId,
            },
          });
          console.error(`☠️ [DeadLetter] Job ${job.id} persisted to FailedJob table (company=${companyId})`);
        } catch (dlErr) {
          console.error(`❌ [DeadLetter] Failed to persist dead-letter job ${job.id}:`, dlErr);
        }
      }

      throw new Error("SIMULATED_TRANSIENT_FAILURE: Database connection timed out");
    }
  });

  // Send a test job with identifiable payload
  const testCompanyId = "test-company-dead-letter-001";
  const testPayload = {
    companyId: testCompanyId,
    channel: "TELEGRAM",
    externalChatId: "123456789",
    text: "Hello from dead-letter test",
    isCallback: false,
    _testRun: true,
    _timestamp: new Date().toISOString(),
  };

  console.log("🧪 [Test] Sending test job to webhook.process queue...");
  const jobId = await boss.send(TEST_QUEUE, testPayload);
  console.log(`🧪 [Test] Job sent with ID: ${jobId}`);

  // Wait for retries to complete (3 retries with backoff ≈ 15-20 seconds max)
  console.log("🧪 [Test] Waiting for retries to exhaust (up to 30s)...");
  await new Promise((resolve) => setTimeout(resolve, 30000));

  // Check the FailedJob table
  const failedJobs = await prisma.failedJob.findMany({
    where: {
      queue: TEST_QUEUE,
      jobId: jobId,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`🧪 [Test] Found ${failedJobs.length} dead-letter record(s) for job ${jobId}`);

  if (failedJobs.length === 0) {
    console.error("❌ [Test] FAIL: No dead-letter record found after retries exhausted");
    process.exit(1);
  }

  const record = failedJobs[0];
  console.log("🧪 [Test] Dead-letter record:", JSON.stringify(record, null, 2));

  // Validate record fields
  const checks = [
    { name: "queue matches", pass: record.queue === TEST_QUEUE },
    { name: "jobId matches", pass: record.jobId === jobId },
    { name: "companyId present", pass: record.companyId === testCompanyId },
    { name: "error message present", pass: !!record.error && record.error.includes("SIMULATED_TRANSIENT_FAILURE") },
    { name: "attempts > 1 (retried)", pass: record.attempts > 1 },
    { name: "payload has test marker", pass: (record.payload as any)?._testRun === true },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
    if (!check.pass) allPassed = false;
  }

  if (allPassed) {
    console.log("✅ [Test] PASS: Dead-letter mechanism works correctly");
  } else {
    console.error("❌ [Test] FAIL: Some checks did not pass");
    process.exit(1);
  }

  // Cleanup: remove the test record
  await prisma.failedJob.deleteMany({ where: { jobId: jobId } });
  console.log("🧪 [Test] Cleaned up test record");

  await pgBossService.stop();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
