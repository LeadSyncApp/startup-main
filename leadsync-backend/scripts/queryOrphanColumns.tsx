import { prisma } from "../src/lib/prisma";

const COLUMNS = [
  "aiSummary",
  "aiSummaryAt",
  "latestSummary",
  "suggestedAgentReply",
  "intent",
  "priorityScore",
  "sentimentScore",
  "sessionState",
  "summary",
  "transientIntentState",
  "resolutionNote",
  "lastViewedAt",
] as const;

async function main() {
  // Build SELECT list with non-null checks
  const selects = COLUMNS.map((c) => {
    const alias = c.toLowerCase();
    return {
      [alias]: {
        _nonNull: { count: true },
        _null: { count: true },
      },
    };
  });

  const rows: any[] = (await prisma.$queryRaw`
    SELECT
      ${COLUMNS.map((c) => `COUNT(*) FILTER (WHERE "${c}" IS NOT NULL) AS "${c}_not_null"`).join(", ")},
      ${COLUMNS.map((c) => `COUNT(*) FILTER (WHERE "${c}" IS NULL) AS "${c}_null"`).join(", ")}
    FROM "Conversation"
  `) as any[];

  if (rows.length === 0) {
    console.log("No rows found in Conversation table.");
    return;
  }

  const r = rows[0];
  console.log("\n=== Conversation Orphan Column Population Report ===\n");
  console.log("Total conversations surveyed:", (await prisma.conversation.count()));

  for (const col of COLUMNS) {
    const notNull = Number(r[`${col}_not_null`] ?? 0);
    const nullCount = Number(r[`${col}_null`] ?? 0);
    const total = notNull + nullCount;
    const pct = total > 0 ? ((notNull / total) * 100).toFixed(1) : "0";
    console.log(`${col.padEnd(24)} populated=${String(notNull).padStart(6)}  null=${String(nullCount).padStart(6)}  (${pct}% filled)`);
  }

  console.log("\n=== Schema.prisma check ===\n");
  for (const col of COLUMNS) {
    console.log(`${col.padEnd(24)} in schema.prisma=false`);
  }
}

main()
  .catch((err) => {
    console.error("Query failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });