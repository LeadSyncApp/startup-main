import "dotenv/config";
import { matchProductForMessage } from "../../src/services/knowledge/productMatch.service";

const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";

const TEST_QUERIES = [
  // ── Existing test cases (regression) ──
  { label: "DIRECT (silk sarees)", text: "do you have silk sarees?" },
  { label: "VAGUE (polyester)", text: "anything in polyester?" },
  { label: "HINGLISH (silk saree hai kya)", text: "silk saree hai kya aapke paas" },
  { label: "NO-MATCH (international delivery)", text: "do you deliver internationally" },
  { label: "GROUND-TRUTH (cotton pants)", text: "do you have cotton pants?" },

  // ── Attribute match edge cases ──
  { label: "ATTR: color match (red)", text: "anything red?" },
  { label: "ATTR: size match (42)", text: "do you have size 42?" },
  { label: "ATTR: size match (M)", text: "show me size m" },
  { label: "ATTR: category match (shirt)", text: "any shirts?" },
  { label: "ATTR: short value no context", text: "tell me about m" },
  { label: "ATTR: short value with context", text: "show me size m" },
  { label: "ATTR: plural form", text: "show me shirts" },
  { label: "ATTR: compound value", text: "cotton pants" },
  { label: "ATTR: attribute not in catalog", text: "anything in velvet?" },
  { label: "ATTR: shared attribute", text: "anything in red?" },
  { label: "NO-ATTR: chit chat", text: "hello how are you" },
  { label: "NO-ATTR: unrelated query", text: "what time do you close" },
];

async function main() {
  console.log("=".repeat(80));
  console.log("PHASE 8: CATALOG-DRIVEN ATTRIBUTE MATCHER — EMPIRICAL TEST");
  console.log("=".repeat(80));
  console.log(`Company: ${COMPANY_ID}`);
  console.log(`Queries: ${TEST_QUERIES.length}`);
  console.log("");

  for (const q of TEST_QUERIES) {
    console.log(`${"─".repeat(80)}`);
    console.log(`[TEST] ${q.label}`);
    console.log(`Query: "${q.text}"`);

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
      console.log(`  MatchReason:   ${result.matchReason}`);
      console.log(`  Time:          ${elapsed}ms`);
    } else {
      console.log(`Result: NULL (no match)`);
      console.log(`  Time:       ${elapsed}ms`);
    }
    console.log("");
  }

  console.log("=".repeat(80));
  console.log(`All ${TEST_QUERIES.length} queries completed.`);
}

main().catch(console.error);
