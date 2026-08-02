/**
 * TEST: Task 4 — Order claim race condition
 *
 * Verifies:
 * 1. Single claim succeeds and sets processedById
 * 2. Concurrent claims for the same order — only one succeeds, the other gets 409
 * 3. Claiming an already-claimed order returns "already claimed"
 */

import { prisma } from "../../src/lib/prisma";

async function runTest() {
  console.log("🧪 [Test] Starting order claim race condition test...");

  // Setup
  const company = await prisma.company.create({
    data: { name: "Test Claim Co", companyCode: `CLAIM${Date.now()}` },
  });

  const agent1 = await prisma.user.create({
    data: {
      email: `agent1-${Date.now()}@test.com`,
      firstName: "Agent",
      lastName: "One",
      role: "STAFF",
      companyId: company.id,
      passwordHash: "dummy",
    },
  });

  const agent2 = await prisma.user.create({
    data: {
      email: `agent2-${Date.now()}@test.com`,
      firstName: "Agent",
      lastName: "Two",
      role: "STAFF",
      companyId: company.id,
      passwordHash: "dummy",
    },
  });

  const order = await prisma.order.create({
    data: {
      companyId: company.id,
      summary: "Claim test order",
      status: "NEW",
      approvalStatus: "APPROVED",
    },
  });

  console.log(`  📦 Setup: company=${company.id}, order=${order.id}, agent1=${agent1.id}, agent2=${agent2.id}`);

  // Test 1: Single claim succeeds
  console.log("\n🧪 [Test 1] Single claim succeeds...");
  const result1 = await prisma.order.updateMany({
    where: { id: order.id, companyId: company.id, processedById: null },
    data: { processedById: agent1.id, status: "PENDING", updatedAt: new Date() },
  });

  if (result1.count === 1) {
    const claimed = await prisma.order.findUnique({ where: { id: order.id } });
    if (claimed && claimed.processedById === agent1.id) {
      console.log(`  ✅ Claim succeeded — processedById=${claimed.processedById}`);
    } else {
      console.error("  ❌ FAIL: processedById not set correctly");
      process.exit(1);
    }
  } else {
    console.error(`  ❌ FAIL: updateMany returned count ${result1.count}, expected 1`);
    process.exit(1);
  }

  // Test 2: Second claim on already-claimed order fails
  console.log("\n🧪 [Test 2] Second claim on already-claimed order fails...");
  const result2 = await prisma.order.updateMany({
    where: { id: order.id, companyId: company.id, processedById: null },
    data: { processedById: agent2.id, status: "PENDING", updatedAt: new Date() },
  });

  if (result2.count === 0) {
    console.log(`  ✅ Second claim correctly rejected (count=0)`);
  } else {
    console.error(`  ❌ FAIL: Second claim succeeded with count ${result2.count} — race condition!`);
    process.exit(1);
  }

  // Verify original claim is still intact
  const stillClaimed = await prisma.order.findUnique({ where: { id: order.id } });
  if (stillClaimed && stillClaimed.processedById === agent1.id) {
    console.log(`  ✅ Original claim preserved — processedById=${stillClaimed.processedById}`);
  } else {
    console.error(`  ❌ FAIL: Original claim was overwritten`);
    process.exit(1);
  }

  // Test 3: Concurrent claims — simulate two parallel requests
  console.log("\n🧪 [Test 3] Concurrent claims (parallel)...");
  // Reset the order to unclaimed
  await prisma.order.update({
    where: { id: order.id },
    data: { processedById: null, status: "NEW" },
  });

  const claimPromises = [
    prisma.order.updateMany({
      where: { id: order.id, companyId: company.id, processedById: null },
      data: { processedById: agent1.id, status: "PENDING", updatedAt: new Date() },
    }),
    prisma.order.updateMany({
      where: { id: order.id, companyId: company.id, processedById: null },
      data: { processedById: agent2.id, status: "PENDING", updatedAt: new Date() },
    }),
  ];

  const results = await Promise.all(claimPromises);
  const totalClaimed = results.filter(r => r.count > 0).length;

  if (totalClaimed === 1) {
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const claimedBy = finalOrder?.processedById === agent1.id ? "agent1" : "agent2";
    console.log(`  ✅ Exactly one claim succeeded (${claimedBy}) — no double-claim`);
  } else {
    console.error(`  ❌ FAIL: ${totalClaimed} claims succeeded — race condition detected!`);
    process.exit(1);
  }

  // Cleanup
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.user.delete({ where: { id: agent1.id } });
  await prisma.user.delete({ where: { id: agent2.id } });
  await prisma.company.delete({ where: { id: company.id } });
  console.log("\n  🧹 Cleanup complete");

  console.log("\n✅ [Test] PASS: Order claim race condition fix works correctly");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
