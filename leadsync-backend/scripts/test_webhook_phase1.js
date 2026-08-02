require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
if (!secret) {
  console.error("❌ RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET must be set in environment");
  process.exit(1);
}
const targetUrl = 'http://localhost:4000/api/webhook/razorpay';

async function runVerificationTests() {
  console.log("🧪 Starting Phase 1 Payment Webhook Verification Tests...\n");

  // Fetch a sample company & conversation to test deferred order creation
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Webhook Test Store",
        companyCode: "TESTSTORE_" + Date.now().toString().slice(-4),
        currencyCode: "INR",
        currencySymbol: "₹"
      }
    });
  }

  let conversation = await prisma.conversation.findFirst({ where: { companyId: company.id } });
  if (!conversation) {
    const lead = await prisma.lead.create({
      data: {
        companyId: company.id,
        name: "Test Customer",
        contact: "test@customer.com",
        channel: "WEBSITE"
      }
    });
    conversation = await prisma.conversation.create({
      data: {
        companyId: company.id,
        channel: "WEBSITE",
        leadId: lead.id
      }
    });
  }

  const testUniqueId = "test_pay_" + Date.now();
  
  // Construct a realistic payment_link.paid webhook payload
  const mockPayload = {
    event: "payment_link.paid",
    payload: {
      payment_link: {
        entity: {
          id: testUniqueId,
          amount: 50000, // ₹500.00
          currency: "INR",
          notes: {
            company_id: company.id,
            conversation_id: conversation.id,
            summary: "Phase 1 Verification Test Order"
          }
        }
      }
    }
  };

  const rawBody = JSON.stringify(mockPayload);
  const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // ==========================================
  // TEST 1: Invalid Signature Rejection (Expect 400)
  // ==========================================
  console.log("▶ TEST 1: Sending request with INVALID signature...");
  const invalidRes = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'invalid_signature_hash_xyz'
    },
    body: rawBody
  });
  
  const invalidStatus = invalidRes.status;
  const invalidData = await invalidRes.json().catch(() => ({}));
  console.log(`   Response Status: ${invalidStatus}`);
  console.log(`   Response Data:`, invalidData);

  if (invalidStatus === 400 && invalidData.error === "Invalid signature") {
    console.log("✅ TEST 1 PASSED: Invalid signature properly rejected with HTTP 400\n");
  } else {
    console.error("❌ TEST 1 FAILED: Expected 400 Bad Request with Invalid signature error\n");
  }

  // ==========================================
  // TEST 2: First Valid Webhook Request (Expect 200 OK)
  // ==========================================
  console.log("▶ TEST 2: Sending FIRST valid webhook request...");
  const firstRes = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validSignature
    },
    body: rawBody
  });

  const firstStatus = firstRes.status;
  const firstData = await firstRes.json().catch(() => ({}));
  console.log(`   Response Status: ${firstStatus}`);
  console.log(`   Response Data:`, firstData);

  if (firstStatus === 200 && firstData.status === "ok") {
    console.log("✅ TEST 2 PASSED: Valid webhook successfully processed\n");
  } else {
    console.error("❌ TEST 2 FAILED: Expected 200 OK for valid webhook\n");
  }

  // ==========================================
  // TEST 3: Duplicate Webhook Rejection (Expect 200 already_processed)
  // ==========================================
  console.log("▶ TEST 3: Sending DUPLICATE webhook request with identical payload...");
  const secondRes = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validSignature
    },
    body: rawBody
  });

  const secondStatus = secondRes.status;
  const secondData = await secondRes.json().catch(() => ({}));
  console.log(`   Response Status: ${secondStatus}`);
  console.log(`   Response Data:`, secondData);

  if (secondStatus === 200 && secondData.status === "already_processed") {
    console.log("✅ TEST 3 PASSED: Duplicate webhook caught by deduplication ledger and safely ignored\n");
  } else {
    console.error("❌ TEST 3 FAILED: Expected duplicate request to return status: already_processed\n");
  }

  // ==========================================
  // DB VERIFICATION
  // ==========================================
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const eventLedger = await prisma.$queryRaw`
    SELECT * FROM "ProcessedWebhookEvent" WHERE "id" = ${payloadHash}
  `;
  console.log("📊 Database Audit:");
  console.log(`   ProcessedWebhookEvent row count for hash (${payloadHash.slice(0, 10)}...):`, eventLedger.length);
  if (eventLedger.length === 1) {
    console.log("✅ DB AUDIT PASSED: Exactly 1 ledger row exists, preventing duplicate processing!");
  } else {
    console.error("❌ DB AUDIT FAILED: Ledger row missing or duplicated!");
  }
}

runVerificationTests()
  .catch((err) => {
    console.error("❌ Verification execution error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
