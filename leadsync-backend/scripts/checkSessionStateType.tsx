import { prisma } from "../src/lib/prisma";

async function main() {
  const cols: any[] = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'Conversation'
      AND column_name = 'sessionState'
    ORDER BY ordinal_position
  `;
  console.log(JSON.stringify(cols, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });