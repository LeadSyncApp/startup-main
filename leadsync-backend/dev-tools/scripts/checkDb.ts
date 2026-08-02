import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log("DB connected OK");
    const count = await prisma.knowledgeChunk.count({ where: { sourceType: "PRODUCT", isActive: true } });
    console.log("Active PRODUCT chunks:", count);
    await prisma.$disconnect();
  } catch (e: any) {
    console.log("DB unavailable:", e.message);
  }
}

main();
