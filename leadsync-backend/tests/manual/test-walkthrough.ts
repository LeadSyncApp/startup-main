import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { prisma } from "../../src/lib/prisma";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";

async function runTest() {
  const companyId = "6e91a188-f794-4c59-b367-44b9db07b10f"; // MD Homemades
  const externalChatId = "123456789"; // mock chat ID

  console.log("Initializing PgBoss...");
  await pgBossService.initialize();

  // Intercept global fetch to log requests to Telegram
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    console.log(`\n=== INTERCEPTED TELEGRAM API REQUEST ===`);
    console.log(`URL: ${url}`);
    if (options && options.body) {
      console.log(`Payload:\n${JSON.stringify(JSON.parse(options.body), null, 2)}`);
    }
    console.log(`========================================\n`);
    return {
      ok: true,
      text: async () => '{"ok":true}',
      json: async () => ({ ok: true })
    } as any;
  };

  try {
    console.log("Checking active surfaced rules...");
    const rules = await prisma.conversationalRule.findMany({
      where: { companyId, isEnabled: true },
      select: { id: true, name: true, surfaceConfig: true }
    });

    // Ensure we have a Category (Level 1) and a Leaf (Level 2)
    let categoryRule: any = rules.find((r: any) => (r.surfaceConfig as any)?.enabled && !(r.surfaceConfig as any).parentRuleId);
    if (!categoryRule) {
      console.log("Creating mock Category rule...");
      categoryRule = await prisma.conversationalRule.create({
        data: {
          companyId,
          name: "Mock Category",
          isEnabled: true,
          triggerKeywords: ["mock_category"],
          triggerType: "TEXT_MATCH",
          templateBody: "This is the Mock Category menu:",
          surfaceConfig: {
            enabled: true,
            channel: "TELEGRAM",
            buttonLabel: "Mock Category",
            command: "/mock_category",
            menuPosition: 1,
            parentRuleId: null
          }
        }
      });
    }

    let leafRule: any = rules.find((r: any) => (r.surfaceConfig as any)?.enabled && (r.surfaceConfig as any).parentRuleId === categoryRule.id);
    if (!leafRule) {
      console.log("Creating mock Leaf rule...");
      leafRule = await prisma.conversationalRule.create({
        data: {
          companyId,
          name: "Mock Leaf",
          isEnabled: true,
          triggerKeywords: ["mock_leaf"],
          triggerType: "TEXT_MATCH",
          templateBody: "This is the Mock Leaf response text.",
          surfaceConfig: {
            enabled: true,
            channel: "TELEGRAM",
            buttonLabel: "Mock Leaf",
            command: "/mock_leaf",
            menuPosition: 1,
            parentRuleId: categoryRule.id
          }
        }
      });
    }

    console.log(`Using Category: ${categoryRule.name} (${categoryRule.id})`);
    console.log(`Using Leaf: ${leafRule.name} (${leafRule.id})`);

    if (!categoryRule || !leafRule) {
      throw new Error("Category or Leaf rule was not resolved/created successfully.");
    }

    // Scenario 1: /start command (typed/sent) -> should send welcome text + root buttons
    console.log("\n--- SCENARIO 1: User types /start ---");
    await processWebhookJob({
      id: "job-1",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: "/start",
        isCallback: false,
        companyId
      }
    });

    // Scenario 2: Tap Category Button -> should edit message to show Category submenu
    console.log("\n--- SCENARIO 2: User taps Category button ---");
    await processWebhookJob({
      id: "job-2",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: categoryRule.id,
        isCallback: true,
        callbackData: categoryRule.id,
        callbackQueryId: "query-123",
        callbackMessageId: "987654", // message ID to edit
        companyId
      }
    });

    // Scenario 3: Tap Leaf Button -> should edit message to show Leaf response + nav buttons (Back, Main Menu)
    console.log("\n--- SCENARIO 3: User taps Leaf button ---");
    await processWebhookJob({
      id: "job-3",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: leafRule.id,
        isCallback: true,
        callbackData: leafRule.id,
        callbackQueryId: "query-456",
        callbackMessageId: "987654", // message ID to edit
        companyId
      }
    });

    // Scenario 4: Tap Back from Leaf -> should edit message back to Category submenu (Category ID callback)
    console.log("\n--- SCENARIO 4: User taps Back button from Leaf (goes to Category) ---");
    await processWebhookJob({
      id: "job-4",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: categoryRule.id,
        isCallback: true,
        callbackData: categoryRule.id,
        callbackQueryId: "query-789",
        callbackMessageId: "987654",
        companyId
      }
    });

    // Scenario 5: Tap Back from Category (goes to Root) -> should edit message to Root menu (back_root callback)
    console.log("\n--- SCENARIO 5: User taps Back button from Category (goes to Root) ---");
    await processWebhookJob({
      id: "job-5",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: "back_root",
        isCallback: true,
        callbackData: "back_root",
        callbackQueryId: "query-abc",
        callbackMessageId: "987654",
        companyId
      }
    });

    // Scenario 6: Typed command directly (e.g. /mock_leaf) -> should send new message (no edit)
    console.log("\n--- SCENARIO 6: User types /mock_leaf command directly ---");
    await processWebhookJob({
      id: "job-6",
      data: {
        channel: "TELEGRAM" as any,
        externalChatId,
        text: "/mock_leaf",
        isCallback: false,
        companyId
      }
    });

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    global.fetch = originalFetch;
    await pgBossService.stop().catch(() => {});
  }
}

runTest().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
