/**
 * TEST: Task 3 — Transactional order creation
 *
 * Verifies:
 * 1. Order + OrderItems are created atomically in a single transaction
 * 2. If OrderItem creation fails, the Order is rolled back (no orphaned Order)
 */

import { prisma } from "../../src/lib/prisma";

async function runTest() {
  console.log("🧪 [Test] Starting transactional order creation test...");

  // Setup: create a minimal company + lead + conversation for testing
  const company = await prisma.company.create({
    data: {
      name: "Test Company TX",
      companyCode: `TESTTX${Date.now()}`,
    },
  });

  const lead = await prisma.lead.create({
    data: {
      name: "Test Customer",
      contact: "+1234567890",
      channel: "WEBSITE",
      companyId: company.id,
    },
  });

  const conversation = await prisma.conversation.create({
    data: {
      channel: "WEBSITE",
      leadId: lead.id,
      companyId: company.id,
    },
  });

  console.log(`  📦 Setup: company=${company.id}, lead=${lead.id}, conv=${conversation.id}`);

  // Test 1: Successful transaction — Order + Items both created
  console.log("\n🧪 [Test 1] Successful transaction...");
  const order1 = await prisma.$transaction(async (tx) => {
    const o = await (tx.order as any).create({
      data: {
        companyId: company.id,
        leadId: lead.id,
        conversationId: conversation.id,
        summary: "Test order with items",
        status: "NEW",
        amount: 500,
        approvalStatus: "PENDING",
        processedById: null,
      },
      include: { lead: { select: { name: true, contact: true } } },
    });

    await tx.orderItem.createMany({
      data: [
        { orderId: o.id, companyId: company.id, name: "Item A", quantity: 2, price: 100, priceInSubunits: 20000n },
        { orderId: o.id, companyId: company.id, name: "Item B", quantity: 1, price: 300, priceInSubunits: 30000n },
      ],
    });

    return o;
  });

  const items1 = await prisma.orderItem.findMany({ where: { orderId: order1.id } });
  if (items1.length === 2) {
    console.log(`  ✅ Order ${order1.id} created with ${items1.length} items`);
  } else {
    console.error(`  ❌ FAIL: Expected 2 items, got ${items1.length}`);
    process.exit(1);
  }

  // Test 2: Failed transaction — OrderItem creation fails, Order should be rolled back
  console.log("\n🧪 [Test 2] Failed transaction (rollback)...");
  const orderCountBefore = await prisma.order.count({ where: { companyId: company.id } });

  try {
    await prisma.$transaction(async (tx) => {
      const o = await (tx.order as any).create({
        data: {
          companyId: company.id,
          leadId: lead.id,
          conversationId: conversation.id,
          summary: "This order should be rolled back",
          status: "NEW",
          amount: 999,
          approvalStatus: "PENDING",
          processedById: null,
        },
        include: { lead: { select: { name: true, contact: true } } },
      });

      // This should fail — orderId references a non-existent order (foreign key violation)
      await tx.orderItem.createMany({
        data: [
          { orderId: "non-existent-order-id-12345", companyId: company.id, name: "Orphan Item", quantity: 1, price: 100, priceInSubunits: 10000n },
        ],
      });

      return o;
    });
    console.error("  ❌ FAIL: Transaction should have thrown but succeeded");
    process.exit(1);
  } catch (err: any) {
    // Expected: transaction should fail and rollback
    const orderCountAfter = await prisma.order.count({ where: { companyId: company.id } });
    if (orderCountAfter === orderCountBefore) {
      console.log(`  ✅ Transaction rolled back correctly — no orphaned Order (count before=${orderCountBefore}, after=${orderCountAfter})`);
    } else {
      console.error(`  ❌ FAIL: Order count changed from ${orderCountBefore} to ${orderCountAfter} — orphaned Order detected`);
      process.exit(1);
    }
  }

  // Cleanup
  await prisma.orderItem.deleteMany({ where: { companyId: company.id } });
  await prisma.order.deleteMany({ where: { companyId: company.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
  await prisma.lead.delete({ where: { id: lead.id } });
  await prisma.company.delete({ where: { id: company.id } });
  console.log("\n  🧹 Cleanup complete");

  console.log("\n✅ [Test] PASS: Transactional order creation works correctly");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ [Test] Fatal error:", err);
  process.exit(1);
});
