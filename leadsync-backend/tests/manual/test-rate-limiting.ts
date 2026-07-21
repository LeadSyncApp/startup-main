/**
 * Verification: per-conversation rate limiter.
 * 
 * Sends 10 identical messages from the same conversation within ~1 second.
 * Expects far fewer than 10 replies — the cooldown (default 3s) should suppress
 * all but the first trigger within each window.
 */
import { prisma } from "../../src/lib/prisma";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

const TEST_CONTACT = "rate-limit-test-contact";

async function run() {
  await withTestCompany("RATE-LIMIT", async (testCompany) => {
    const companyId = testCompany.id;
    const createdRuleIds: string[] = [];

    // Intercept Telegram sends so we don't actually push to Telegram
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      if (typeof url === "string" && url.includes("sendMessage")) {
        console.log(`  [INTERCEPTED] Telegram sendMessage suppressed`);
      }
      return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
    };

    try {
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: TEST_CONTACT, channel: Channel.TELEGRAM, name: "Rate Limit User" },
      });

      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      await tenantContextStorage.run(contextStore, async () => {
        // Create a single rule to trigger on
        const rule = await prisma.conversationalRule.create({
          data: {
            companyId,
            name: "Rate Limit Test Rule",
            isEnabled: true,
            triggerKeywords: ["hello"],
            triggerType: "TEXT_MATCH",
            templateBody: "Hello! How can I help you?",
          },
        });
        createdRuleIds.push(rule.id);

        await embedRuleToKnowledgeChunk({
          id: rule.id, companyId,
          name: rule.name, triggerKeywords: rule.triggerKeywords as string[],
          templateBody: rule.templateBody,
        });

        conversationalAutoReplyService.invalidateCache(companyId);

        // Now send 10 rapid messages from the SAME conversation
        const message = "hello there";
        let matchCount = 0;
        let noMatchCount = 0;

        for (let i = 1; i <= 10; i++) {
          const result = await conversationalAutoReplyService.evaluateMessage({
            companyId,
            conversationId: conv.id,
            leadId: lead.id,
            messageText: message,
            customerName: "Test User",
            channel: "TELEGRAM",
            contact: TEST_CONTACT,
          });
          if (result.matched) {
            matchCount++;
            console.log(`  Message ${i}: MATCHED (reply: "${result.response}")`);
          } else {
            noMatchCount++;
            console.log(`  Message ${i}: SUPPRESSED (rate-limited or no match)`);
          }
        }

        console.log(`\n========================================`);
        console.log(`RESULTS:`);
        console.log(`  Total messages sent: 10`);
        console.log(`  Replies fired:       ${matchCount}`);
        console.log(`  Suppressed:          ${noMatchCount}`);
        console.log(`========================================`);
        console.log(`\nExpected: 1 reply fired, 9 suppressed (3s cooldown).`);
        if (matchCount === 1) {
          console.log(`✅ PASS: Rate limiter suppressed 9/10 duplicates.`);
        } else if (matchCount === 0) {
          console.log(`⚠️  Rule didn't match at all — check keyword scoring.`);
        } else if (matchCount > 1 && matchCount < 10) {
          console.log(`⚠️  Rate limiter partially working (${matchCount} fired, ${noMatchCount} suppressed).`);
        } else if (matchCount >= 10) {
          console.log(`❌ FAIL: All 10 messages fired — rate limiter is NOT active.`);
        }
      });
    } catch (err: any) {
      console.error("TEST FAILED:", err.message);
    } finally {
      global.fetch = originalFetch;
      // Cleanup
      for (const rid of createdRuleIds) {
        await prisma.$executeRaw`
          DELETE FROM "KnowledgeChunk"
          WHERE "companyId" = ${companyId}
            AND "sourceType" = 'RULE'::"KnowledgeSourceType"
            AND "sourceId" = ${rid}
        `;
      }
      await prisma.conversationalRule.deleteMany({ where: { id: { in: createdRuleIds } } });
    }
  });
  await prisma.$disconnect();
}

run();
