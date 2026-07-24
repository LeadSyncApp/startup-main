/**
 * Load real BGE-v2-m3, run a quick sanity check, then the 4 test queries.
 * If this fails, report exactly why (no fallback, no silent pass).
 */
import "dotenv/config";
import { matchProductForMessage, ensureRerankerReady } from "../services/knowledge/productMatch.service";

const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";
const QUERIES = [
  { label: "DIRECT (silk sarees)", text: "do you have silk sarees?" },
  { label: "VAGUE (polyester)", text: "anything in polyester?" },
  { label: "HINGLISH (silk saree hai kya)", text: "silk saree hai kya aapke paas" },
  { label: "NO-MATCH (international delivery)", text: "do you deliver internationally" },
];

async function main() {
  console.log("=".repeat(70));
  console.log("Loading BGE-v2-m3 (first load downloads ~571 MB from HuggingFace)...");
  const loadStart = Date.now();
  try {
    await ensureRerankerReady();
    console.log(`BGE loaded OK in ${(Date.now() - loadStart) / 1000}s`);
  } catch (err: any) {
    console.error("FATAL: BGE failed to load:", err?.message);
    console.error(err?.stack);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("Benchmark validation: expected ~0.974 for direct, ~0.007 for vague (original isolated test)");
  console.log("Now re-running on Om Sai Silk Boutique (2-product catalog)...\n");

  for (const q of QUERIES) {
    console.log(`--- ${q.label} ---`);
    console.log(`Query: "${q.text}"`);

    const start = Date.now();
    const result = await matchProductForMessage(COMPANY_ID, q.text);
    const elapsed = Date.now() - start;

    if (result) {
      console.log(`  MATCH:   ${result.name}${result.variant ? ` (${result.variant})` : ""}`);
      console.log(`  Score:   ${result.score.toFixed(6)}`);
      console.log(`  Gap:     ${result.gap.toFixed(6)}`);
    } else {
      console.log(`  MATCH:   null (no match)`);
    }
    console.log(`  Time:    ${elapsed}ms\n`);
  }

  console.log("=".repeat(70));
  console.log("Done.");
}

main().catch((err) => {
  console.error("Unhandled error:", err?.message, err?.stack);
  process.exit(1);
});
