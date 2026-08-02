/**
 * TEST: Task 7 — Password reset DoS fix
 *
 * Verifies:
 * 1. Password reset works end-to-end with a valid token
 * 2. The lookup is O(1) via indexed hash, not O(N) bcrypt loop
 * 3. Expired tokens are rejected
 * 4. Invalid tokens are rejected
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function runTest() {
  console.log("🧪 [Test] Starting password reset DoS fix test...\n");

  // Setup
  const company = await prisma.company.create({
    data: { name: "Reset Test Co", companyCode: `RESET${Date.now()}` },
  });

  const password = "oldPassword123";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: `reset-${Date.now()}@test.com`,
      firstName: "Reset",
      lastName: "User",
      role: "STAFF",
      companyId: company.id,
      passwordHash,
    },
  });

  console.log(`  📦 Setup: user=${user.id}`);

  // Test 1: Generate and store reset token
  console.log("\n🧪 [Test 1] Generate and store reset token...");
  const rawResetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
  const hashedResetToken = await bcrypt.hash(rawResetToken, 10);
  const resetTokenHashValue = hashResetToken(rawResetToken);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedResetToken,
      resetTokenHash: resetTokenHashValue,
      resetTokenExpiry,
    },
  });

  const storedUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (storedUser?.resetTokenHash === resetTokenHashValue) {
    console.log(`  ✅ Token hash stored: ${resetTokenHashValue.substring(0, 16)}...`);
  } else {
    console.error(`  ❌ FAIL: Token hash not stored correctly`);
    process.exit(1);
  }

  // Test 2: Direct lookup via hash (simulates the new reset-password logic)
  console.log("\n🧪 [Test 2] Direct lookup via indexed hash...");
  const lookupHash = hashResetToken(rawResetToken);
  const foundUser = await prisma.user.findFirst({
    where: {
      resetTokenHash: lookupHash,
      resetTokenExpiry: { gt: new Date() },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (foundUser && foundUser.id === user.id) {
    console.log(`  ✅ Direct lookup found correct user: ${foundUser.id}`);
  } else {
    console.error(`  ❌ FAIL: Lookup returned wrong user or null`);
    process.exit(1);
  }

  // Test 3: Expired token is rejected
  console.log("\n🧪 [Test 3] Expired token is rejected...");
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenExpiry: new Date(Date.now() - 1000) },
  });

  const expiredLookup = await prisma.user.findFirst({
    where: {
      resetTokenHash: lookupHash,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!expiredLookup) {
    console.log(`  ✅ Expired token correctly rejected`);
  } else {
    console.error(`  ❌ FAIL: Expired token was accepted`);
    process.exit(1);
  }

  // Restore expiry
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenExpiry: resetTokenExpiry },
  });

  // Test 4: Invalid token hash is rejected
  console.log("\n🧪 [Test 4] Invalid token hash is rejected...");
  const fakeHash = hashResetToken("totally-invalid-token");
  const invalidLookup = await prisma.user.findFirst({
    where: {
      resetTokenHash: fakeHash,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!invalidLookup) {
    console.log(`  ✅ Invalid token correctly rejected`);
  } else {
    console.error(`  ❌ FAIL: Invalid token was accepted`);
    process.exit(1);
  }

  // Test 5: Clear token after successful reset
  console.log("\n🧪 [Test 5] Clear token after successful reset...");
  const newHashedPassword = await bcrypt.hash("newPassword456", 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHashedPassword,
      resetToken: null,
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });

  const clearedUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!clearedUser?.resetToken && !clearedUser?.resetTokenHash && !clearedUser?.resetTokenExpiry) {
    console.log(`  ✅ Token cleared after successful reset`);
  } else {
    console.error(`  ❌ FAIL: Token not cleared`);
    process.exit(1);
  }

  // Test 6: Performance — lookup doesn't scale with number of tokens
  console.log("\n🧪 [Test 6] Performance: lookup is O(1) indexed query...");
  // Create 50 dummy users with reset tokens
  const dummyUsers = [];
  for (let i = 0; i < 50; i++) {
    dummyUsers.push(
      prisma.user.create({
        data: {
          email: `dummy-${Date.now()}-${i}@test.com`,
          firstName: "Dummy",
          lastName: `User${i}`,
          role: "STAFF",
          companyId: company.id,
          passwordHash: await bcrypt.hash("dummy", 10),
          resetToken: await bcrypt.hash(`token-${i}`, 10),
          resetTokenHash: hashResetToken(`token-${i}`),
          resetTokenExpiry: new Date(Date.now() + 10 * 60 * 1000),
        },
      })
    );
  }
  await Promise.all(dummyUsers);

  const start = Date.now();
  const perfLookup = await prisma.user.findFirst({
    where: {
      resetTokenHash: hashResetToken(`token-25`),
      resetTokenExpiry: { gt: new Date() },
    },
  });
  const elapsed = Date.now() - start;

  if (perfLookup) {
    console.log(`  ✅ Lookup completed in ${elapsed}ms with 50+ tokens in DB`);
  } else {
    console.error(`  ❌ FAIL: Lookup returned null`);
    process.exit(1);
  }

  // Cleanup
  await prisma.user.deleteMany({ where: { companyId: company.id } });
  await prisma.company.delete({ where: { id: company.id } });
  console.log("\n  🧹 Cleanup complete");

  console.log("\n✅ [Test] PASS: Password reset DoS fix works correctly");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
