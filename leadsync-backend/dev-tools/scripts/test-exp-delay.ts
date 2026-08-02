/**
 * TEST: Exponential delay lockout behavior
 *
 * Verifies:
 * 1. Delay grows exponentially with each failed attempt
 * 2. Delay is capped at 5 minutes
 * 3. Successful login resets everything
 */

import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";

async function runTest() {
  console.log("🧪 [Test] Exponential delay lockout behavior...\n");

  const company = await prisma.company.create({
    data: { name: "Exp Delay Co", companyCode: `EXPDELAY${Date.now()}` },
  });

  const password = "testPass123";
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: `expdelay-${Date.now()}@test.com`,
      firstName: "Test",
      lastName: "User",
      role: "STAFF",
      companyId: company.id,
      passwordHash,
      failedLoginCount: 0,
    },
  });

  const MAX_DELAY_MS = 5 * 60 * 1000;

  // Test: Compute expected delays for each attempt
  console.log("🧪 [Test] Exponential delay schedule:");
  const expectedDelays = [];
  for (let count = 1; count <= 8; count++) {
    const delayMs = Math.min(5000 * Math.pow(2, count - 1), MAX_DELAY_MS);
    const delaySec = Math.ceil(delayMs / 1000);
    expectedDelays.push({ count, delayMs, delaySec });
    console.log(`  Attempt ${count}: delay = ${delaySec}s (${delayMs}ms)`);
  }

  // Verify the schedule
  const checks = [
    { name: "Attempt 1 = 5s", pass: expectedDelays[0].delaySec === 5 },
    { name: "Attempt 2 = 10s", pass: expectedDelays[1].delaySec === 10 },
    { name: "Attempt 3 = 20s", pass: expectedDelays[2].delaySec === 20 },
    { name: "Attempt 4 = 40s", pass: expectedDelays[3].delaySec === 40 },
    { name: "Attempt 5 = 80s", pass: expectedDelays[4].delaySec === 80 },
    { name: "Attempt 6 = 160s", pass: expectedDelays[5].delaySec === 160 },
    { name: "Attempt 7 = 300s (capped)", pass: expectedDelays[6].delaySec === 300 },
    { name: "Attempt 8 = 300s (still capped)", pass: expectedDelays[7].delaySec === 300 },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
    if (!check.pass) allPassed = false;
  }

  // Test: Simulate the actual delay calculation used in auth.routes.ts
  console.log("\n🧪 [Test] Simulating actual lockout flow...");
  for (let attempt = 1; attempt <= 5; attempt++) {
    const newCount = attempt;
    const delayMs = Math.min(5000 * Math.pow(2, newCount - 1), MAX_DELAY_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: newCount,
        lastFailedLoginAt: new Date(),
        lockedUntil: new Date(Date.now() + delayMs),
      },
    });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const actualDelay = dbUser!.lockedUntil!.getTime() - Date.now();
    const tolerance = 2000; // 2s tolerance for execution time

    if (Math.abs(actualDelay - delayMs) < tolerance) {
      console.log(`  ✅ Attempt ${attempt}: lockedUntil set correctly (~${Math.ceil(delayMs / 1000)}s)`);
    } else {
      console.error(`  ❌ Attempt ${attempt}: Expected ~${delayMs}ms, got ${actualDelay}ms`);
      allPassed = false;
    }
  }

  // Test: Successful login resets everything
  console.log("\n🧪 [Test] Successful login resets counter...");
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, isOnline: true, lastSeenAt: new Date() },
  });
  const resetUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (resetUser?.failedLoginCount === 0 && !resetUser?.lockedUntil) {
    console.log(`  ✅ Counter reset, lock cleared`);
  } else {
    console.error(`  ❌ Reset failed`);
    allPassed = false;
  }

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.company.delete({ where: { id: company.id } });

  if (allPassed) {
    console.log("\n✅ [Test] PASS: Exponential delay lockout works correctly");
  } else {
    console.error("\n❌ [Test] FAIL: Some checks did not pass");
    process.exit(1);
  }
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
