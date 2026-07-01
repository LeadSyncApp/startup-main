import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  try {
    // STEP 2: All USER-DEFINED columns in live DB
    const enumCols = await (prisma as any).$queryRawUnsafe(`
      SELECT column_name, udt_name, table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'USER-DEFINED'
      ORDER BY table_name, column_name
    `);
    console.log("=== ALL USER-DEFINED (ENUM) COLUMNS IN LIVE DB ===");
    console.log(JSON.stringify(enumCols, null, 2));

    // For each enum column, get the actual allowed values
    for (const col of enumCols as any[]) {
      try {
        const range = await (prisma as any).$queryRawUnsafe(
          `SELECT enum_range(NULL::"${col.udt_name}")`
        );
        console.log(`\nENUM ${col.udt_name} (used by ${col.table_name}.${col.column_name}):`, JSON.stringify(range));
      } catch (e) {
        console.log(`\nENUM ${col.udt_name}: failed to query range — ${(e as Error).message}`);
      }
    }
  } catch (e: any) {
    console.log("QUERY FAIL:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();