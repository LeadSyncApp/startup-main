/**
 * Fast rate-limiter verification — fires messages in parallel so
 * the cooldown window cannot expire between calls.
 */
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

const TEST_CONTACT = "rate-limit-parallel";

async function run() {
  await withTestCompany("RATE-LIMIT-FAST", async (testCompany) => {
    const companyId = testCompany.id;
    const createdRuleIds: string[] = [];

    // Intercept Telegram sends
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      if (typeof url === "string" && url.includes("sendMessage")) {
        // silent
      }
      return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
    };

    try {
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: TEST_CONTACT, channel: Channel.TELEGRAM, name: "Rate Limit Parallel" },
      });

      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      await tenantContextStorage.run(contextStore, async () => {
        const rule = await prisma.conversationalRule.create({
          data: {
            companyId, name: "Rate Limit Test",
            isEnabled: true, triggerKeywords: ["hello"], triggerType: "TEXT_MATCH",
            templateBody: "Hello!",
          },
        });
        createdRuleIds.push(rule.id);
        await embedRuleToKnowledgeChunk({
          id: rule.id, companyId,
          name: rule.name, triggerKeywords: rule.triggerKeywords as string[],
          templateBody: rule.templateBody,
        });
        conversationalAutoReplyService.invalidateCache(companyId);

        // Warm the cache first
        await conversationalAutoReplyService.evaluateMessage({
          companyId, conversationId: conv.id, leadId: lead.id,
          messageText: "warmup", customerName: "T", channel: "TELEGRAM", contact: TEST_CONTACT,
        });

        // Fire 10 messages IN PARALLEL — all arrive within milliseconds
        const message = "hello there";
        const promises = Array.from({ length: 10 }, (_, i) =>
          conversationalAutoReplyService.evaluateMessage({
            companyId, conversationId: conv.id, leadId: lead.id,
            messageText: message, customerName: "Test User",
            channel: "TELEGRAM", contact: TEST_CONTACT,
          }).then(r => ({ index: i + 1, matched: r.matched, response: r.response }))
        );

        const results = await Promise.all(promises);
        const matchCount = results.filter(r => r.matched).length;
        const suppressedCount = results.filter(r => !r.matched).length;

        console.log(`\n========================================`);
        console.log(`RATE LIMIT TEST (10 parallel messages):`);
        for (const r of results) {
          console.log(`  Message ${r.index}: ${r.matched ? "FIRED" : "SUPPRESSED"}${r.matched ? ` — "${r.response}"` : ""}`);
        }
        console.log(`========================================`);
        console.log(`  Fired:      ${matchCount}`);
        console.log(`  Suppressed: ${suppressedCount}`);
        console.log(`========================================`);

        if (matchCount >= 1 && matchCount <= 3) {
          console.log(`✅ PASS: Rate limiter active (${matchCount} fired, ${suppressedCount} suppressed in parallel burst).`);
        } else if (matchCount > 3) {
          console.log(`⚠️  Partial: ${matchCount} fired — cooldown may be too short or race condition exists.`);
        } else if (matchCount === 0) {
          console.log(`⚠️  No matches at all — check rule scoring.`);
        }
      });
    } catch (err: any) {
      console.error("TEST FAILED:", err.message);
    } finally {
      global.fetch = originalFetch;
      for (const rid of createdRuleIds) {
        await prisma.$executeRaw`
          DELETE FROM "KnowledgeChunk"
          WHERE "companyId" = ${companyId} AND "sourceType" = 'RULE'::"KnowledgeSourceType" AND "sourceId" = ${rid}
        `;
      }
      await prisma.conversationalRule.deleteMany({ where: { id: { in: createdRuleIds } } });
    }
  });
  await prisma.$disconnect();
}

run();
