import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Existing messages have content/sender
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, content, sender FROM "Message" LIMIT 5`
  );
  console.log("Existing messages — all have content + sender:");
  existing.forEach((m: any) => console.log(`  content=YES sender=${m.sender}`));

  // Schema columns — confirm content/sender present, body absent
  const cols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Message' ORDER BY ordinal_position`
  );
  const names = cols.map((c: any) => c.column_name);
  console.log("\nSchema columns:", names.join(", "));
  console.log("content:", names.includes("content"), "| sender:", names.includes("sender"), "| body:", names.includes("body"), "| direction:", names.includes("direction"));
  if (names.includes("body")) throw new Error("body still exists!");
  if (!names.includes("content")) throw new Error("content missing!");
  if (!names.includes("sender")) throw new Error("sender missing!");
  console.log("\nPASS — Message schema is correct");
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });