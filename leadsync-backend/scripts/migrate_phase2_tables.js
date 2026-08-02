require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function runMigration() {
  console.log("🚀 Running Phase 2 DDL Migration for Subunits, PaymentIntent, PaymentAttempt & Refund...");

  const queries = [
    // 1. Enums
    `DO $$ BEGIN
      CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_PAYMENT_METHOD', 'REQUIRES_CONFIRMATION', 'PROCESSING', 'SUCCEEDED', 'CANCELLED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "AttemptStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

    // 2. Subunit Columns
    `ALTER TABLE "InventoryProduct" ADD COLUMN IF NOT EXISTS "basePriceInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "InventoryVariant" ADD COLUMN IF NOT EXISTS "priceInSubunits" BIGINT;`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "amountInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalCogsInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "netProfitInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "priceInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "cogsInSubunits" BIGINT DEFAULT 0;`,
    `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subtotalInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalInSubunits" BIGINT NOT NULL DEFAULT 0;`,
    `ALTER TABLE "DraftOrder" ADD COLUMN IF NOT EXISTS "totalAmountInSubunits" BIGINT NOT NULL DEFAULT 0;`,

    // 3. PaymentIntent Table
    `CREATE TABLE IF NOT EXISTS "PaymentIntent" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "orderId" TEXT,
      "amountInSubunits" BIGINT NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'INR',
      "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT_METHOD',
      "provider" TEXT NOT NULL DEFAULT 'razorpay',
      "providerPaymentLinkId" TEXT,
      "idempotencyKey" TEXT NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PaymentIntent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_providerPaymentLinkId_key" ON "PaymentIntent"("providerPaymentLinkId");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");`,
    `CREATE INDEX IF NOT EXISTS "PaymentIntent_companyId_idx" ON "PaymentIntent"("companyId");`,
    `CREATE INDEX IF NOT EXISTS "PaymentIntent_companyId_orderId_idx" ON "PaymentIntent"("companyId", "orderId");`,
    `CREATE INDEX IF NOT EXISTS "PaymentIntent_status_idx" ON "PaymentIntent"("status");`,

    // 4. PaymentAttempt Table
    `CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
      "id" TEXT NOT NULL,
      "paymentIntentId" TEXT NOT NULL,
      "providerTransactionId" TEXT,
      "amountInSubunits" BIGINT NOT NULL,
      "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "rawPayload" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "PaymentAttempt_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_providerTransactionId_key" ON "PaymentAttempt"("providerTransactionId");`,
    `CREATE INDEX IF NOT EXISTS "PaymentAttempt_paymentIntentId_idx" ON "PaymentAttempt"("paymentIntentId");`,

    // 5. Refund Table
    `CREATE TABLE IF NOT EXISTS "Refund" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "paymentIntentId" TEXT NOT NULL,
      "amountInSubunits" BIGINT NOT NULL,
      "reason" TEXT,
      "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
      "providerRefundId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Refund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Refund_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Refund_providerRefundId_key" ON "Refund"("providerRefundId");`,
    `CREATE INDEX IF NOT EXISTS "Refund_companyId_idx" ON "Refund"("companyId");`,
    `CREATE INDEX IF NOT EXISTS "Refund_paymentIntentId_idx" ON "Refund"("paymentIntentId");`
  ];

  for (const query of queries) {
    await prisma.$executeRawUnsafe(query);
  }

  console.log("✅ Phase 2 DDL Migration completed successfully!");
}

runMigration()
  .catch((err) => {
    console.error("❌ Phase 2 Migration Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
