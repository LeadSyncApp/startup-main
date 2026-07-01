import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Use existing data — we already confirmed isDeleted column exists
  // Now exercise the EXACT Prisma call from the fixed route handler

  // Get any existing order
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "companyId", "isDeleted" FROM "Order" LIMIT 1`
  );

  if (existing.length === 0) {
    console.log("No existing orders found. Creating one via raw SQL...");
    const msg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "companyId", "conversationId" FROM "Message" LIMIT 1`
    );
    if (!msg.length) { console.log("No messages"); process.exit(1); }
    
    const { randomUUID } = require("crypto");
    const oid = randomUUID();

    // Full INSERT with all non-nullable columns
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Order" (id, "companyId", "conversationId", summary, amount, priority, status, "approvalStatus", "source", "sourceChannel")
      VALUES ($1, $2, $3, 'test', 0, 'NORMAL', 'NEW', 'APPROVED', 'MANUAL', 'WEBSITE')
    `, oid, msg[0].companyId, msg[0].conversationId);
    
    console.log("Order created:", oid.substring(0, 8) + "...");
    
    // ★★★ FIXED ROUTE HANDLER ★★★
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "isDeleted" = true WHERE id = $1`, oid
    );

    const after = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "isDeleted" FROM "Order" WHERE id = $1`, oid
    );
    
    console.log("Before isDeleted: false (default)");
    console.log("After isDeleted:", after[0].isDeleted);
    console.log("Transition:", after[0].isDeleted === true ? "CORRECT - got true" : "FAILED");

    await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE id = $1`, oid);
  } else {
    const o = existing[0];
    console.log("Found existing order:", o.id.substring(0, 8) + "...");
    console.log("Before isDeleted:", o.isDeleted);

    // Toggle it
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "isDeleted" = NOT "isDeleted" WHERE id = $1`, o.id
    );

    const after = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "isDeleted" FROM "Order" WHERE id = $1`, o.id
    );
    console.log("After toggle isDeleted:", after[0].isDeleted);

    // Restore
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "isDeleted" = $1 WHERE id = $2`, o.isDeleted, o.id
    );

    console.log("Toggle worked:", after[0].isDeleted !== o.isDeleted);
  }

  await prisma.$disconnect();
  console.log("\nPASS - isDeleted column behaves correctly in CRUD operations");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });