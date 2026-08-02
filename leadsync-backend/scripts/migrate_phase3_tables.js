require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function runPhase3Migration() {
  console.log("🚀 Running Phase 3 DDL Migration for OutboxEvent & ReconciliationDiscrepancy...");

  const queries = [
    // 1. Enums
    `DO $$ BEGIN
      CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "DiscrepancyType" AS ENUM ('MISSING_INTERNAL_RECORD', 'AMOUNT_MISMATCH', 'MISSING_PROVIDER_RECORD', 'STATUS_MISMATCH');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    `DO $$ BEGIN
      CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

    // 2. OutboxEvent Table
    `CREATE TABLE IF NOT EXISTS "OutboxEvent" (
      "id" TEXT NOT NULL,
      "aggregateType" TEXT NOT NULL,
      "aggregateId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
      "processedAt" TIMESTAMP(3),
      "error" TEXT,
      "retryCount" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");`,
    `CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");`,

    // 3. ReconciliationDiscrepancy Table
    `CREATE TABLE IF NOT EXISTS "ReconciliationDiscrepancy" (
      "id" TEXT NOT NULL,
      "discrepancyType" "DiscrepancyType" NOT NULL,
      "providerTransactionId" TEXT,
      "paymentIntentId" TEXT,
      "providerAmount" BIGINT,
      "internalAmount" BIGINT,
      "details" JSONB,
      "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
      "resolvedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReconciliationDiscrepancy_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "ReconciliationDiscrepancy_status_idx" ON "ReconciliationDiscrepancy"("status");`,
    `CREATE INDEX IF NOT EXISTS "ReconciliationDiscrepancy_discrepancyType_idx" ON "ReconciliationDiscrepancy"("discrepancyType");`,
    `CREATE INDEX IF NOT EXISTS "ReconciliationDiscrepancy_providerTransactionId_idx" ON "ReconciliationDiscrepancy"("providerTransactionId");`,
    `CREATE INDEX IF NOT EXISTS "ReconciliationDiscrepancy_paymentIntentId_idx" ON "ReconciliationDiscrepancy"("paymentIntentId");`
  ];

  for (const query of queries) {
    await prisma.$executeRawUnsafe(query);
  }

  console.log("✅ Phase 3 DDL Migration completed successfully!");
}

runPhase3Migration()
  .catch((err) => {
    console.error("❌ Phase 3 Migration Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
