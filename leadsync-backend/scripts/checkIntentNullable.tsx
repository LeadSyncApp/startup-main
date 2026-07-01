import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await (prisma as any).$queryRawUnsafe(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Conversation'
        AND column_name = 'intent'
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e: any) {
    console.log("QUERY FAIL:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();