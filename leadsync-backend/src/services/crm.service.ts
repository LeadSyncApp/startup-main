import { prisma } from "../lib/prisma";
import { emitToCompany } from "../lib/socket";

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
    const totalSpend = orders.reduce((sum, o) => sum + o.amount, 0);

    // Retrieve existing lead for potential VIP override or preservation
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { segment: true }
    });

    let segment = lead?.segment || "NEW";
    if (segment !== "VIP") {
      segment = orderCount > 1 ? "REGULAR" : "NEW";
    }

    // Atomically update findings to lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        orderCount,
        totalSpend,
        segment,
        lastActiveAt: new Date()
      }
    });

    console.log(`📊 [CRM] Recalculated Lead ${leadId} stats: orderCount=${orderCount}, totalSpend=${totalSpend}, segment=${segment}`);

    // Broadcast update to frontend via socket so tables/CRM refresh in real-time!
    emitToCompany(companyId, "lead_updated", {
      leadId,
      companyId,
      totalSpend: updatedLead.totalSpend,
      orderCount: updatedLead.orderCount,
      segment: updatedLead.segment,
      isExistingCustomer: updatedLead.orderCount > 0,
      previousOrderCount: updatedLead.orderCount,
      previousSpend: updatedLead.totalSpend
    });

    return updatedLead;
  } catch (error) {
    console.error(`❌ [CRM] Error recalculating lead ${leadId} stats:`, error);
  }
}
