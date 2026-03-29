import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/leads
 * Support filtering: ?filter=me | ?filter=unassigned
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const companyId = req.user.companyId;

    // 🔍 Filter Logic for Shared Inbox
    const filter = req.query.filter as string; // 'me', 'unassigned'
    const whereCondition: any = { companyId };

    // We filter Leads based on their conversations
    if (filter === 'me') {
      // Only leads where I am assigned to at least one conversation
      whereCondition.conversations = { some: { assignedToId: req.user.userId } };
    } else if (filter === 'unassigned') {
      // Only leads with unassigned open conversations
      whereCondition.conversations = { some: { assignedToId: null, status: { not: 'RESOLVED' } } };
    }

    // Forceful cast to bypass stale types (IDE context lag)
    const leads = await (prisma.lead as any).findMany({
      where: whereCondition,
      include: {
        conversations: {
          select: {
            id: true,
            sentimentScore: true,
            intent: true,
            updatedAt: true,
            status: true,      // New field
            assignedToId: true,// New field
            assignedTo: {      // New relation
              select: { id: true, name: true }
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        },
      },
      orderBy: { lastActiveAt: "desc" },
      take: 50,
    });

    const formatted = leads.map((lead: any) => {
      const conversation = lead.conversations[0];

      // Calculate dynamic priority
      let priority = "NORMAL";
      if (lead.totalSpend > 5000 || lead.segment === "VIP") priority = "HIGH";
      if (conversation?.sentimentScore && conversation.sentimentScore < -3) priority = "URGENT";
      if (conversation?.intent === "ORDERING" || conversation?.intent === "COMPLAINT") priority = "HIGH";

      // AI score (0–100) — composite of recency, spend, sentiment, order frequency
      const daysSinceActive = lead.lastActiveAt
        ? Math.floor((Date.now() - new Date(lead.lastActiveAt).getTime()) / 86400000)
        : 999;
      const recencyScore = Math.max(0, 30 - daysSinceActive) / 30 * 30; // max 30pts
      const spendScore = Math.min(lead.totalSpend / 500, 30); // max 30pts at ₹15k
      const orderScore = Math.min(lead.orderCount * 5, 20); // max 20pts
      const sentimentRaw = conversation?.sentimentScore ?? 0;
      const sentimentScore = Math.max(0, (sentimentRaw + 5) / 10) * 20; // -5..+5 → 0..20pts
      const aiScore = Math.round(recencyScore + spendScore + orderScore + sentimentScore);

      // Suggested action — ordered from highest to lowest priority
      let suggestedAction = "Monitor";
      if (lead.pendingOrderState === "PENDING_APPROVAL") suggestedAction = "Claim order";
      else if (lead.pendingOrderState === "CLAIMED_FOR_APPROVAL") suggestedAction = "Process order";
      else if (conversation?.intent === "ORDERING") suggestedAction = "Close order";
      else if (lead.segment === "CHURN_RISK") suggestedAction = "Win back";
      else if (lead.segment === "VIP") suggestedAction = "Retain & reward";
      else if (daysSinceActive > 14) suggestedAction = "Re-engage";
      else if (lead.segment === "REGULAR" && lead.totalSpend > 3000) suggestedAction = "Upsell to VIP";
      else if (lead.segment === "NEW") suggestedAction = "Qualify lead";
      else if (conversation?.intent === "COMPLAINT") suggestedAction = "Resolve issue";

      return {
        id: lead.id,
        name: lead.name || "Customer",
        contact: lead.contact,
        channel: lead.channel,
        createdAt: lead.createdAt,
        lastActiveAt: lead.lastActiveAt,

        // CRM Data
        totalSpend: lead.totalSpend,
        orderCount: lead.orderCount,
        segment: lead.segment,

        conversationId: conversation?.id || null,
        lastMessage: conversation?.messages[0]?.content || "",
        sentimentScore: conversation?.sentimentScore || 0,
        intent: conversation?.intent || "BROWSING",

        // Multi-Agent Data
        status: conversation?.status || "OPEN",
        assignedTo: conversation?.assignedTo || null,

        priority,
        agentAssigned: conversation?.assignedTo?.name || null,

        // 🆕 New Order Arrivals Data
        hasPendingOrderApproval: lead.pendingOrderState !== "NONE",
        pendingOrderState: lead.pendingOrderState,
        pendingOrderId: lead.pendingOrderId,
        pendingOrderClaimedById: lead.pendingOrderClaimedById,
        pendingOrderClaimedAt: lead.pendingOrderClaimedAt,
        pendingOrderSummary: lead.pendingOrderSummary,
        pendingOrderAmount: lead.pendingOrderAmount,

        // 🆕 Agent assignment info for new order arrivals
        canCurrentUserClaim: lead.pendingOrderState === "PENDING_APPROVAL" && !lead.pendingOrderClaimedById,
        isPendingOrderOwnedByCurrentAgent: lead.pendingOrderClaimedById === req.user?.userId,

        // 🆕 Customer history context
        isExistingCustomer: lead.orderCount > 0,
        previousOrderCount: lead.orderCount,
        previousSpend: lead.totalSpend,

        // AI Intelligence
        aiScore,
        suggestedAction,
        daysSinceActive,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Fetch leads error:", error);
    res.status(500).json({ message: "Failed to fetch leads" });
  }
});

/* =========================================
   PATCH /api/leads/:id
   Update segment, name, or other CRM fields
========================================= */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    const { segment, name, priority } = req.body;

    const lead = await (prisma.lead as any).findFirst({ where: { id, companyId } });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const updateData: any = {};
    if (segment !== undefined) updateData.segment = segment;
    if (name !== undefined) updateData.name = name;

    const updated = await (prisma.lead as any).update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error("Patch lead error:", error);
    res.status(500).json({ message: "Failed to update lead" });
  }
});

