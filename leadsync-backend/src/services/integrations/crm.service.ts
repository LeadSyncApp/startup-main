import { prisma } from "../../lib/prisma";
import { emitToCompany } from "../../lib/socket";
import { AiPriority, Prisma } from "@prisma/client";

const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Centrally recalculate Lead CRM stats: orderCount, totalSpend, and segment.
 * Uses SERIALIZABLE + SELECT FOR UPDATE to prevent lost updates from concurrent
 * order completions. Retries automatically on serialization failure (pg error 40001).
 */
export async function recalculateLeadCRM(leadId: string, companyId: string): Promise<any> {
  if (!leadId) return null;

  for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      const updatedLead = await prisma.$transaction(async (tx) => {
        // Lock the lead row so concurrent recalculateLeadCRM calls serialize here
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT id FROM "Lead" WHERE id = ${leadId} AND "deletedAt" IS NULL FOR UPDATE
        `;
        if (lockedRows.length === 0) return null;

        const orders = await tx.order.findMany({
          where: {
            leadId,
            companyId,
            isDeleted: false,
            status: {
              notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"]
            }
          },
          select: { amount: true }
        });

        const orderCount = orders.length;
        const totalSpend = orders.reduce((sum: any, o: any) => sum + o.amount, 0);

        const currentLead = await tx.lead.findFirst({
          where: { id: leadId, deletedAt: null },
          include: {
            conversations: {
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          }
        });

        if (!currentLead) return null;

        let segment = currentLead.segment || "NEW";
        if (segment !== "VIP") {
          segment = orderCount > 1 ? "REGULAR" : "NEW";
        }

        const daysSinceActive = currentLead.lastActiveAt
          ? Math.floor((Date.now() - new Date(currentLead.lastActiveAt).getTime()) / 86400000)
          : 0;

        const recencyScore = Math.max(0, 30 - daysSinceActive) / 30 * 30;
        const spendScore = Math.min(totalSpend / 500, 30);
        const orderScore = Math.min(orderCount * 5, 20);
        const sentimentScore = 0;
        const aiScore = Math.round(recencyScore + spendScore + orderScore + sentimentScore);

        let aiPriority: "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (aiScore >= 75 || totalSpend > 5000 || segment === "VIP") aiPriority = "HIGH";
        else if (aiScore >= 40 || orderCount > 0) aiPriority = "MEDIUM";

        return tx.lead.update({
          where: { id: leadId },
          data: {
            orderCount,
            totalSpend,
            segment,
            aiPriority: aiPriority as AiPriority,
            lastActiveAt: new Date()
          }
        });
      }, {
        isolationLevel: "Serializable",
        timeout: 10000,
      });

      if (!updatedLead) return null;

      console.log(`📊 [CRM] Recalculated Lead ${leadId} stats: orderCount=${updatedLead.orderCount}, totalSpend=${updatedLead.totalSpend}, segment=${updatedLead.segment}, aiPriority=${updatedLead.aiPriority}`);

      emitToCompany(companyId, "lead_updated", {
        leadId,
        companyId,
        totalSpend: updatedLead.totalSpend,
        orderCount: updatedLead.orderCount,
        segment: updatedLead.segment,
        aiPriority: updatedLead.aiPriority,
        isExistingCustomer: updatedLead.orderCount > 0,
        previousOrderCount: updatedLead.orderCount,
        previousSpend: updatedLead.totalSpend
      });

      return updatedLead;
    } catch (error: any) {
      const isSerializationFailure = error?.code === "40001" ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010");

      if (isSerializationFailure && attempt < MAX_SERIALIZATION_RETRIES) {
        console.warn(`⚠️ [CRM] Serialization conflict on lead ${leadId} (attempt ${attempt}/${MAX_SERIALIZATION_RETRIES}). Retrying...`);
        continue;
      }

      console.error(`❌ [CRM] Error recalculating lead ${leadId} stats:`, error);
      return null;
    }
  }
}
