import { pgBossService } from "../infrastructure/pgboss/pgboss.service";
import { prisma, getTenantPrismaContext } from "../../lib/prisma";
import { triageConversation } from "../ai/ai.service";
import { matchProductForMessage } from "../knowledge/productMatch.service";
import { emitToCompany } from "../../lib/socket";
import { stepProfiler } from "../../utils/stepProfiler";

export async function processAiTriageJob(jobInput: any) {
  const job = Array.isArray(jobInput) ? jobInput[0] : jobInput;
  const { conversationId, companyId, traceId, precomputedProductMatch, hasPrecomputedProductMatch } = job?.data || {};
  const effectiveTraceId = traceId || `triage-${conversationId}-${Date.now()}`;

  return await stepProfiler.runWithContext({ traceId: effectiveTraceId }, async () => {
    stepProfiler.setTraceId(effectiveTraceId);
    console.log(`[AiTriageWorker] Triaging conversation ${conversationId} (traceId: ${effectiveTraceId}, hasPrecomputedProductMatch: ${hasPrecomputedProductMatch}, matchName: ${precomputedProductMatch?.name || "null"})`);

  try {
     const tenantPrisma = getTenantPrismaContext(companyId);
     const conversation = await tenantPrisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
           messages: {
              orderBy: { createdAt: "desc" },
              take: 10
           }
        }
     });

     if (!conversation) return;

     const chronologicalMessages = [...conversation.messages].reverse();
     const chatHistory = chronologicalMessages.map(m => m.content).join("\n");
     const { intent: rawIntent, summary } = await triageConversation(chatHistory);

     // Strictly validate and map rawIntent to ConversationIntent Prisma enum
     const validIntents = ["BROWSING", "ORDERING", "SUPPORT", "COMPLAINT"];
     let mappedIntent = (rawIntent || "").toUpperCase().trim();
     if (mappedIntent === "SALES" || mappedIntent === "PURCHASE" || mappedIntent === "ORDER") mappedIntent = "ORDERING";
     if (!validIntents.includes(mappedIntent)) mappedIntent = "BROWSING";

     // Compute a product match for the customer's most recent message once,
     // or reuse the precomputed result passed from the orchestrator via job data
     // to eliminate duplicate RAG execution (FTS query, pgvector query, ONNX reranker).
     const lastCustomerMessage = chronologicalMessages
       .reverse()
       .find((m: any) => m.sender !== "SYSTEM" && m.sender !== "BOT");

     let matchedProduct: any = null;
     if (hasPrecomputedProductMatch) {
       // Reuse precomputed match result from orchestrator when available for equivalent product queries
       matchedProduct = precomputedProductMatch;
       console.log(`[AiTriageWorker] Reusing precomputed product match from orchestrator (skip duplicate RAG):`, matchedProduct ? (matchedProduct.name || matchedProduct.id || "matched") : "null");
     } else if (lastCustomerMessage) {
       // Fallback: run product match if no equivalent precomputed result was provided (e.g. Support/Policy intent or direct job enqueue)
       matchedProduct = await matchProductForMessage(companyId, lastCustomerMessage.content);
     }

     const updated = await (tenantPrisma.conversation as any).update({
        where: { id: conversationId },
        data: {
           intent: mappedIntent as any,
           sessionState: {
              ...((conversation as any).sessionState || {}),
              aiIntent: mappedIntent,
              aiSummary: summary,
              lastTriagedAt: new Date().toISOString(),
           },
           matchedProduct: matchedProduct as any,
           matchedProductAt: matchedProduct ? new Date() : null,
        }
     });

     // Emit to reflect UI badge
     emitToCompany(companyId, "conversation_updated", updated);

  } catch (error) {
     console.error("❌ Failed to triage conversation", error);
  }
  });
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