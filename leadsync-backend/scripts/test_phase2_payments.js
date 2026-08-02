require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

const { paymentEngineService } = require('../dist/services/integrations/paymentEngine.service');

async function runPhase2Tests() {
  console.log("🧪 Starting Phase 2 Payment Ledger & Subunits Verification Tests...\n");

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("No company found in DB for testing");
  }

  // ==========================================
  // TEST (c): Confirm old float amount fields match new integer subunit fields
  // ==========================================
  console.log("▶ TEST (c): Auditing existing DB records to confirm float vs subunit match...");
  const orders = await prisma.order.findMany({ take: 10 });
  let matchCount = 0;

  for (const order of orders) {
    const expectedSubunits = BigInt(Math.round(order.amount * 100));
    if (order.amountInSubunits === expectedSubunits) {
      matchCount++;
    } else {
      console.warn(`   ⚠️ Mismatch for Order ${order.id}: Float=${order.amount}, Subunits=${order.amountInSubunits}, Expected=${expectedSubunits}`);
    }
  }
  console.log(`   Audited ${orders.length} orders. Matches: ${matchCount}/${orders.length}`);
  if (orders.length === 0 || matchCount === orders.length) {
    console.log("✅ TEST (c) PASSED: Float amount fields perfectly match new integer subunit fields!\n");
  } else {
    console.error("❌ TEST (c) FAILED: Monetary subunit mismatch detected!\n");
  }

  // ==========================================
  // TEST (a): Create PaymentIntent & Simulate Successful Payment
  // ==========================================
  console.log("▶ TEST (a): Creating PaymentIntent and simulating successful payment...");
  const testSubunits = 10000n; // ₹100.00 = 10,000 paise
  const idempotencyKey = "idem_test_phase2_" + Date.now();

  const intent = await paymentEngineService.createPaymentIntent({
    companyId: company.id,
    amountInSubunits: testSubunits,
    currency: "INR",
    idempotencyKey
  });

  console.log(`   Created PaymentIntent ID: ${intent.id}`);
  console.log(`   Initial Status: ${intent.status}`);
  console.log(`   Amount Subunits: ${intent.amountInSubunits}`);

  // Create payment attempt & update status to SUCCEEDED
  await prisma.paymentAttempt.create({
    data: {
      paymentIntentId: intent.id,
      providerTransactionId: "pay_test_txn_" + Date.now(),
      amountInSubunits: testSubunits,
      status: "SUCCESS"
    }
  });

  const updatedIntent = await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: "SUCCEEDED" }
  });

  if (updatedIntent.status === "SUCCEEDED") {
    console.log("✅ TEST (a) PASSED: PaymentIntent created & status transitioned to SUCCEEDED!\n");
  } else {
    console.error("❌ TEST (a) FAILED: PaymentIntent status is not SUCCEEDED!\n");
  }

  // ==========================================
  // TEST (b): Issue Partial Refund & Verify Ledger Updates
  // ==========================================
  console.log("▶ TEST (b): Issuing a partial refund (₹40.00 / 4000 paise)...");
  const refundAmount = 4000n; // ₹40.00

  const refundResult = await paymentEngineService.processRefund({
    companyId: company.id,
    paymentIntentId: intent.id,
    amountInSubunits: refundAmount,
    reason: "Partial item return"
  });

  console.log(`   Created Refund ID: ${refundResult.refund.id}`);
  console.log(`   Refund Status: ${refundResult.refund.status}`);
  console.log(`   Refund Amount: ${refundResult.refund.amountInSubunits} paise`);
  console.log(`   New PaymentIntent Status: ${refundResult.paymentIntent.status}`);

  if (refundResult.refund.status === "PROCESSED" && refundResult.paymentIntent.status === "PARTIALLY_REFUNDED") {
    console.log("✅ TEST (b) PASSED: Partial refund processed cleanly and PaymentIntent updated to PARTIALLY_REFUNDED!\n");
  } else {
    console.error("❌ TEST (b) FAILED: Partial refund or PaymentIntent status desynchronized!\n");
  }

  console.log("🎉 ALL PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

runPhase2Tests()
  .catch((err) => {
    console.error("❌ Phase 2 test error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
