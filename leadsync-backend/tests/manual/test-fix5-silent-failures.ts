/**
 * Fix 5 test: executeRuleById with nonexistent / disabled / enabled rules.
 */
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { prisma } from "../../src/lib/prisma";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

async function main() {
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    if (typeof url === "string" && (url.includes("sendMessage") || url.includes("answerCallbackQuery"))) {
      console.log("  [INTERCEPTED] " + (url.includes("answerCallbackQuery") ? "answerCallbackQuery" : "sendMessage"));
    }
    return { ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true }) } as any;
  };

  try {
    await withTestCompany("FIX5", async (testCompany) => {
      const companyId = testCompany.id;
      const contextStore = await resolveTenantContext(companyId);

      const lead = await prisma.lead.create({
        data: { companyId, contact: "fix5-test", channel: Channel.TELEGRAM, name: "Fix5 User" },
      });
      const conv = await prisma.conversation.create({
        data: { companyId, channel: Channel.TELEGRAM, status: ConversationStatus.OPEN, leadId: lead.id },
      });

      await tenantContextStorage.run(contextStore, async () => {
        console.log("=== FIX 5: executeRuleById with bad inputs ===\n");

        const fakeId = "00000000-0000-0000-0000-000000000000";
        const callbackContext = {
          companyId,
          conversationId: conv.id,
          leadId: lead.id,
          messageText: "/old-command",
          customerName: "Fix5 User",
          channel: "TELEGRAM" as const,
          contact: "fix5-test",
          isCallback: true,
          callbackQueryId: "test-callback-id-12345",
        };

        console.log("Test A: nonexistent rule ID with isCallback=true");
        console.log("  Calling executeRuleById...");
        const resultA = await conversationalAutoReplyService.executeRuleById(fakeId, callbackContext);
        console.log("  Result: " + resultA + " (expected: false)");
        console.log(resultA === false ? "  PASS: returned false (no exception)" : "  FAIL");

        // Test B: rule exists but is disabled
        console.log("\nTest B: disabled rule with isCallback=true");
        const disabledRule = await prisma.conversationalRule.create({
          data: {
            companyId,
            name: "Disabled Test Rule",
            isEnabled: false,
            triggerKeywords: ["test"],
            triggerType: "TEXT_MATCH",
            templateBody: "Should not fire",
          },
        });

        const resultB = await conversationalAutoReplyService.executeRuleById(disabledRule.id, callbackContext);
        console.log("  Result: " + resultB + " (expected: false for disabled rule)");
        console.log(resultB === false ? "  PASS: disabled rule returns false" : "  FAIL");

        // Test C: valid enabled rule
        console.log("\nTest C: valid enabled rule (should succeed)");
        const enabledRule = await prisma.conversationalRule.create({
          data: {
            companyId,
            name: "Enabled Test Rule",
            isEnabled: true,
            triggerKeywords: ["test"],
            triggerType: "TEXT_MATCH",
            templateBody: "Hello from enabled rule!",
          },
        });

        const resultC = await conversationalAutoReplyService.executeRuleById(enabledRule.id, {
          ...callbackContext,
          isCallback: false,
        });
        console.log("  Result: " + resultC + " (expected: true for enabled rule)");
        console.log(resultC === true ? "  PASS: enabled rule returns true" : "  FAIL");

        console.log("\n=== FIX 5 SUMMARY ===");
        const allPassed = resultA === false && resultB === false && resultC === true;
        console.log("  All tests " + (allPassed ? "PASSED" : "FAILED"));
        if (allPassed) {
          console.log("  executeRuleById gracefully handles nonexistent, disabled, and enabled rules.");
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
