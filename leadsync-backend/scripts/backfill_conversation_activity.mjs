// Backfill ConversationActivity rows for already-resolved conversations.
// Usage: node scripts/backfill_conversation_activity.mjs [companyId]
// Defaults to the verification test tenant companyId when no arg is given.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const companyId = process.argv[2];

if (!companyId) {
  console.error("Usage: node scripts/backfill_conversation_activity.mjs <companyId>");
  console.error("companyId is required. Pass a valid company UUID.");
  process.exit(1);
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
  console.error("Error: companyId must be a valid UUID.");
  process.exit(1);
}

async function main() {
  console.log(`Backfilling ConversationActivity (type=RESOLVED) for companyId=${companyId}`);

  const resolved = await prisma.conversation.findMany({
    where: { companyId, status: "RESOLVED" },
    select: { id: true, resolvedById: true, resolvedBy: true, updatedAt: true, companyId: true },
  });

  console.log(`Found ${resolved.length} RESOLVED conversation(s) to backfill.`);

  let inserted = 0;
  for (const c of resolved) {
    let actorName;
    if (c.resolvedBy && !isUuid(c.resolvedBy)) {
      // resolvedBy is already a display name
      actorName = c.resolvedBy;
    } else {
      // Try to recover real name by looking up the user
      const lookupId = c.resolvedById || (c.resolvedBy && isUuid(c.resolvedBy) ? c.resolvedBy : null);
      if (lookupId) {
        const user = await prisma.user.findUnique({
          where: { id: lookupId },
          select: { firstName: true, lastName: true },
        });
        actorName = user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "Deleted User";
      } else {
        actorName = "Deleted User";
      }
    }

    await prisma.conversationActivity.create({
      data: {
        conversationId: c.id,
        companyId: c.companyId,
        type: "RESOLVED",
        actorId: c.resolvedById || null,
        actorName,
        createdAt: c.updatedAt,
      },
    });
    inserted++;
  }

  console.log(`Inserted ${inserted} ConversationActivity row(s).`);
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });