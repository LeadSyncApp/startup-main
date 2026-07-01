import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Total message count
  const total = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Message"`
  );
  console.log("Total messages:", total[0].count.toString());

  // 2. Messages with empty or NULL content
  const empty = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, "conversationId", "createdAt", content, sender, "senderName"
    FROM "Message"
    WHERE content = '' OR content IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 50
  `);
  console.log(`\nMessages with empty/null content: ${empty.length} (showing up to 50)`);
  if (empty.length > 0) {
    console.table(empty.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      createdAt: r.createdAt,
      content: r.content === null ? "<NULL>" : r.content,
      sender: r.sender,
      senderName: r.senderName,
    })));
  }

  // 3. Total count of empty/null content
  const emptyCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "Message" WHERE content = '' OR content IS NULL`
  );
  console.log("Total empty/null content count:", emptyCount[0].count.toString());

  // 4. Date range of empty/null content
  const dateRange = await prisma.$queryRawUnsafe<any[]>(`
    SELECT MIN("createdAt") as earliest, MAX("createdAt") as latest
    FROM "Message"
    WHERE content = '' OR content IS NULL
  `);
  console.log("Date range of empty/null rows:", dateRange[0]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });