import "dotenv/config";
import { matchProductForMessage } from "../../src/services/knowledge/productMatch.service";

const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";

const QUERIES = [
  { label: "DIRECT (silk sarees)", text: "do you have silk sarees?" },
  { label: "VAGUE (polyester)", text: "anything in polyester?" },
  { label: "HINGLISH (silk saree hai kya)", text: "silk saree hai kya aapke paas" },
  { label: "NO-MATCH (international delivery)", text: "do you deliver internationally" },
  { label: "GROUND-TRUTH (cotton pants)", text: "do you have cotton pants?" },
];

async function main() {
  for (const q of QUERIES) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`[TEST] ${q.label}`);
    console.log(`Query: "${q.text}"`);
    console.log(`${"=".repeat(70)}`);

    const start = Date.now();
    const result = await matchProductForMessage(COMPANY_ID, q.text);
    const elapsed = Date.now() - start;

    if (result) {
      console.log(`Result: MATCH`);
      console.log(`  Product:       ${result.name}${result.variant ? ` (${result.variant})` : ""}`);
      console.log(`  Score:         ${result.score.toFixed(6)}`);
      console.log(`  Confidence:    ${result.confidenceTier}`);
      console.log(`  Gap:           ${result.gap.toFixed(4)}`);
      console.log(`  Stock:         ${result.stock} (${result.stockStatus})`);
      console.log(`  Time:          ${elapsed}ms`);
    } else {
      console.log(`Result: NULL (no match)`);
      console.log(`  Time:       ${elapsed}ms`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`All ${QUERIES.length} queries completed.`);
}

main().catch(console.error);
