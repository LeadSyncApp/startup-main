import { prisma } from "../../lib/prisma";
import { emitToCompany } from "../../lib/socket";
import { AiPriority } from "@prisma/client";

/**
 * Centrally recalculate Lead CRM stats: orderCount, totalSpend, and segment.
 * Includes automatic websocket broadcast to shareholders in the company so frontend updates in real-time.
 */
export async function recalculateLeadCRM(leadId: string, companyId: string): Promise<any> {
  try {
    // Query all active (non-deleted, non-draft, non-cancelled, non-rejected) orders for this lead
    const orders = await prisma.order.findMany({
      where: {
        leadId,
        companyId,
        isDeleted: false,
        status: {
          notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"]
        }
      },
      select: {
        amount: true
      }
    });

    const orderCount = orders.length;
    const totalSpend = orders.reduce((sum: any, o: any) => sum + o.amount, 0);

    // Retrieve existing lead and its latest conversation for priority calculation
    const currentLead = await prisma.lead.findFirst({
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

    // ==========================================
    // AI PRIORITY SCORING CALCULATION
    // ==========================================
    const conversation = currentLead.conversations[0];
    const daysSinceActive = currentLead.lastActiveAt
      ? Math.floor((Date.now() - new Date(currentLead.lastActiveAt).getTime()) / 86400000)
      : 0;

    const recencyScore = Math.max(0, 30 - daysSinceActive) / 30 * 30; // max 30pts
    const spendScore = Math.min(totalSpend / 500, 30); // max 30pts
    const orderScore = Math.min(orderCount * 5, 20); // max 20pts
    const sentimentRaw = 0;
    const sentimentScore = 0;
    const aiScore = Math.round(recencyScore + spendScore + orderScore + sentimentScore);

    // Calculate dynamic priority
    let aiPriority: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (aiScore >= 75 || totalSpend > 5000 || segment === "VIP") aiPriority = "HIGH";
    else if (aiScore >= 40 || orderCount > 0) aiPriority = "MEDIUM";
    
    // Sentiment and intent fields removed from Conversation schema

    // Atomically update findings to lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        orderCount,
        totalSpend,
        segment,
        aiPriority: aiPriority as AiPriority,
        lastActiveAt: new Date()
      }
    });

    console.log(`📊 [CRM] Recalculated Lead ${leadId} stats: orderCount=${orderCount}, totalSpend=${totalSpend}, segment=${segment}, aiPriority=${aiPriority}`);

    // Broadcast update to frontend via socket so tables/CRM refresh in real-time!
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
  } catch (error) {
    console.error(`❌ [CRM] Error recalculating lead ${leadId} stats:`, error);
  }
}
