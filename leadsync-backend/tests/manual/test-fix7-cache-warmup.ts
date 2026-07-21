/**
 * Fix 7 test: cache warm-up verification.
 */
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

const cacheMap = () => (conversationalAutoReplyService as any).rulesCache as Map<string, { rules: any[]; cachedAt: number }>;

async function main() {
  try {
    await withTestCompany("FIX7", async (testCompany) => {
      const companyId = testCompany.id;
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: "fix7-test", channel: Channel.TELEGRAM, name: "Fix7 User" },
      });
      await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      await tenantContextStorage.run(contextStore, async () => {
        await prisma.conversationalRule.create({
          data: {
            companyId,
            name: "Cache Test Rule",
            isEnabled: true,
            triggerKeywords: ["hello"],
            triggerType: "TEXT_MATCH",
            templateBody: "Hi there!",
          },
        });

        console.log("=== FIX 7: CACHE WARM-UP ===\n");

        // Step 1: Prime the cache
        console.log("Step 1: Priming cache via getActiveRules()...");
        await (conversationalAutoReplyService as any).getActiveRules(companyId);
        const afterPrime = cacheMap().get(companyId);
        console.log("  Cache populated: " + (afterPrime ? "YES" : "NO"));
        if (afterPrime) {
          console.log("  Rules count: " + afterPrime.rules.length);
          console.log("  Cached at: " + new Date(afterPrime.cachedAt).toISOString());
        }

        // Step 2: Invalidate
        console.log("\nStep 2: Calling invalidateCache()...");
        conversationalAutoReplyService.invalidateCache(companyId);
        const afterDelete = cacheMap().get(companyId);
        console.log("  Cache key deleted: " + (afterDelete ? "NO (still exists)" : "YES (deleted)"));

        // Step 3: Wait for fire-and-forget warm-up
        console.log("\nStep 3: Waiting for fire-and-forget warm-up (1.5s)...");
        await new Promise((r) => setTimeout(r, 1500));
        const afterWarmup = cacheMap().get(companyId);
        console.log("  Cache repopulated: " + (afterWarmup ? "YES" : "NO"));
        if (afterWarmup) {
          console.log("  Rules count: " + afterWarmup.rules.length);
          console.log("  Cached at: " + new Date(afterWarmup.cachedAt).toISOString());
          console.log("  Cache age now: " + (Date.now() - afterWarmup.cachedAt) + "ms (should be ~1500ms)");
        }

        console.log("\n=== FIX 7 SUMMARY ===");
        if (afterPrime && !afterDelete && afterWarmup) {
          console.log("PASS: Cache invalidation + warm-up chain works correctly.");
        } else if (!afterPrime) {
          console.log("FAIL: Cache was not primed in step 1.");
        } else if (afterDelete) {
          console.log("FAIL: Cache key was not deleted by invalidateCache().");
        } else if (!afterWarmup) {
          console.log("FAIL: Cache was not repopulated by fire-and-forget warm-up.");
        }
      });
    });
  } finally {
    await prisma.$disconnect();
  }
  console.log("\nDone.");
}

main();
