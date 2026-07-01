import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { triageConversation } from "../ai/ai.service";
import { emitToCompanyAdmin, emitToCompany } from "../../lib/socket";

export async function processAiTriageJob(job: { id: string, data: { conversationId: string, companyId: string } }) {
  const { conversationId, companyId } = job.data;
  console.log(`[AiTriageWorker] Triaging conversation ${conversationId}`);

  try {
     const tenantPrisma = getTenantPrismaContext(companyId);
     const conversation = await tenantPrisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
           messages: {
              orderBy: { createdAt: "asc" },
              take: 5
           }
        }
     });

     if (!conversation) return;

      const chatHistory = conversation.messages.map(m => m.content).join("\n");
     const { intent, summary } = await triageConversation(chatHistory);

     const updated = await (tenantPrisma.conversation as any).update({
        where: { id: conversationId },
        data: {
           sessionState: {
              ...((conversation as any).sessionState || {}),
              aiIntent: intent,
              aiSummary: summary,
           }
        }
     });

     // Emit to reflect UI badge
     emitToCompany(companyId, "conversation_updated", updated);

  } catch (error) {
     console.error("❌ Failed to triage conversation", error);
  }
}

export function startAiTriageWorker() {
    const boss = pgBossService.getBoss();
    boss.work("ai-triage-job", {
      teamSize: 5,
      teamConcurrency: 2
    }, async (job: any) => {
       await processAiTriageJob(job);
    });
}