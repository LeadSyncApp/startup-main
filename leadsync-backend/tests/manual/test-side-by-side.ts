/**
 * Side-by-side proof: test-simulator endpoint vs live evaluateMessage pipeline,
 * PLUS template variable case-insensitivity verification.
 *
 * Fix 2: Both paths must produce the same match/no-match decision for the same message.
 * Fix 6: Template variables {shopName} / {shopname} / {SHOPNAME} / {ShopName}
 *         must all resolve the same way (case-insensitive /gi regex).
 */
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

async function main() {
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    if (typeof url === "string" && (url.includes("sendMessage") || url.includes("answerCallbackQuery"))) {
      /* silent */
    }
    return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
  };

  try {
    await withTestCompany("SIDEBYSIDE", async (testCompany) => {
      const companyId = testCompany.id;
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: "side-by-side-test", channel: Channel.TELEGRAM, name: "Side By Side" },
      });
      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      await tenantContextStorage.run(contextStore, async () => {
        // =====================================================
        // Create a rule (also with mixed-case template vars for Fix 6)
        // =====================================================
        const rule = await prisma.conversationalRule.create({
          data: {
            companyId,
            name: "Briyani Offer",
            isEnabled: true,
            triggerKeywords: ["briyani offer"],
            triggerType: "TEXT_MATCH",
            templateBody: "Hi {customerName}! Try our {shopName} briyani — only Rs. {{299}}! {{shopname}} loves {SHOPNAME} and {ShopName}.",
          },
        });

        await embedRuleToKnowledgeChunk({
          id: rule.id,
          companyId,
          name: rule.name,
          triggerKeywords: rule.triggerKeywords as string[],
          templateBody: rule.templateBody,
        });

        conversationalAutoReplyService.invalidateCache(companyId);

        const sampleMessage = "do you have any briyani offer today?";

        // =====================================================
        // Fix 2: Test-simulator path (testRule)
        // =====================================================
        console.log("=== FIX 2: SIDE-BY-SIDE COMPARISON ===\n");

        const simResult = await conversationalAutoReplyService.testRule(rule.id, sampleMessage);
        console.log("[TEST-SIMULATOR] testRule() result:");
        console.log(`  matched:         ${simResult.matched}`);
        console.log(`  matchedKeywords: ${JSON.stringify(simResult.matchedKeywords)}`);
        console.log(`  response:        "${simResult.response}"`);

        // =====================================================
        // Fix 2: Live Telegram path (evaluateMessage)
        // =====================================================
        // Clear the rate limiter for this test conversation
        (conversationalAutoReplyService as any).lastTriggerTimestamps.delete(`${companyId}:${conv.id}`);

        const liveResult = await conversationalAutoReplyService.evaluateMessage({
          companyId,
          conversationId: conv.id,
          leadId: lead.id,
          messageText: sampleMessage,
          customerName: "Raju",
          channel: "TELEGRAM",
          contact: "side-by-side-test",
        });
        console.log("\n[LIVE-TELEGRAM] evaluateMessage() result:");
        console.log(`  matched:            ${liveResult.matched}`);
        console.log(`  ruleId:             ${liveResult.ruleId || null}`);
        console.log(`  ruleName:           ${liveResult.ruleName || null}`);
        console.log(`  matchedKeywords:    ${JSON.stringify(liveResult.matchedKeywords)}`);
        console.log(`  response:           "${liveResult.response}"`);

        // =====================================================
        // Compare
        // =====================================================
        console.log("\n=== COMPARISON ===");
        const matchDecisionMatch = simResult.matched === liveResult.matched;
        console.log(`  Match decision same?    ${matchDecisionMatch ? "✅ YES" : "❌ NO"}`);

        let keywordsMatch = false;
        if (simResult.matched && liveResult.matchedKeywords) {
          const simKeys = [...simResult.matchedKeywords].sort();
          const liveKeys = [...liveResult.matchedKeywords].sort();
          keywordsMatch = JSON.stringify(simKeys) === JSON.stringify(liveKeys);
          console.log(`  Matched keywords same? ${keywordsMatch ? "✅ YES" : "❌ NO"}`);
          if (!keywordsMatch) {
            console.log(`    Simulator: ${JSON.stringify(simKeys)}`);
            console.log(`    Live:      ${JSON.stringify(liveKeys)}`);
          }
        } else {
          console.log(`  Matched keywords same? N/A (not both matched)`);
        }

        if (matchDecisionMatch && keywordsMatch) {
          console.log("\n✅ FIX 2 PROVEN: test-simulator and live Telegram pipeline produce identical results.");
        } else {
          console.log("\n⚠️  FIX 2: Discrepancy found — investigate.");
        }

        // =====================================================
        // Fix 6: Template variable case-insensitivity
        // =====================================================
        console.log("\n=== FIX 6: TEMPLATE VARIABLE CASE-INSENSITIVITY ===\n");
        console.log("  Template: \"Hi {customerName}! Try our {shopName} briyani — only Rs. {{299}}! {{shopname}} loves {SHOPNAME} and {ShopName}.\"");
        console.log(`  Resolved: "${liveResult.response}"`);

        // Expected: all {shopName} variants replaced with "" (the service replaces shopName with "")
        // {customerName} replaced with "Raju"
        // {{299}} replaced with "Rs. 299"
        const expected = "Hi Raju! Try our  briyani — only Rs. 299!  loves  and .";
        // But note: the replacement happens sequentially, and the whitespace left by empty replacements
        // might differ. Let's check if all variable patterns got replaced:
        const hasUnresolvedCustomer = /\{customerName\}/i.test(liveResult.response);
        const hasUnresolvedShop = /\{(?:shopName|shopname|SHOPNAME|ShopName)\}/.test(liveResult.response);
        // {{shopname}} — this uses double braces but shopname/shopName. Let me check the regex.
        // The code replaces {{shopName}} on line 689, but what about {{shopname}} (lowercase)?
        // The /gi flag makes it case-insensitive, so {{shopname}} should also match {{shopName}}/gi

        // Let me trace: template has "{{shopname}}" and regex is /\{\{shopName\}\}/gi
        // With /gi: {{shopname}} DOES match /\{\{shopName\}\}/gi — YES, case-insensitive
        // Same for {SHOPNAME} matching /\{shopName\}/gi and {ShopName} matching /\{shopName\}/gi

        console.log(`  Unresolved {customerName}? ${hasUnresolvedCustomer ? "❌ YES" : "✅ NO"}`);
        console.log(`  Unresolved {shopName} vars?  ${hasUnresolvedShop ? "❌ YES" : "✅ NO"}`);
        console.log(`  {{299}} rendered?            ${liveResult.response.includes("Rs. 299") ? "✅ YES" : "❌ NO"}`);

        if (!hasUnresolvedCustomer && !hasUnresolvedShop && liveResult.response.includes("Rs. 299")) {
          console.log("\n✅ FIX 6 PROVEN: All template variables resolved correctly regardless of case.");
        } else {
          console.log("\n⚠️  Some variables not resolved — investigate regex flags.");
        }
      });
    });
  } finally {
    global.fetch = originalFetch;
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main();
