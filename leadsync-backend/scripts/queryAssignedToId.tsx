import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Sample conversations via raw SQL (assignedToId is not in schema.prisma)
  const rows: any[] = await prisma.$queryRaw`
    SELECT id, "assignedToId", "claimedById", "status"
    FROM "Conversation"
    LIMIT 20
  `;

  console.log("\n=== Conversations (first 20 via $queryRaw) ===");
  console.log("id | assignedToId | claimedById | status");
  console.log("-".repeat(80));
  for (const c of rows) {
    const a = c.assignedToId != null ? String(c.assignedToId).padEnd(10) : "null".padEnd(10);
    const cl = c.claimedById != null ? String(c.claimedById).padEnd(10) : "null".padEnd(10);
    console.log(c.id + " | " + a + " | " + cl + " | " + c.status);
  }

  const nonNullAssignedToId = rows.filter(function(c: any) { return c.assignedToId !== null; }).length;
  const nonNullClaimedById = rows.filter(function(c: any) { return c.claimedById !== null; }).length;
  const conflicting = rows.filter(function(c: any) {
    return c.assignedToId !== null && c.claimedById !== null && c.assignedToId !== c.claimedById;
  }).length;

  // Total count for context
  const countRow: any[] = await prisma.$queryRaw`
    SELECT COUNT(*) as total FROM "Conversation"
  `;
  const totalConversations = countRow.length > 0 ? Number(countRow[0].total) : 0;

  console.log("\n--- Summary (first 20 rows) ---");
  console.log("Total conversations in DB: " + totalConversations);
  console.log("Total rows examined: " + rows.length);
  console.log("Rows with non-null assignedToId: " + nonNullAssignedToId);
  console.log("Rows with non-null claimedById: " + nonNullClaimedById);
  console.log("Rows with both set to DIFFERENT values (conflict): " + conflicting);

  // 2. Check if assignmentStrategy column exists on Company
  try {
    const companies: any[] = await prisma.$queryRaw`
      SELECT id, name, "assignmentStrategy" FROM "Company"
    `;
    console.log("\n=== Company assignmentStrategy ===");
    const strategyCounts: Record<string, { count: number; names: string[] }> = {};
    for (const co of companies) {
      const s = co.assignmentStrategy || "(null)";
      if (!strategyCounts[s]) strategyCounts[s] = { count: 0, names: [] };
      strategyCounts[s].count++;
      strategyCounts[s].names.push(co.name || co.id);
    }
    for (const strategy in strategyCounts) {
      const info = strategyCounts[strategy];
      console.log("  " + strategy + ": " + info.count + " company(ies) [" + info.names.join(", ") + "]");
    }
  } catch (e: any) {
    console.log("\n=== Company assignmentStrategy: COLUMN DOES NOT EXIST in DB ===");
    console.log("  Error: " + e.message);
  }

  // 3. Conflict detection across ALL conversations
  const allConflicts: any[] = await prisma.$queryRaw`
    SELECT id, "assignedToId", "claimedById", "status"
    FROM "Conversation"
    WHERE "assignedToId" IS NOT NULL AND "claimedById" IS NOT NULL
  `;
  console.log("\n=== Total conversations with both columns non-null: " + allConflicts.length + " ===");
  for (const c of allConflicts) {
    const isDiff = c.assignedToId !== c.claimedById;
    const flag = isDiff ? "CONFLICT" : "same";
    console.log(
      "  " + c.id + " | assignedToId=" + c.assignedToId + " | claimedById=" + c.claimedById + " | " + flag + " | status=" + c.status
    );
  }
}

main()
  .catch(function(e: any) {
    console.error("Query failed:", e);
  })
  .finally(async function() {
    await prisma.$disconnect();
  });