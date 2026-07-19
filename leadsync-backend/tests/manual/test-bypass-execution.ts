import { prisma } from "../../src/lib/prisma";
import { conversationalAutoReplyService } from "../../src/services/automation/conversationalAutoReply.service";
import { tenantContextStorage, resolveTenantContext } from "../../src/services/context/tenantContext.provider";
import { Channel, ConversationStatus } from "@prisma/client";

async function testBypass() {
  const companyId = "6e91a188-f794-4c59-b367-44b9db07b10f";

  // Intercept fetch
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
    // Resolve the tenant context
    const contextStore = await resolveTenantContext(companyId);

    // Create a temporary lead and conversation to satisfy foreign key constraints
    const contact = "123456";
    let lead = await prisma.lead.findFirst({
      where: { companyId, contact, channel: Channel.TELEGRAM }
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { companyId, contact, channel: Channel.TELEGRAM, name: "Test User" }
      });
    }

    if (!lead) {
      throw new Error("Failed to create test lead");
    }

    const conversation = await prisma.conversation.create({
      data: {
        companyId,
        channel: Channel.TELEGRAM,
        status: ConversationStatus.OPEN,
        leadId: lead.id
      }
    });

    await tenantContextStorage.run(contextStore, async () => {
      console.log("1. Testing resolveByCommand with '/sweets'...");
      const ruleId1 = await conversationalAutoReplyService.resolveByCommand(companyId, "/sweets");
      console.log("Resolved ruleId for '/sweets':", ruleId1);

      console.log("2. Testing resolveByCommand with '/sweets@Goofygr_bot'...");
      const ruleId2 = await conversationalAutoReplyService.resolveByCommand(companyId, "/sweets@Goofygr_bot");
      console.log("Resolved ruleId for '/sweets@Goofygr_bot':", ruleId2);

      if (ruleId1) {
        console.log("3. Testing executeRuleById on rule", ruleId1);
        const context: any = {
          companyId,
          conversationId: conversation.id,
          leadId: lead.id,
          messageText: "/sweets",
          channel: "TELEGRAM",
          contact: contact
        };
        const executed = await conversationalAutoReplyService.executeRuleById(ruleId1, context);
        console.log("executeRuleById returned:", executed);
      }
    });

    // Cleanup conversation
    await prisma.conversation.delete({ where: { id: conversation.id } });
  } finally {
    global.fetch = originalFetch;
  }
}

testBypass().catch(console.error).finally(() => prisma.$disconnect());