/* =========================================
   POST /api/leads/:id/claim-pending-order
   Claim pending order approval from Leads page
========================================= */
router.post("/:id/claim-pending-order", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    // Only agents can claim pending orders
    if (!["AGENT", "ADMIN", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can claim pending orders" });
    }

    const lead = await (prisma.lead as any).findFirst({
      where: { 
        id, 
        companyId,
        pendingOrderState: "PENDING_APPROVAL" // Must have pending approval
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found or no pending order" });
    }

    // Check if already claimed
    if (lead.pendingOrderClaimedById) {
      // Only allow if current user is admin/owner or the same agent
      if (lead.pendingOrderClaimedById !== userId && !["ADMIN", "OWNER"].includes(role)) {
        return res.status(409).json({ message: "Pending order already claimed by another agent" });
      }
      // If same agent, return success (idempotent)
      if (lead.pendingOrderClaimedById === userId) {
        return res.json(lead);
      }
    }

    // 🆕 Get customer history and previous agent information
    const [previousOrders, previousAgent] = await Promise.all([
      (prisma.order as any).findMany({
        where: { 
          leadId: lead.id, 
          companyId,
          isDeleted: false,
          status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
        },
        include: {
          processedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      // Find the last agent who processed an order for this customer
      (prisma.order as any).findFirst({
        where: { 
          leadId: lead.id, 
          companyId,
          isDeleted: false,
          processedById: { not: null }
        },
        include: {
          processedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    // Update lead with claim information
    const updatedLead = await (prisma.lead as any).update({
      where: { id },
      data: {
        pendingOrderState: "CLAIMED_FOR_APPROVAL",
        pendingOrderClaimedById: userId,
        pendingOrderClaimedAt: new Date()
      },
      include: {
        conversations: {
          select: {
            id: true,
            assignedToId: true,
            assignedTo: {
              select: { id: true, name: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    // Also assign the conversation to this agent if not already assigned
    const conversation = updatedLead.conversations[0];
    if (conversation && !conversation.assignedToId) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedToId: userId }
      });
    }

    // Create notification for the claiming agent
    const { notificationService } = await import("../../services/notification.service");
    await notificationService.notifyUser(
      userId,
      "Pending Order Claimed",
      `You have claimed the pending order for ${lead.name || lead.contact}`,
      "ORDER"
    );

    // Emit socket events
    const { safeEmitConversationUpdate, emitToAgent, emitToCompany } = await import("../../lib/socket");
    if (conversation) {
      safeEmitConversationUpdate(conversation, "conversation_assigned", {
        conversationId: conversation.id,
        assignedTo: { id: userId, name: "Agent" }
      });
    }
    emitToAgent(userId, "pending_order_claimed", updatedLead);
    
    // 🆕 Emit lead update for all agents with customer history
    emitToCompany(companyId, "lead_updated", {
      leadId: updatedLead.id,
      companyId,
      hasPendingOrderApproval: true,
      pendingOrderState: "CLAIMED_FOR_APPROVAL",
      pendingOrderClaimedById: userId,
      pendingOrderClaimedAt: new Date(),
      agentAssigned: "Agent",
      // 🆕 Include customer history context
      isExistingCustomer: lead.orderCount > 0,
      previousOrderCount: lead.orderCount,
      previousSpend: lead.totalSpend,
      previousAgentName: previousAgent?.processedBy?.name,
      previousAgentId: previousAgent?.processedBy?.id,
      recentOrders: previousOrders.slice(0, 3).map((o: any) => ({
        id: o.id,
        amount: o.amount,
        createdAt: o.createdAt,
        processedBy: o.processedBy?.name
      }))
    });

    res.json(updatedLead);
  } catch (error: any) {
    console.error("Claim pending order error:", error);
    res.status(500).json({ message: "Failed to claim pending order" });
  }
});

export default router;
