import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  try {
    const [enumResult, distResult] = await Promise.all([
      (prisma as any).$queryRawUnsafe(`SELECT enum_range(NULL::"ConversationStatus")`),
      prisma.$queryRaw<any[]>`SELECT DISTINCT status FROM "Conversation"`,
    ]);
    console.log("ENUM RANGE:", JSON.stringify(enumResult, null, 2));
    console.log("DISTINCT STATUS VALUES:", JSON.stringify(distResult, null, 2));
  } catch (e: any) {
    console.log("QUERY FAIL:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();