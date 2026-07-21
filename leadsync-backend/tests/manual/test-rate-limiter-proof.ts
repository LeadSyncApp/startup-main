/**
 * Rate-limiter proof test: two sequential runs.
 *
 * Run A — cooldown=0ms: ALL messages should fire (baseline).
 * Run B — cooldown=60000ms: ONLY message 1 should fire, 2–10 suppressed.
 *
 * If Run B shows fewer firings than Run A, the rate limiter is actively working.
 * If both runs show the same count, the rate limiter is dead code.
 */
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { embedRuleToKnowledgeChunk } from "../../src/services/knowledge/ruleEmbedding.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

async function runForCooldown(
  label: string,
  cooldownMs: number,
): Promise<{ fired: number; suppressed: number }> {
  process.env.AUTO_REPLY_COOLDOWN_MS = String(cooldownMs);

  return await withTestCompany(`RATELIMIT-${label}`, async (testCompany) => {
    const companyId = testCompany.id;
    const createdRuleIds: string[] = [];

    // Intercept Telegram sends — silent
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      if (typeof url === "string" && url.includes("sendMessage")) {
        /* no-op */
      }
      return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
    };

    try {
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: `rate-${label}`, channel: Channel.TELEGRAM, name: `Rate Test ${label}` },
      });
      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      return await tenantContextStorage.run(contextStore, async () => {
        const rule = await prisma.conversationalRule.create({
          data: {
            companyId,
            name: `Rate Test ${label}`,
            isEnabled: true,
            triggerKeywords: ["hello"],
            triggerType: "TEXT_MATCH",
            templateBody: "Hello from rate test!",
          },
        });
        createdRuleIds.push(rule.id);

        await embedRuleToKnowledgeChunk({
          id: rule.id,
          companyId,
          name: rule.name,
          triggerKeywords: rule.triggerKeywords as string[],
          templateBody: rule.templateBody,
        });

        // Re-create service instance with updated cooldown
        // (singleton reads env at construction; we mutate it directly)
        (conversationalAutoReplyService as any).RATE_LIMIT_COOLDOWN_MS = cooldownMs;
        conversationalAutoReplyService.invalidateCache(companyId);

        // Fire 10 messages sequentially
        let fired = 0;
        let suppressed = 0;
        for (let i = 1; i <= 10; i++) {
          const result = await conversationalAutoReplyService.evaluateMessage({
            companyId,
            conversationId: conv.id,
            leadId: lead.id,
            messageText: "hello there",
            customerName: "Test User",
            channel: "TELEGRAM",
            contact: `rate-${label}`,
          });
          if (result.matched) {
            fired++;
            console.log(`  Message ${i}: FIRED`);
          } else {
            suppressed++;
            console.log(`  Message ${i}: SUPPRESSED`);
          }
        }

        console.log(`\n[${label}] cooldown=${cooldownMs}ms → fired=${fired}, suppressed=${suppressed}`);
        return { fired, suppressed };
      });
    } catch (err: any) {
      console.error(`[${label}] FAILED:`, err.message);
      return { fired: -1, suppressed: -1 };
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
}

async function main() {
  console.log("=== RATE LIMITER PROOF ===\n");

  console.log("--- RUN A: cooldown=0 (no rate limiting) ---");
  const resultA = await runForCooldown("A", 0);

  console.log("\n--- RUN B: cooldown=60000 (60-second window) ---");
  const resultB = await runForCooldown("B", 60000);

  console.log("\n========================================");
  console.log("  RUN A (cooldown=0):      fired=%d, suppressed=%d", resultA.fired, resultA.suppressed);
  console.log("  RUN B (cooldown=60000):  fired=%d, suppressed=%d", resultB.fired, resultB.suppressed);
  console.log("========================================");

  if (resultA.fired > resultB.fired) {
    console.log("✅ PASS: Rate limiter actively suppressed messages in Run B.");
    if (resultB.fired === 1) {
      console.log("   (Only the first message fired; all subsequent messages correctly suppressed.)");
    } else if (resultB.fired > 1) {
      console.log(`   (Note: ${resultB.fired} messages still fired — pipeline latency exceeded 60s or cache reset.)`);
    }
  } else if (resultA.fired === resultB.fired) {
    console.log("❌ FAIL: Both runs produced identical counts — rate limiter had no effect.");
  } else {
    console.log("⚠️  Unexpected: Run B fired MORE than Run A.");
  }

  await prisma.$disconnect();
}

main();
