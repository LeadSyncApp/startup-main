import { prisma } from "../../src/lib/prisma";
async function test() {
  try {
    await prisma.$connect();
    const companies = await prisma.company.findMany({ take: 3, select: { id: true, name: true } });
    console.log("DB reachable. Companies:", JSON.stringify(companies, null, 2));
    await prisma.$disconnect();
  } catch(e: any) { console.error("DB unreachable:", e.message); }
}
test().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
