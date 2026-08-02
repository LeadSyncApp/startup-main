require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Migrating ProcessedWebhookEvent table to Supabase...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProcessedWebhookEvent" (
      "id" TEXT NOT NULL,
      "provider" TEXT NOT NULL DEFAULT 'razorpay',
      "eventType" TEXT NOT NULL,
      "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
    );
  `);
  
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_provider_eventType_idx" 
    ON "ProcessedWebhookEvent"("provider", "eventType");
  `);

  console.log("✅ ProcessedWebhookEvent table and index created successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
