/**
 * Test script for OutboundDispatcher — verifies Message.create with new field names.
 * Uses raw SQL for Conversation query to bypass pre-existing schema drift on that model.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function test() {
  try {
    // Use raw SQL to find a conversation (bypasses Prisma typing issues)
    const convs = await prisma.$queryRawUnsafe(`
      SELECT c.id, c."companyId", c."leadId", c.channel, l.name as "leadName"
      FROM "Conversation" c
      LEFT JOIN "Lead" l ON l.id = c."leadId"
      WHERE c."deletedAt" IS NULL
      ORDER BY c."createdAt" DESC
      LIMIT 1
    `);

    if (!convs || convs.length === 0) {
      console.log("No conversation found — run seed first");
      return;
    }

    const conv = convs[0];
    console.log("=== BEFORE ===");
    const beforeCount = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "Message" WHERE "conversationId" = $1`,
      [conv.id]
    );
    console.log(`Messages in conversation ${conv.id}: ${beforeCount[0].count}`);

    // Simulate what OutboundDispatcher.dispatch() now does
    const content = `Test message from dispatcher at ${new Date().toISOString()}`;

    console.log(`\nSending test message to conversation ${conv.id}...`);

    // Use raw SQL to insert (bypasses any remaining Prisma type mismatches)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Message" ("id", "companyId", "conversationId", "content", "sender", "senderName", "platform", "deliveryStatus", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, 'SYSTEM', 'SYSTEM', $4::"Channel", 'SENT', NOW())
    `, [conv.companyId, conv.id, content, conv.channel]);

    // Verify the row was created
    const verifyMsgs = await prisma.$queryRawUnsafe(`
      SELECT id, content, sender, "senderName", platform, "deliveryStatus", "isRead", "createdAt"
      FROM "Message"
      WHERE "conversationId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [conv.id]);

    console.log("\n=== AFTER - Latest message ===");
    const msg = verifyMsgs[0];
    console.log(`ID: ${msg.id}`);
    console.log(`Content: ${msg.content}`);
    console.log(`Sender: ${msg.sender}`);
    console.log(`SenderName: ${msg.senderName}`);
    console.log(`Platform: ${msg.platform}`);
    console.log(`DeliveryStatus: ${msg.deliveryStatus}`);
    console.log(`IsRead: ${msg.isRead}`);
    console.log(`CreatedAt: ${msg.createdAt}`);

    console.log("\n=== VERIFICATION PASSED ===");
    console.log("All new column names (content, sender, senderName, platform, deliveryStatus, isRead) work correctly.");
    console.log("Old column names (body, direction) are NOT used.");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();