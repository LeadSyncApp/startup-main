const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const companyId = "3102a85e-1798-45bb-b6c5-d94ea436f775";
  const convId = "645a91a0-f72e-4276-be9d-f9d5aa3b72a6";

  // Read rows using raw query without params (defeats the bug)
  const before = await p.$queryRawUnsafe(
    `SELECT id, content, sender::text, "senderName", "senderId", "isRead" FROM "Message" LIMIT 3`
  );
  console.log("=== EXISTING ROWS ===");
  console.log(JSON.stringify(before, null, 2));

  // Verify the new column value on existing rows
  for (const r of before) {
    console.log(`Row ${r.id}: senderName=${r.senderName}, isRead=${r.isRead}`);
  }

  await p.$disconnect();
  console.log("\n✅ Message fields verified: content, sender, senderName, senderId, isRead all accessible");
}
main().catch(e => { console.error(e.message); process.exit(1); });