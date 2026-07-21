/**
 * Verification script for keyword-match specificity scoring changes.
 * 
 * Tests:
 * 1. Specificity: "briyani" vs "briyani offer" — which rule wins for "do you have briyani offer?"
 * 2. Ambiguity: two close-scoring rules — does ambiguity log fire and fall through to AI?
 * 3. SINGLE_RULE_MIN_SCORE: single-candidate case — does it now match when score >= 0.70?
 * 4. Side-effect audit: list all existing single-keyword rules that would be affected.
 */
import { prisma } from "../../src/lib/prisma";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

const TEST_CONTACT = "verify-scoring-test";

async function run() {
  await withTestCompany("KEYWORD-SCORING", async (testCompany) => {
    const companyId = testCompany.id;
    let conversationId: string | null = null;
    let leadId: string | null = null;
    const createdRuleIds: string[] = [];

    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      if (typeof url === "string" && url.includes("sendMessage")) {
        console.log(`  [INTERCEPTED] Telegram sendMessage — not actually sending`);
      }
      return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
    };

    try {
      const contextStore = await resolveTenantContext(companyId);

      let lead = await prisma.lead.create({
        data: { companyId, contact: TEST_CONTACT, channel: Channel.TELEGRAM, name: "Verify Scoring User" },
      });
      leadId = lead.id;

      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });
      conversationId = conv.id;

      await tenantContextStorage.run(contextStore, async () => {
      // ====================================================================
      // TEST 1: Specificity — "briyani" vs "briyani offer"
      // ====================================================================
      console.log("\n" + "=".repeat(70));
      console.log("TEST 1: Specificity scoring — overlapping keywords");
      console.log("=".repeat(70));

      const ruleGeneric = await prisma.conversationalRule.create({
        data: {
          companyId: companyId!,
          name: "Briyani Generic (test)",
          isEnabled: true,
          triggerKeywords: ["briyani"],
          triggerType: "TEXT_MATCH",
          templateBody: "We have delicious briyani! Visit us to order.",
        },
      });
      createdRuleIds.push(ruleGeneric.id);

      const ruleSpecific = await prisma.conversationalRule.create({
        data: {
          companyId: companyId!,
          name: "Briyani Offer (test)",
          isEnabled: true,
          triggerKeywords: ["briyani offer"],
          triggerType: "TEXT_MATCH",
          templateBody: "Special briyani offer today — 20% off! Order now.",
        },
      });
      createdRuleIds.push(ruleSpecific.id);

      // IMPORTANT: Embed rules into KnowledgeChunks so retrieveSimilarChunks can find them
      console.log("  Embedding rules into KnowledgeChunks...");
      await embedRuleToKnowledgeChunk({
        id: ruleGeneric.id, companyId: companyId!,
        name: ruleGeneric.name, triggerKeywords: ruleGeneric.triggerKeywords as string[],
        templateBody: ruleGeneric.templateBody,
      });
      await embedRuleToKnowledgeChunk({
        id: ruleSpecific.id, companyId: companyId!,
        name: ruleSpecific.name, triggerKeywords: ruleSpecific.triggerKeywords as string[],
        templateBody: ruleSpecific.templateBody,
      });
      console.log("  Embedded successfully.");

      // Invalidate cache so new rules are picked up
      conversationalAutoReplyService.invalidateCache(companyId!);

      console.log(`\nCreated rules:`);
      console.log(`  Generic : ${ruleGeneric.id} — keywords: ["briyani"]`);
      console.log(`  Specific: ${ruleSpecific.id} — keywords: ["briyani offer"]`);

      // Test message: should favor the more specific rule
      const testMessage1 = "do you have briyani offer?";
      console.log(`\nSending message: "${testMessage1}"`);

      const result1 = await conversationalAutoReplyService.evaluateMessage({
        companyId: companyId!,
        conversationId: conv.id,
        leadId: lead.id,
        messageText: testMessage1,
        customerName: "Test User",
        channel: "TELEGRAM",
        contact: TEST_CONTACT,
      });

      console.log(`\nResult:`, JSON.stringify(result1, null, 2));

      if (result1.matched) {
        console.log(`\nWINNER: "${result1.ruleName}" (id: ${result1.ruleId})`);
        console.log(`Matched keywords: ${JSON.stringify(result1.matchedKeywords)}`);
        if (result1.ruleId === ruleSpecific.id) {
          console.log("✅ CORRECT: More specific rule won!");
        } else if (result1.ruleId === ruleGeneric.id) {
          console.log("⚠️  GENERIC rule won — specificity bonus was not enough to overcome base similarity gap.");
        } else {
          console.log(`⚠️  NEITHER test rule won — a pre-existing rule (${result1.ruleName}) beat both.`);
        }
      } else {
        console.log(`\nNo confident match — fell through to AI.`);
      }

      // ====================================================================
      // TEST 2: Ambiguity — two close-scoring rules
      // ====================================================================
      console.log("\n" + "=".repeat(70));
      console.log("TEST 2: Ambiguity detection — close-scoring rules");
      console.log("=".repeat(70));

      // Clean up Test 1 rules first so they don't interfere
      console.log("  Cleaning up Test 1 rules...");
      for (const rid of [ruleGeneric.id, ruleSpecific.id]) {
        await prisma.$executeRaw`
          DELETE FROM "KnowledgeChunk"
          WHERE "companyId" = ${companyId!}
            AND "sourceType" = 'RULE'::"KnowledgeSourceType"
            AND "sourceId" = ${rid}
        `;
      }
      await prisma.conversationalRule.deleteMany({
        where: { id: { in: [ruleGeneric.id, ruleSpecific.id] } },
      });
      createdRuleIds.splice(0, 2); // remove from cleanup list
      conversationalAutoReplyService.invalidateCache(companyId!);
      console.log("  Test 1 rules removed.");

      // Use keywords where NEITHER gets an exact phrase match in the test message,
      // so both get the same partial-overlap bonus. The gap should be tiny.
      const ruleA = await prisma.conversationalRule.create({
        data: {
          companyId: companyId!,
          name: "Chicken Biryani (test)",
          isEnabled: true,
          triggerKeywords: ["chicken briyani"],
          triggerType: "TEXT_MATCH",
          templateBody: "Our chicken biryani is made with basmati rice and authentic spices!",
        },
      });
      createdRuleIds.push(ruleA.id);

      const ruleB = await prisma.conversationalRule.create({
        data: {
          companyId: companyId!,
          name: "Mutton Biryani (test)",
          isEnabled: true,
          triggerKeywords: ["mutton briyani"],
          triggerType: "TEXT_MATCH",
          templateBody: "Our mutton biryani uses tender lamb pieces slow-cooked to perfection!",
        },
      });
      createdRuleIds.push(ruleB.id);

      // Embed both
      console.log("  Embedding chicken/mutton biryani rules...");
      for (const r of [ruleA, ruleB]) {
        await embedRuleToKnowledgeChunk({
          id: r.id, companyId: companyId!,
          name: r.name, triggerKeywords: r.triggerKeywords as string[],
          templateBody: r.templateBody,
        });
      }
      console.log("  Embedded successfully.");

      conversationalAutoReplyService.invalidateCache(companyId!);

      console.log(`\nCreated rules:`);
      console.log(`  A: ${ruleA.id} — keywords: ["chicken briyani"]`);
      console.log(`  B: ${ruleB.id} — keywords: ["mutton briyani"]`);

      // Message that only mentions "briyani" — neither rule gets exact phrase match
      const testMessage2 = "what briyani options do you have?";
      console.log(`\nSending message: "${testMessage2}"`);
      console.log(`(Neither "chicken briyani" nor "mutton briyani" appears exactly)`);

      // Capture console.log to detect ambiguity log lines
      const originalLog = console.log;
      let ambiguityLogCaptured = "";
      console.log = (...args: any[]) => {
        const line = args.join(" ");
        if (line.includes("AMBIGUITY")) {
          ambiguityLogCaptured = line;
        }
        originalLog(...args);
      };

      const result2 = await conversationalAutoReplyService.evaluateMessage({
        companyId: companyId!,
        conversationId: conv.id,
        leadId: lead.id,
        messageText: testMessage2,
        customerName: "Test User",
        channel: "TELEGRAM",
        contact: TEST_CONTACT,
      });

      // Restore console.log
      console.log = originalLog;

      console.log(`\nResult:`, JSON.stringify(result2, null, 2));

      if (ambiguityLogCaptured) {
        console.log(`\n✅ AMBIGUITY LOG captured:`);
        // Pretty-print the JSON portion
        const jsonStart = ambiguityLogCaptured.indexOf("{");
        if (jsonStart >= 0) {
          try {
            const parsed = JSON.parse(ambiguityLogCaptured.substring(jsonStart));
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(ambiguityLogCaptured);
          }
        } else {
          console.log(ambiguityLogCaptured);
        }
      } else if (result2.matched) {
        console.log(`\nRule matched directly — scores were NOT ambiguous (clear winner).`);
      } else {
        console.log(`\nFell through to AI but no ambiguity log captured.`);
      }

      // ====================================================================
      // TEST 3: SINGLE_RULE_MIN_SCORE — single candidate
      // ====================================================================
      console.log("\n" + "=".repeat(70));
      console.log("TEST 3: SINGLE_RULE_MIN_SCORE activation — single candidate");
      console.log("=".repeat(70));

      const ruleSolo = await prisma.conversationalRule.create({
        data: {
          companyId: companyId!,
          name: "Samosa Special (test)",
          isEnabled: true,
          triggerKeywords: ["samosa"],
          triggerType: "TEXT_MATCH",
          templateBody: "Try our crispy samosas!",
        },
      });
      createdRuleIds.push(ruleSolo.id);

      // Embed it
      console.log("  Embedding samosa rule...");
      await embedRuleToKnowledgeChunk({
        id: ruleSolo.id, companyId: companyId!,
        name: ruleSolo.name, triggerKeywords: ruleSolo.triggerKeywords as string[],
        templateBody: ruleSolo.templateBody,
      });
      console.log("  Embedded successfully.");

      conversationalAutoReplyService.invalidateCache(companyId!);

      const testMessage3 = "do you have samosa?";
      console.log(`\nCreated solo rule: ${ruleSolo.id} — keywords: ["samosa"]`);
      console.log(`Sending message: "${testMessage3}"`);
      console.log(`(Other test rules exist but have different keywords — may or may not compete)`);

      const result3 = await conversationalAutoReplyService.evaluateMessage({
        companyId: companyId!,
        conversationId: conv.id,
        leadId: lead.id,
        messageText: testMessage3,
        customerName: "Test User",
        channel: "TELEGRAM",
        contact: TEST_CONTACT,
      });

      console.log(`\nResult:`, JSON.stringify(result3, null, 2));

      if (result3.matched) {
        console.log(`\nRule MATCHED: "${result3.ruleName}" (id: ${result3.ruleId})`);
        if (result3.ruleId === ruleSolo.id) {
          console.log("✅ Solo test rule won — SINGLE_RULE_MIN_SCORE worked.");
        } else {
          console.log(`⚠️  A different rule won (not the solo test rule).`);
        }
      } else {
        console.log(`\nRule did NOT match — fell through to AI.`);
      }

      // ====================================================================
      // TEST 4: Side-effect audit — existing single-keyword rules
      // ====================================================================
      console.log("\n" + "=".repeat(70));
      console.log("TEST 4: Side-effect audit — existing active rules");
      console.log("=".repeat(70));

      // First, clean up the test rules we created so the audit is clean
      // (Delete KnowledgeChunks first, then rules)
      for (const rid of createdRuleIds) {
        await prisma.$executeRaw`
          DELETE FROM "KnowledgeChunk"
          WHERE "companyId" = ${companyId!}
            AND "sourceType" = 'RULE'::"KnowledgeSourceType"
            AND "sourceId" = ${rid}
        `;
      }
      await prisma.conversationalRule.deleteMany({ where: { id: { in: createdRuleIds } } });
      console.log(`  Cleaned up ${createdRuleIds.length} test rules + their KnowledgeChunks.`);
      createdRuleIds.length = 0; // prevent double-delete in finally

      conversationalAutoReplyService.invalidateCache(companyId!);

      // Now audit the REAL production rules
      const allActiveRules = await prisma.conversationalRule.findMany({
        where: { companyId: companyId!, isEnabled: true, useAI: false },
        select: {
          id: true,
          name: true,
          triggerKeywords: true,
          ruleType: true,
          templateBody: true,
        },
      });

      const singleKeywordRules = allActiveRules.filter((r) => {
        const kw = r.triggerKeywords as string[];
        return kw && kw.length === 1;
      });

      const multiKeywordRules = allActiveRules.filter((r) => {
        const kw = r.triggerKeywords as string[];
        return kw && kw.length > 1;
      });

      console.log(`\nTotal active non-AI rules: ${allActiveRules.length}`);
      console.log(`Single-keyword rules: ${singleKeywordRules.length}`);
      console.log(`Multi-keyword rules: ${multiKeywordRules.length}`);

      if (singleKeywordRules.length > 0) {
        console.log(`\n⚠️  SINGLE-KEYWORD RULES (affected by SINGLE_RULE_MIN_SCORE activation):`);
        console.log(`   Previously these ALWAYS fell through to AI (single candidate = not confident).`);
        console.log(`   NOW they will match if their final score >= 0.70 (template reply sent directly).`);
        console.log("");
        for (const r of singleKeywordRules) {
          const kw = (r.triggerKeywords as string[])[0];
          const hasKnowledgeChunk = await prisma.$queryRaw<{ cnt: bigint }[]>`
            SELECT COUNT(*) as cnt FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId!}
              AND "sourceType" = 'RULE'::"KnowledgeSourceType"
              AND "sourceId" = ${r.id}
              AND "isActive" = true
          `;
          const embedded = hasKnowledgeChunk[0]?.cnt > 0n;
          console.log(`   - "${r.name}" (${r.id})`);
          console.log(`     keyword: "${kw}"`);
          console.log(`     embedded in KnowledgeChunk: ${embedded ? "YES" : "NO — will NOT be found by similarity search"}`);
          console.log(`     template: ${(r.templateBody || "").substring(0, 80)}${(r.templateBody || "").length > 80 ? "..." : ""}`);
          console.log("");
        }
        console.log(`   👆 These rules will send their canned templateBody directly`);
        console.log(`      instead of falling through to AI for dynamic elaboration.`);
        console.log(`      Review whether the template is good enough as a standalone reply.`);
      } else {
        console.log(`\n✅ No single-keyword rules found — no side effects from SINGLE_RULE_MIN_SCORE.`);
      }

      if (multiKeywordRules.length > 0) {
        console.log(`\nMulti-keyword rules (unaffected by SINGLE_RULE_MIN_SCORE): ${multiKeywordRules.length}`);
        for (const r of multiKeywordRules) {
          const kw = (r.triggerKeywords as string[]).join(", ");
          console.log(`   - "${r.name}": [${kw}]`);
        }
      }
      });
    } catch (err: any) {
      console.error("TEST FAILED:", err);
      console.error(err.stack);
    } finally {
      global.fetch = originalFetch;
    }
  });
  await prisma.$disconnect();
}

run();

