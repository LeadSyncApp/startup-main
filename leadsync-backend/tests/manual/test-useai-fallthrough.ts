import { prisma } from "../../src/lib/prisma";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { processWebhookJob } from "../../src/services/workers/ai.orchestrator.worker";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { pgBossService } from "../../src/services/infrastructure/pgboss/pgboss.service";
import { Channel, ConversationStatus } from "@prisma/client";
import { withTestCompany } from "./testCompanyFactory";

// Mock pgboss in standalone script
(pgBossService as any).getBoss = () => ({
  send: async () => {}
});

async function runTest() {
  await withTestCompany("USEAI-FALLTHROUGH", async (company) => {
    const companyId = company.id;
    let interceptedMessage: string | null = null;
    const originalFetch = global.fetch;

    global.fetch = async (url: any, options: any) => {
      if (typeof url === "string" && url.includes("sendMessage")) {
        console.log(`\n=== INTERCEPTED TELEGRAM OUTBOUND ===`);
        console.log(`URL: ${url}`);
        if (options && options.body) {
          const body = JSON.parse(options.body);
          console.log(`Payload:\n${JSON.stringify(body, null, 2)}`);
          interceptedMessage = body.text;
        }
        console.log(`====================================\n`);
      }
      return {
        ok: true,
        text: async () => '{"ok":true}',
        json: async () => ({ ok: true })
      } as any;
    };

    try {
      const contextStore = await resolveTenantContext(companyId);

      // 1. Create a rule with useAI = true and trigger keyword "saffron"
      console.log("Creating temporary useAI=true conversational rule...");
      const rule = await prisma.conversationalRule.create({
        data: {
          companyId,
          name: "Test AI Saffron Rule",
          isEnabled: true,
          triggerKeywords: ["saffron"],
          triggerType: "TEXT_MATCH",
          useAI: true,
          sourcePrompt: "Inform the customer that we have premium Kashmiri Saffron available for Rs 300 per gram.",
          templateBody: "Canned Saffron response: We sell Saffron.",
        }
      });
      console.log(`Created rule ID: ${rule.id}`);

      // Create a temporary lead and conversation
      const contact = "123456-useai";
      let lead = await prisma.lead.create({
        data: { companyId, contact, channel: Channel.TELEGRAM, name: "Test AI User" }
      });

      const conversation = await prisma.conversation.create({
        data: {
          companyId,
          channel: Channel.TELEGRAM,
          status: ConversationStatus.OPEN,
          leadId: lead.id
        }
      });

      // Run tests within tenant context
      await tenantContextStorage.run(contextStore, async () => {
        const context = {
          companyId,
          conversationId: conversation.id,
          leadId: lead.id,
          messageText: "Hello, do you sell saffron?",
          customerName: lead.name || undefined,
          channel: "TELEGRAM" as any,
          contact: contact,
        };

        console.log("\n--- STEP 1: Evaluating message via evaluateMessage ---");
        const matchResult = await conversationalAutoReplyService.evaluateMessage(context);
        console.log("Match Result:", JSON.stringify(matchResult, null, 2));

        if (matchResult.matched === false) {
          console.log("✅ SUCCESS: evaluateMessage returned matched=false. Canned reply bypassed successfully.");
        } else {
          throw new Error("❌ FAILURE: evaluateMessage incorrectly matched and/or sent a canned reply.");
        }

        console.log("\n--- STEP 2: Executing full orchestrator via processWebhookJob ---");
        conversationalAutoReplyService.invalidateCache(companyId);

        await processWebhookJob({
          id: "job-test-useai-1",
          data: {
            channel: Channel.TELEGRAM as any,
            externalChatId: contact,
            text: "Hello, do you sell saffron?",
            contactName: "Test AI User",
            isCallback: false,
            companyId,
          }
        });

        console.log("\n--- STEP 3: Verifying AI-generated response content ---");
        if (!interceptedMessage) {
          throw new Error("❌ FAILURE: No outbound message was intercepted.");
        }

        console.log(`Intercepted Message Text: "${interceptedMessage}"`);

        const rawCanned = "Canned Saffron response: We sell Saffron.";
        if ((interceptedMessage as string).trim() === rawCanned) {
          throw new Error("❌ FAILURE: Sent the canned templateBody verbatim!");
        }

        const containsSaffron = (interceptedMessage as string).toLowerCase().includes("saffron") || (interceptedMessage as string).toLowerCase().includes("kesar");
        const containsPrice = (interceptedMessage as string).includes("300");

        if (containsSaffron && containsPrice) {
          console.log("✅ SUCCESS: The response is dynamically generated, incorporates the Kashmir saffron instruction and price (300), and is NOT the canned templateBody.");
        } else {
          console.log("⚠️ WARNING: Response did not explicitly contain the Kashmiri Saffron or price instructions. Please check context matching.");
        }
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
  await prisma.$disconnect();
}

runTest();


