require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function backfillMonetarySubunits() {
  console.log("🔄 Starting backfill migration of float monetary fields to integer subunits (paise)...");

  // 1. InventoryProduct basePrice -> basePriceInSubunits
  console.log("   Backfilling InventoryProduct basePriceInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "InventoryProduct"
    SET "basePriceInSubunits" = ROUND("basePrice" * 100)
    WHERE "basePriceInSubunits" = 0 AND "basePrice" > 0;
  `);

  // 2. InventoryVariant price -> priceInSubunits
  console.log("   Backfilling InventoryVariant priceInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "InventoryVariant"
    SET "priceInSubunits" = ROUND("price" * 100)
    WHERE "priceInSubunits" IS NULL AND "price" IS NOT NULL;
  `);

  // 3. Order amount, totalCogs, netProfit -> amountInSubunits, totalCogsInSubunits, netProfitInSubunits
  console.log("   Backfilling Order amountInSubunits, totalCogsInSubunits, netProfitInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "Order"
    SET 
      "amountInSubunits" = ROUND("amount" * 100),
      "totalCogsInSubunits" = ROUND("totalCogs" * 100),
      "netProfitInSubunits" = ROUND("netProfit" * 100)
    WHERE "amountInSubunits" = 0 AND "amount" > 0;
  `);

  // 4. OrderItem price, cogs -> priceInSubunits, cogsInSubunits
  console.log("   Backfilling OrderItem priceInSubunits, cogsInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "OrderItem"
    SET 
      "priceInSubunits" = ROUND("price" * 100),
      "cogsInSubunits" = ROUND(COALESCE("cogs", 0) * 100)
    WHERE "priceInSubunits" = 0 AND "price" > 0;
  `);

  // 5. Invoice subtotal, tax, total -> subtotalInSubunits, taxInSubunits, totalInSubunits
  console.log("   Backfilling Invoice subtotalInSubunits, taxInSubunits, totalInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "Invoice"
    SET 
      "subtotalInSubunits" = ROUND("subtotal" * 100),
      "taxInSubunits" = ROUND("tax" * 100),
      "totalInSubunits" = ROUND("total" * 100)
    WHERE "totalInSubunits" = 0 AND "total" > 0;
  `);

  // 6. DraftOrder totalAmount -> totalAmountInSubunits
  console.log("   Backfilling DraftOrder totalAmountInSubunits...");
  await prisma.$executeRawUnsafe(`
    UPDATE "DraftOrder"
    SET "totalAmountInSubunits" = ROUND("totalAmount" * 100)
    WHERE "totalAmountInSubunits" = 0 AND "totalAmount" > 0;
  `);

  console.log("✅ Backfill migration completed successfully!");
}

backfillMonetarySubunits()
  .catch((err) => {
    console.error("❌ Backfill migration error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
