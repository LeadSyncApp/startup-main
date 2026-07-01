const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function inspect() {
  try {
    // 1. Dump all Message rows
    console.log("\n=== ALL MESSAGE ROWS ===");
    const msgs = await prisma.$queryRawUnsafe(`SELECT * FROM "Message"`);
    for (const row of msgs) {
      console.log(JSON.stringify(row, (key, val) => 
        typeof val === 'bigint' ? val.toString() : val, 2));
    }

    // 2. Check Conversation mode column enum values
    console.log("\n=== CONVERSATION mode VALUES ===");
    const modes = await prisma.$queryRawUnsafe(`SELECT DISTINCT mode::text FROM "Conversation" LIMIT 10`);
    console.log(JSON.stringify(modes, null, 2));

    // 3. Check if needsStaffReason exists
    const hasNeedsStaff = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Conversation' AND column_name = 'needsStaffReason'
    `);
    console.log("\nneedsStaffReason exists:", hasNeedsStaff.length > 0);

  } catch (err) {
    console.error("Inspection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();