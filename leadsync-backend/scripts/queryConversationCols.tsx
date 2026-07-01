import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const cols: any = await p.$queryRawUnsafe(
    "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='Conversation' ORDER BY ordinal_position"
  );
  console.log("=== CONVERSATION COLUMNS ===");
  (cols as any[]).forEach((c: any) => console.log(`${c.column_name}\t${c.data_type}\t${c.is_nullable}\t${c.column_default || ""}`));

  const statuses = await p.$queryRawUnsafe('SELECT DISTINCT status, COUNT(*)::int as count FROM "Conversation" GROUP BY status');
  console.log("\n=== DISTINCT STATUS VALUES ===");
  console.log(JSON.stringify(statuses, null, 2));
  
  const channels = await p.$queryRawUnsafe('SELECT DISTINCT channel, COUNT(*)::int as count FROM "Conversation" GROUP BY channel');
  console.log("\n=== DISTINCT CHANNEL VALUES ===");
  console.log(JSON.stringify(channels, null, 2));

  await p.$disconnect();
})();