/**
 * End-to-end test: runs the full reply pipeline for all 5 test queries.
 * Calls matchProductForMessage then generateShopReply and reports the
 * actual LLM-generated customer-facing reply text.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { tenantContextStorage, TenantContext } from "../services/context/tenantContext.provider";
import { matchProductForMessage } from "../services/knowledge/productMatch.service";
import { generateShopReply } from "../services/ai/ai.service";

const COMPANY_ID = "3102a85e-1798-45bb-b6c5-d94ea436f775";

const QUERIES = [
  { label: "DIRECT (silk sarees)", text: "do you have silk sarees?" },
  { label: "VAGUE (polyester)", text: "anything in polyester?" },
  { label: "HINGLISH (silk saree hai kya)", text: "silk saree hai kya aapke paas" },
  { label: "NO-MATCH (international delivery)", text: "do you deliver internationally" },
  { label: "GROUND-TRUTH (cotton pants)", text: "do you have cotton pants?" },
];

async function main() {
  // Fetch company + bot config for tenant context
  const companyContext = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    include: { botConfiguration: true },
  });
  if (!companyContext) throw new Error("Company not found");

  const config = (companyContext.botConfiguration as any) || {};
  const activeContext: TenantContext = {
    companyId: companyContext.id,
    currencyCode: (companyContext as any).currencyCode || "USD",
    currencySymbol: (companyContext as any).currencySymbol || "$",
    timezone: (companyContext as any).timezone || "UTC",
    priorityRules: config.priority_rules || null,
    templates: config.templates || {},
    aiModelTarget: config.ai_model_target || "llama-3.3-70b-versatile",
    outputProtocolSchema: config.output_protocol_schema || "JSON_ONLY",
    intentMatrix: config.intent_matrix,
    localizedHeuristics: config.localizedHeuristics,
    businessRulesSchema: config.businessRulesSchema || config.business_rules_schema,
  };

  await tenantContextStorage.run(activeContext, async () => {
    for (const q of QUERIES) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`[TEST] ${q.label}`);
      console.log(`Query: "${q.text}"`);
      console.log(`${"=".repeat(80)}`);

      // Phase 1: Product match
      const matchStart = Date.now();
      const matchedProduct = await matchProductForMessage(COMPANY_ID, q.text);
      const matchTime = Date.now() - matchStart;

      // Build the same menuSnapshotForAi the orchestrator builds
      let menuSnapshotForAi: string;
      if (matchedProduct) {
        const tier = matchedProduct.confidenceTier;
        const stockNote = matchedProduct.stockStatus === "OUT_OF_STOCK" ? " (OUT OF STOCK)" : matchedProduct.stockStatus === "LOW_STOCK" ? " (LOW STOCK)" : "";
        const tierNote = tier === "LOW" ? " (UNVERIFIED — ask customer to confirm)" : "";
        menuSnapshotForAi = `Matched Product: ${matchedProduct.name}${matchedProduct.variant ? ` (${matchedProduct.variant})` : ""} — Confidence: ${tier}${tierNote}${stockNote}`;
      } else {
        menuSnapshotForAi = "No matching products found.";
      }

      console.log(`\n  Match:  ${matchedProduct ? `${matchedProduct.name} (tier: ${matchedProduct.confidenceTier}, score: ${matchedProduct.score.toFixed(6)}, stock: ${matchedProduct.stockStatus})` : "null"}`);
      console.log(`  Reason: ${matchedProduct?.matchReason || "N/A"}`);
      console.log(`  Match time: ${matchTime}ms`);
      console.log(`  Menu snapshot: ${menuSnapshotForAi}`);

      // Phase 2: Generate reply via LLM
      const llmStart = Date.now();
      try {
        const result = await generateShopReply({
          tenant_id: COMPANY_ID,
          user_message: q.text,
          session_state: {},
          menu_snapshot: menuSnapshotForAi,
          matched_product: matchedProduct,
          detected_language: "en",
          activeRules: null,
          conversation_history: [{ sender: "CLIENT", content: q.text }],
          active_draft_order: null,
        });
        const llmTime = Date.now() - llmStart;

        console.log(`\n  LLM reply:  ${result.replyText}`);
        console.log(`  Intent:     ${result.intent_type}`);
        console.log(`  LLM time:   ${llmTime}ms`);
        console.log(`  Thread summary: ${result.thread_summary.slice(0, 200)}`);
      } catch (err: any) {
        const llmTime = Date.now() - llmStart;
        console.log(`\n  LLM ERROR: ${err?.message?.slice(0, 300)}`);
        console.log(`  LLM time:   ${llmTime}ms`);
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("All 5 queries completed.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("FATAL:", err?.message, err?.stack);
  process.exit(1);
});
