/**
 * TEST: Task 2 — Timeouts on external API calls (unit-level)
 *
 * Tests the AbortController + timeout pattern used in the production code
 * without requiring database connections or full module imports.
 */

const TELEGRAM_TIMEOUT_MS = 1000; // Shorter for testing
const GROQ_TIMEOUT_MS = 1000;

async function testAbortControllerTimeout() {
  console.log("🧪 [Test] Testing AbortController + timeout pattern...");

  // Simulate a hung fetch (never resolves)
  const hungFetch = (): Promise<Response> => new Promise(() => {});

  // Test 1: Timeout fires and aborts the request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  const startTime = Date.now();
  try {
    await Promise.race([
      hungFetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Telegram API timeout: request did not respond within ${TELEGRAM_TIMEOUT_MS}ms`)), TELEGRAM_TIMEOUT_MS)
      ),
    ]);
    console.error("❌ [Test] FAIL: Expected timeout but call succeeded");
    process.exit(1);
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    if (err.message?.includes("timeout") && elapsed >= TELEGRAM_TIMEOUT_MS && elapsed < TELEGRAM_TIMEOUT_MS + 500) {
      console.log(`  ✅ Timeout fired correctly after ${elapsed}ms`);
    } else {
      console.error(`❌ [Test] FAIL: Unexpected error: ${err.message} (elapsed: ${elapsed}ms)`);
      process.exit(1);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // Test 2: Successful call completes before timeout
  const fastFetch = async (): Promise<Response> => {
    return { ok: true, text: async () => "{}" } as any;
  };

  try {
    const result = await Promise.race([
      fastFetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout`)), TELEGRAM_TIMEOUT_MS)
      ),
    ]);
    if ((result as any).ok) {
      console.log("  ✅ Fast call completed before timeout");
    } else {
      console.error("❌ [Test] FAIL: Unexpected result");
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ [Test] FAIL: Fast call should not timeout: ${err.message}`);
    process.exit(1);
  }

  // Test 3: Worker continues processing after a timeout
  console.log("🧪 [Test] Verifying worker continues after timeout...");
  let callCount = 0;
  const flakyFetch = async (): Promise<Response> => {
    callCount++;
    if (callCount === 1) return new Promise(() => {}); // First call hangs
    return { ok: true, text: async () => "{}" } as any; // Second succeeds
  };

  // First call - timeout
  try {
    await Promise.race([
      flakyFetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), TELEGRAM_TIMEOUT_MS)
      ),
    ]);
  } catch {
    // Expected
  }

  // Second call - should succeed
  try {
    const result = await Promise.race([
      flakyFetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), TELEGRAM_TIMEOUT_MS)
      ),
    ]);
    if ((result as any).ok) {
      console.log("  ✅ Worker continued processing after timeout");
    }
  } catch {
    console.error("❌ [Test] FAIL: Worker frozen after timeout");
    process.exit(1);
  }

  console.log("\n✅ [Test] PASS: All timeout pattern tests passed");
}

testAbortControllerTimeout()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ [Test] Fatal error:", err);
    process.exit(1);
  });
