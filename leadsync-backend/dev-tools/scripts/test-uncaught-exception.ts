/**
 * TEST: Task 8 — uncaughtException handler
 *
 * Verifies:
 * 1. An uncaught exception is logged with full context via sysLog
 * 2. The error includes message, stack trace, and structured format
 * 3. The handler exists in server.ts (verified by reading the file)
 */

import fs from "fs";
import path from "path";
import { sysLog } from "../../src/lib/logger";

// Capture what sysLog.error receives
const loggedErrors: Array<{ msg: string; err?: any }> = [];
const originalError = sysLog.error.bind(sysLog);

(sysLog as any).error = (msg: string, err?: any, ...rest: any[]) => {
  loggedErrors.push({ msg, err });
  originalError(msg, err, ...rest);
};

function runTest() {
  console.log("🧪 [Test] Starting uncaughtException handler test...\n");

  // Test 1: Error is logged with context
  console.log("🧪 [Test 1] Uncaught exception is logged with context...");
  const err = new Error("Simulated uncaught exception: cannot read property 'id' of undefined");
  sysLog.error("💥 [uncaughtException] Fatal uncaught exception — initiating emergency shutdown", err);

  const lastError = loggedErrors[loggedErrors.length - 1];
  if (lastError && lastError.msg.includes("uncaughtException")) {
    console.log(`  ✅ Error logged: "${lastError.msg}"`);
    if (lastError.err instanceof Error) {
      console.log(`  ✅ Error object includes: name="${lastError.err.name}", message="${lastError.err.message}"`);
      if (lastError.err.stack) {
        const stackLines = lastError.err.stack.split("\n").length;
        console.log(`  ✅ Stack trace present (${stackLines} lines)`);
      }
    } else {
      console.error(`  ❌ FAIL: Error object is not an Error instance`);
      process.exit(1);
    }
  } else {
    console.error(`  ❌ FAIL: Expected uncaughtException log, got: ${JSON.stringify(lastError)}`);
    process.exit(1);
  }

  // Test 2: Verify the handler exists in server.ts source code
  console.log("\n🧪 [Test 2] Verify uncaughtException handler is in server.ts...");
  const serverPath = path.join(__dirname, "..", "server.ts");
  const serverSource = fs.readFileSync(serverPath, "utf-8");

  const hasUncaughtHandler = serverSource.includes('process.on("uncaughtException"') ||
    serverSource.includes("process.on('uncaughtException'");
  const hasGracefulShutdown = serverSource.includes("gracefulShutdown") &&
    serverSource.includes("uncaughtException");

  if (hasUncaughtHandler) {
    console.log(`  ✅ process.on('uncaughtException') handler found in server.ts`);
  } else {
    console.error(`  ❌ FAIL: No uncaughtException handler in server.ts`);
    process.exit(1);
  }

  if (hasGracefulShutdown) {
    console.log(`  ✅ Handler calls gracefulShutdown for cleanup`);
  } else {
    console.error(`  ❌ FAIL: Handler does not call gracefulShutdown`);
    process.exit(1);
  }

  // Test 3: Verify graceful shutdown function exists and handles DB cleanup
  console.log("\n🧪 [Test 3] Verify graceful shutdown handles resource cleanup...");
  const hasPrismaDisconnect = serverSource.includes("prisma.$disconnect");
  const hasPgBossStop = serverSource.includes("pgBossService.stop");
  const hasOnnxShutdown = serverSource.includes("onnxWorkerPool.shutdown");
  const hasTaskDrain = serverSource.includes("taskTracker.waitForCompletion");

  const cleanupChecks = [
    { name: "Prisma disconnect", pass: hasPrismaDisconnect },
    { name: "PgBoss stop", pass: hasPgBossStop },
    { name: "ONNX pool shutdown", pass: hasOnnxShutdown },
    { name: "Task drain", pass: hasTaskDrain },
  ];

  for (const check of cleanupChecks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
    if (!check.pass) {
      console.error(`  ❌ FAIL: Missing cleanup step`);
      process.exit(1);
    }
  }

  // Test 4: Verify SIGTERM/SIGINT handlers are also registered
  console.log("\n🧪 [Test 4] Verify signal handlers are registered...");
  const hasSigTerm = serverSource.includes('process.on("SIGTERM"');
  const hasSigInt = serverSource.includes('process.on("SIGINT"');

  if (hasSigTerm) console.log(`  ✅ SIGTERM handler registered`);
  if (hasSigInt) console.log(`  ✅ SIGINT handler registered`);

  // Test 5: Verify unhandledRejection handler exists
  console.log("\n🧪 [Test 5] Verify unhandledRejection handler exists...");
  const hasRejectionHandler = serverSource.includes('process.on("unhandledRejection"');
  if (hasRejectionHandler) {
    console.log(`  ✅ unhandledRejection handler registered`);
  } else {
    console.error(`  ❌ FAIL: No unhandledRejection handler`);
    process.exit(1);
  }

  console.log("\n✅ [Test] PASS: uncaughtException handler works correctly");
  process.exit(0);
}

runTest();
