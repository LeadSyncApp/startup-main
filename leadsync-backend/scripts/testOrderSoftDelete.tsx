import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Check Order schema columns
  const cols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Order' ORDER BY ordinal_position`
  );
  const names = cols.map((c: any) => c.column_name);
  console.log("Order columns:", names.join(", "));
  console.log("isDeleted:", names.includes("isDeleted"), "| deletedAt:", names.includes("deletedAt"));
  if (!names.includes("isDeleted")) throw new Error("isDeleted missing!");
  if (names.includes("deletedAt")) throw new Error("deletedAt still exists!");

  // 2. Count orders by isDeleted state
  const total = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as cnt FROM "Order"`);
  const softDeleted = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as cnt FROM "Order" WHERE "isDeleted" = true`
  );
  const active = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as cnt FROM "Order" WHERE "isDeleted" = false`
  );
  console.log(`\nOrders: total=${total[0].cnt}, isDeleted=true=${softDeleted[0].cnt}, isDeleted=false=${active[0].cnt}`);

  // 3. Confirm analytics-style query works with isDeleted: false filter
  const paidOrders = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as cnt FROM "Order" WHERE "isDeleted" = false AND status IN ('DELIVERED', 'PAID')`
  );
  console.log(`Active paid orders: ${paidOrders[0].cnt}`);

  console.log("\nPASS — Order schema and queries correct");
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });