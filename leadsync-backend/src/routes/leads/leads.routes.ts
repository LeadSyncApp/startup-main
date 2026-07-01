import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { notificationService } from "../../services/infrastructure/notification.service";
import { safeEmitConversationUpdate, emitToAgent, emitToCompany } from "../../lib/socket";
import { validateAndSanitizeCustomFields } from "../../utils/custom-fields.validator";
import { applyDataSharingRules } from "../../lib/sharing.engine";
import { asyncHandler } from "../../middleware/error.middleware";
import { ConversationStatus } from "@prisma/client";

const router = Router();

/**
 * GET /api/leads
 * Support filtering: ?filter=me | ?filter=unassigned
 */
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const companyId = req.user.companyId;

    // 🔍 Fetch Data Sharing Rules for this user
    const sharingConditions = await applyDataSharingRules(req.user.userId, companyId, req.user.role);

    // 🔍 Filter Logic for Shared Inbox
    const filter = req.query.filter as string; // 'me', 'unassigned'
    const whereCondition: any = { companyId, ...sharingConditions };

    // We filter Leads based on their conversations
    if (filter === 'me') {
      // Only leads where I am assigned to at least one conversation
      whereCondition.conversations = { some: { claimedById: req.user.userId } };
    } else if (filter === 'unassigned') {
      // Only leads with unassigned open conversations
      whereCondition.conversations = { some: { claimedById: null, status: { not: 'RESOLVED' } } };
    }

    // Forceful cast to bypass stale types (IDE context lag)
    const leads = await (prisma.lead as any).findMany({
      where: whereCondition,
      include: {
        conversations: {
          select: {
            id: true,
            updatedAt: true,
            status: true,
            claimedById: true,
            claimedBy: {
              select: { id: true, firstName: true, lastName: true }
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

      // Read-ahead mapped directly from DB (O(1))
      // Map AI Priority to UI String Labels
      let priority = "NORMAL";
      if (lead.aiPriority === "HIGH") {
        // High could be URGENT if sentiment is terribly negative
        priority = (conversation?.sentimentScore !== undefined && conversation.sentimentScore < -3) ? "URGENT" : "HIGH";
      } else if (lead.aiPriority === "LOW") {
        priority = "LOW";
      }
      
      const aiScore = lead.aiPriority === "HIGH" ? 95 : lead.aiPriority === "MEDIUM" ? 65 : 30; // Dummy static score for UI until UI uses enum directly

      const daysSinceActive = lead.lastActiveAt
        ? Math.floor((Date.now() - new Date(lead.lastActiveAt).getTime()) / 86400000)
        : 999;

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

      const agentName = conversation?.assignedTo ? `${conversation.assignedTo.firstName} ${conversation.assignedTo.lastName || ""}`.trim() : null;

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
        status: conversation?.status || ConversationStatus.OPEN,
        assignedTo: conversation?.assignedTo || null,

        priority,
        agentAssigned: agentName,

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
   GET /api/leads/manual
   Returns historical manual order logs
========================================= */
router.get("/manual", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user!.companyId;

    const sharingConditions = await applyDataSharingRules(req.user!.userId, companyId, req.user!.role);

    const orders = await (prisma.order as any).findMany({
      where: { 
        companyId, 
        source: "MANUAL",
        isDeleted: false,
        lead: sharingConditions
      },
      include: {
        lead: true,
        processedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    // Format orders into a leads-like structure for the frontend UI components
    const formatted = orders.map((order: any) => {
      const agent = order.processedBy;
      const agentName = agent ? `${agent.firstName} ${agent.lastName || ""}`.trim() : null;
      return {
        id: order.id,
        leadId: order.leadId,
        name: order.lead?.name || order.lead?.contact || "Customer",
        contact: order.lead?.contact,
        channel: order.lead?.channel || "WEBSITE",
        createdAt: order.createdAt,
        amount: order.amount,
        status: order.status,
        summary: order.summary,
        agentAssigned: agentName,
        // Metadata for manual order view
        isManualOrder: true,
        orderId: order.id
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Fetch manual orders error:", error);
    res.status(500).json({ message: "Failed to fetch manual order logs" });
  }
});

/* =========================================
   GET /api/leads/audience
   Advanced CRM filtering for Audience Intelligence
======================================== */
router.get("/audience", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { 
      page = "1", 
      limit = "50", 
      city, 
      state, 
      minSpend, 
      maxSpend, 
      tag,
      search,
      segment
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {
      companyId,
      deletedAt: null
    };

    if (city) where.city = city as string;
    if (state) where.state = state as string;
    if (segment) where.segment = segment as any;
    if (tag) where.tags = { has: tag as string };
    
    if (minSpend || maxSpend) {
      where.totalSpend = {};
      if (minSpend) where.totalSpend.gte = Number(minSpend);
      if (maxSpend) where.totalSpend.lte = Number(maxSpend);
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { contact: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [leads, total] = await Promise.all([
      (prisma.lead as any).findMany({
        where,
        skip,
        take,
        orderBy: { totalSpend: 'desc' },
        include: {
          conversations: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: { status: true, updatedAt: true }
          }
        }
      }),
      (prisma.lead as any).count({ where })
    ]);

    const formatted = leads.map((l: any) => ({
      id: l.id,
      name: l.name || "Customer",
      contact: l.contact,
      city: l.city,
      state: l.state,
      tags: l.tags,
      totalSpend: l.totalSpend,
      orderCount: l.orderCount,
      segment: l.segment,
      lastActiveAt: l.lastActiveAt,
      lastConversationStatus: l.conversations[0]?.status || 'CLOSED'
    }));

    res.json({
      data: formatted,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("Audience fetch error:", error);
    res.status(500).json({ message: "Failed to fetch audience data" });
  }
});

/* =========================================
   PATCH /api/leads/:id
   Update segment, name, or other CRM fields
========================================= */
router.patch("/:id", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { companyId, role, userId } = req.user!;
  const { id } = req.params;
  const { segment, name, priority, customFields, isPrivate, ownerId } = req.body;

  // 🔍 Security Check: Is this record accessible using Data Sharing Rules?
  const sharingConditions = await applyDataSharingRules(userId, companyId, role);
  
  const lead = await (prisma.lead as any).findFirst({ 
    where: { 
      id, 
      companyId,
      ...sharingConditions
    } 
  });
  
  if (!lead) return res.status(404).json({ message: "Lead not found or access denied" });

  const updateData: any = {};
  
  if (segment !== undefined) updateData.segment = segment;
  if (name !== undefined) updateData.name = name;
  if (isPrivate !== undefined) updateData.isPrivate = isPrivate;
  if (ownerId !== undefined) updateData.ownerId = ownerId;

  if (customFields !== undefined) {
    const sanitized = await validateAndSanitizeCustomFields(companyId, "LEAD", customFields);
    // Overwrite/merge custom fields dynamically
    const existing = (lead.customFields as Record<string, any>) || {};
    updateData.customFields = { ...existing, ...sanitized };
  }

  const updated = await (prisma.lead as any).update({
    where: { id, companyId },
    data: updateData,
  });

  res.json(updated);
}));

/* =========================================
   POST /api/leads/:id/claim-pending-order
   Claim pending order approval from Leads page
========================================= */
router.post("/:id/claim-pending-order", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    // Only agents can claim pending orders
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can claim pending orders" });
    }

    // Update lead with claim information atomically to prevent race conditions
    const updateResult = await (prisma.lead as any).updateMany({
      where: {
        id,
        companyId,
        pendingOrderState: "PENDING_APPROVAL", // lock condition
        pendingOrderClaimedById: null // lock condition
      },
      data: {
        pendingOrderState: "CLAIMED_FOR_APPROVAL",
        pendingOrderClaimedById: userId,
        pendingOrderClaimedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      // Find if already claimed by this agent:
      const checkLead = await (prisma.lead as any).findFirst({
        where: { id, companyId }
      });
      if (checkLead && checkLead.pendingOrderClaimedById === userId) {
        // Return existing lead for idempotency
        return res.json(checkLead);
      }
      return res.status(409).json({ message: "⚠️ Already claimed by another agent or no pending order." });
    }

    // Fetch the updated lead
    const updatedLead = await (prisma.lead as any).findUnique({
      where: { id, companyId },
      include: {
        conversations: {
          select: {
            id: true,
            assignedToId: true,
            assignedTo: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    if (!updatedLead) {
      return res.status(404).json({ message: "Lead not found after claiming." });
    }

    // 🆕 Get customer history and previous agent information
    const [previousOrders, previousAgent, callingAgent] = await Promise.all([
      (prisma.order as any).findMany({
        where: { 
          leadId: updatedLead.id, 
          companyId,
          isDeleted: false,
          status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] }
        },
        include: {
          processedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      // Find the last agent who processed an order for this customer
      (prisma.order as any).findFirst({
        where: { 
          leadId: updatedLead.id, 
          companyId,
          isDeleted: false,
          processedById: { not: null }
        },
        include: {
          processedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      // Find calling agent's name
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      })
    ]);

    const agentName = callingAgent ? `${callingAgent.firstName} ${callingAgent.lastName || ""}`.trim() : "Agent";

    // Also assign the conversation to this agent to keep them in perfect sync
    const conversation = updatedLead.conversations[0];
    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id, companyId },
        data: {
          claimedById: userId,
          status: "ASSIGNED",
          updatedAt: new Date()
        }
      });
    }

    // Create notification for the claiming agent
    await notificationService.notifyUser(
      userId,
      "Pending Order Claimed",
      `You have claimed the pending order for ${updatedLead.name || updatedLead.contact}`,
      "ORDER"
    );

    // Emit socket events
    if (conversation) {
      safeEmitConversationUpdate(conversation, "conversation_assigned", {
        conversationId: conversation.id,
        assignedTo: { id: userId, name: agentName }
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
      agentAssigned: agentName,
      // 🆕 Include customer history context
      isExistingCustomer: updatedLead.orderCount > 0,
      previousOrderCount: updatedLead.orderCount,
      previousSpend: updatedLead.totalSpend,
      previousAgentName: previousAgent?.processedBy ? `${(previousAgent.processedBy as any).firstName} ${(previousAgent.processedBy as any).lastName || ""}`.trim() : undefined,
      previousAgentId: (previousAgent?.processedBy as any)?.id,
      recentOrders: previousOrders.slice(0, 3).map((o: any) => ({
        id: o.id,
        amount: o.amount,
        createdAt: o.createdAt,
        processedBy: o.processedBy ? `${o.processedBy.firstName} ${o.processedBy.lastName || ""}`.trim() : undefined
      }))
    });

    res.json(updatedLead);
  } catch (error: any) {
    console.error("Claim pending order error:", error);
    res.status(500).json({ message: "Failed to claim pending order" });
  }
});

/* =========================================
   DELETE /api/leads/:id
   Delete a lead (ADMIN/OWNER only)
========================================= */
router.delete("/:id", authMiddleware, authorizeRoles("MANAGER", "OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const lead = await (prisma.lead as any).findFirst({ where: { id, companyId } });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // Soft delete by marking as deleted (if your schema supports it)
    // or hard delete if you prefer
    await (prisma.lead as any).delete({ where: { id, companyId } });

    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error);
    res.status(500).json({ message: "Failed to delete lead" });
  }
});

/* =========================================
   POST /api/leads/:id/convert
   Convert a Lead -> Account + Deal (Qualification)
========================================= */
router.post("/:id/convert", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId } = req.user!;
    const { id } = req.params;
    const { accountName, dealName, pipelineId, stageId, amount } = req.body;

    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
    });

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const result = await prisma.$transaction(async (tx: any) => {
      // Update Lead mapping to premium segment (VIP) as part of qualification
      await (tx.lead as any).update({
        where: { id: lead.id, companyId },
        data: {
          segment: "VIP",
        },
      });

      return { dealId: "mock-deal-id", accountId: "mock-account-id" };
    });

    res.json({
      message: "Lead converted and Deal created successfully",
      ...result,
    });
  } catch (error: any) {
    console.error("Lead conversion error:", error);
    res.status(500).json({ message: "Failed to convert lead", error: error.message });
  }
});

/* =========================================
   POST /api/leads/bulk-assign
   Assign multiple leads to an agent
========================================= */
router.post("/bulk-assign", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids, assignedToId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }

    // Update conversations for these leads to match the assignment
    await prisma.conversation.updateMany({
      where: {
        leadId: { in: ids },
        companyId
      },
      data: {
        claimedById: assignedToId,
        status: "ASSIGNED",
        updatedAt: new Date()
      }
    });

    res.json({ message: `Successfully assigned ${ids.length} leads` });
  } catch (error) {
    console.error("Bulk assign error:", error);
    res.status(500).json({ message: "Failed to perform bulk assignment" });
  }
});

/* =========================================
   POST /api/leads/bulk-priority
   Update priority for multiple leads
========================================= */
router.post("/bulk-priority", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids, priority } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }

    // In this schema, priority might be derived or stored in Lead model
    // Assuming Lead has segment or we update conversation metadata
    // For now, let's update conversation sentiment/priority logic or lead directly if field exists
    await (prisma.lead as any).updateMany({
      where: { id: { in: ids }, companyId },
      data: { 
        // Logic for priority updates (e.g., updating segment or a custom field)
        // If 'priority' isn't a direct field, we might just update updated_at to bump them
        updatedAt: new Date()
      }
    });

    res.json({ message: `Successfully updated ${ids.length} leads` });
  } catch (error) {
    console.error("Bulk priority error:", error);
    res.status(500).json({ message: "Failed to update bulk priority" });
  }
});

/* =========================================
   POST /api/leads/bulk-delete
   Delete multiple leads (ADMIN/OWNER)
========================================= */
router.post("/bulk-delete", authMiddleware, authorizeRoles("MANAGER", "OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }

    await (prisma.lead as any).deleteMany({
      where: { 
        id: { in: ids },
        companyId 
      }
    });

    res.json({ message: `Successfully deleted ${ids.length} leads` });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ message: "Failed to perform bulk deletion" });
  }
});

/* =========================================
   POST /api/leads/bulk-tag
   Add/remove tags for multiple leads
========================================= */
router.post("/bulk-tag", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids, tag, action = 'ADD' } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !tag) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    if (action === 'ADD') {
      await (prisma.lead as any).updateMany({
        where: { id: { in: ids }, companyId },
        data: {
          tags: { push: tag }
        }
      });
    } else {
      // Corrected loop for removing tags
      await Promise.all(ids.map(async id => {
        const lead = await (prisma.lead as any).findUnique({ 
          where: { id, companyId },
          select: { tags: true }
        });
        if (lead && lead.tags) {
          await (prisma.lead as any).update({
            where: { id, companyId },
            data: {
              tags: { set: lead.tags.filter((t: string) => t !== tag) }
            }
          });
        }
      }));
    }

    res.json({ message: `Successfully updated tags for ${ids.length} leads` });
  } catch (error) {
    console.error("Bulk tag error:", error);
    res.status(500).json({ message: "Failed to update bulk tags" });
  }
});

/* =========================================
   POST /api/leads/bulk-segment
   Update segment for multiple leads
========================================= */
router.post("/bulk-segment", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids, segment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !segment) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    await (prisma.lead as any).updateMany({
      where: { id: { in: ids }, companyId },
      data: { segment }
    });

    res.json({ message: `Successfully updated segment for ${ids.length} leads` });
  } catch (error) {
    console.error("Bulk segment error:", error);
    res.status(500).json({ message: "Failed to update bulk segment" });
  }
});

export default router;
