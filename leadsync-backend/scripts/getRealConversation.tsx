import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.$queryRaw<any[]>`SELECT id, "companyId" FROM "Conversation" LIMIT 3`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e: any) {
    console.log("QUERY FAIL:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();