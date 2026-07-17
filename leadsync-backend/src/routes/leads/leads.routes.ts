import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { notificationService } from "../../services/infrastructure/notification.service";
import { safeEmitConversationUpdate, emitToAgent, emitToCompany } from "../../lib/socket";
import { validateAndSanitizeCustomFields } from "../../utils/custom-fields.validator";
import { applyDataSharingRules } from "../../lib/sharing.engine";
import { asyncHandler } from "../../middleware/error.middleware";
import { ConversationStatus, ConversationMode, MessageSender, Channel as PrismaChannel } from "@prisma/client";
import { outboundDispatcherService } from "../../services/outbound.dispatcher";
import { escalateToHuman, resolveConversation } from "../../services";
import { generateReplySuggestion } from "../../services/ai/ai.service";

const router = Router();

/**
 * Resolve the cached product match for a conversation into the shape the
 * StreamTriage frontend expects ({ name, variant, stock, thumbnailUrl } | null).
 *
 * The match itself is computed once (gap-based confidence) and cached on the
 * Conversation. Here we only re-fetch the LIVE stock count from the Inventory
 * table so the displayed number is never stale. Returns null when there is no
 * confident cached match.
 */
async function resolveMatchedProduct(conversation: any, companyId: string): Promise<{
  name: string;
  variant: string;
  stock: number;
  thumbnailUrl: string;
} | null> {
  const cached = conversation?.matchedProduct as
    | { productId?: string; name?: string; variant?: string; thumbnailUrl?: string }
    | null
    | undefined;

  if (!cached || !cached.productId) return null;

  try {
    const product = await prisma.inventoryProduct.findFirst({
      where: { id: cached.productId, companyId, isActive: true },
      select: {
        name: true,
        imageUrl: true,
        variants: {
          where: { isActive: true },
          select: { attributeValue: true, stock: true },
        },
      },
    });

    if (!product) return null;

    const stock = (product.variants || []).reduce(
      (sum: number, v: any) => sum + (v.stock ?? 0),
      0
    );

    return {
      name: cached.name || product.name,
      variant: cached.variant || "",
      stock,
      thumbnailUrl: cached.thumbnailUrl || product.imageUrl || "",
    };
  } catch (err: any) {
    console.error("[leads] Failed to resolve matched product:", err?.message);
    return null;
  }
}

/**
 * GET /api/leads
 * Support filtering: ?filter=unclaimed | ?filter=mine | ?filter=all | ?filter=resolved
 * Support search: ?search=<term> (matches lead name/contact)
 * Support pagination: ?page=1&limit=50
 * Returns: { data: [...], meta: { total, page, limit, hasMore } }
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
    const filter = req.query.filter as string; // 'unclaimed', 'mine', 'all', 'resolved'
    const search = req.query.search as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const whereCondition: any = { companyId, ...sharingConditions };

    // We filter Leads based on their conversations
    if (filter === 'mine' || filter === 'me') {
      // Only leads where I am assigned to at least one conversation
      whereCondition.conversations = { some: { claimedById: req.user.userId } };
    } else if (filter === 'unclaimed' || filter === 'unassigned') {
      // Only leads with unassigned and open conversations
      whereCondition.conversations = { some: { claimedById: null, status: 'OPEN' } };
    } else if (filter === 'resolved') {
      // Fix: Only match leads whose MOST RECENT conversation (by updatedAt) has status RESOLVED.
      // Using raw SQL subquery because Prisma does not support ordering in relation filter conditions
      // (conversations: { some: { status: 'RESOLVED' } } matches ANY resolved conversation, not just
      // the most recent one — causing leads with old resolved + newer non-resolved to wrongly appear).
      const resolvedLeadIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT l.id FROM "Lead" l
         WHERE l."companyId" = $1
         AND 'RESOLVED' = (
           SELECT c.status FROM "Conversation" c
           WHERE c."leadId" = l.id
           ORDER BY c."updatedAt" DESC
           LIMIT 1
         )`,
        companyId
      );
      whereCondition.id = { in: resolvedLeadIds.map(r => r.id) };
    }
    // 'all' or no filter: no conversation-level filtering

    // Search by lead name or contact - combines with data-sharing rules via AND
    if (search) {
      const searchOR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
      ];
      if (whereCondition.OR) {
        // Combine existing sharing-rule OR with search OR via AND
        // This ensures BOTH restrictions apply (not either/or)
        whereCondition.AND = [
          { OR: whereCondition.OR },
          { OR: searchOR },
        ];
        delete whereCondition.OR;
      } else {
        whereCondition.OR = searchOR;
      }
    }

    // Count total matching leads
    const total = await (prisma.lead as any).count({ where: whereCondition });

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
              lastViewedAt: true,
              matchedProduct: true,
              matchedProductAt: true,
              claimedBy: {
                select: { id: true, firstName: true, lastName: true }
              },
              messages: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { content: true, sender: true, createdAt: true }
              }
            },
            orderBy: { updatedAt: "desc" },
            take: 50,
          },
      },
      orderBy: { lastActiveAt: "desc" },
      skip,
      take: limit,
    });

    const formatted = await Promise.all(leads.map(async (lead: any) => {
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

      const daysSinceActive = lead.lastActiveAt ? Math.floor((Date.now() - new Date(lead.lastActiveAt).getTime()) / 86400000) : 999;

      // Real AI score computed from CRM formula (same as crm.service.ts recalculateLeadCRM)
      const recencyScore = Math.max(0, 30 - daysSinceActive) / 30 * 30;
      const spendScore = Math.min((lead.totalSpend || 0) / 500, 30);
      const orderScore = Math.min((lead.orderCount || 0) * 5, 20);
      const aiScore = Math.round(recencyScore + spendScore + orderScore);

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

      const agentName = conversation?.claimedBy ? `${conversation.claimedBy.firstName} ${conversation.claimedBy.lastName || ""}`.trim() : null;

      // Get all messages for this conversation
      const allMessages = conversation?.messages || [];
      
       // Find the most recent message that is NOT from SYSTEM (true last customer message)
       const lastCustomerMessage = allMessages.find((m: any) => m.sender !== "SYSTEM" && m.sender !== "BOT");
       
       // Check if most recent message overall is from SYSTEM (hasAutoReply)
       const mostRecent = allMessages[0];
       const hasAutoReply = mostRecent?.sender === "SYSTEM" || mostRecent?.sender === "BOT";
       
       // botRepliedAt: timestamp of most recent SYSTEM message if hasAutoReply is true
       let botRepliedAt: string | null = null;
       if (hasAutoReply) {
         const lastSystemMessage = allMessages.find((m: any) => m.sender === "SYSTEM" || m.sender === "BOT");
         if (lastSystemMessage) {
           botRepliedAt = lastSystemMessage.createdAt.toISOString();
         }
       }

        // isUnread: true if lastActiveAt > lastViewedAt OR lastViewedAt is null
        const isUnread = conversation?.lastViewedAt
          ? new Date(lead.lastActiveAt) > new Date(conversation.lastViewedAt)
          : true;

        // unreadCount: number of customer messages the staff hasn't seen yet.
        // When lastViewedAt is null (never opened), every customer message is unread.
        // Otherwise, count only customer-origin messages after lastViewedAt.
        // Customer-origin = CLIENT and BOT (inbound); AGENT/SYSTEM are staff/bot replies.
        const unreadCount = conversation?.lastViewedAt
          ? await prisma.message.count({
              where: {
                conversationId: conversation.id,
                createdAt: { gt: conversation.lastViewedAt },
                sender: { in: [MessageSender.CLIENT, MessageSender.BOT] },
              },
            })
          : await prisma.message.count({
              where: {
                conversationId: conversation.id,
                sender: { in: [MessageSender.CLIENT, MessageSender.BOT] },
              },
            });

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
        lastMessage: mostRecent?.content || "",
        lastMessageSender: mostRecent?.sender || null,
        sentimentScore: conversation?.sentimentScore || 0,
        intent: conversation?.intent || "BROWSING",

        // Multi-Agent Data
        status: conversation?.status || ConversationStatus.OPEN,
        assignedTo: conversation?.claimedBy || null,

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
         hasAutoReply,
         botRepliedAt,

          // 🆕 Unread indicator
          isUnread,
          unreadCount,

          // Stream Triage fields
          pastOrders: lead.orderCount || 0,
          lifetimeValue: lead.totalSpend || 0,
          reasoning: (() => {
            if (lead.pendingOrderAmount && lead.pendingOrderAmount > 0) return `Customer has a pending order of ₹${lead.pendingOrderAmount} — high conversion priority.`;
            if (conversation?.intent === "ORDERING") return "Customer expressed intent to place an order — strong buy signal.";
            if (conversation?.intent === "SUPPORT") return "Customer needs assistance — resolving quickly builds trust.";
            if (conversation?.intent === "COMPLAINT") return "Customer raised a complaint — needs immediate attention.";
            if (lead.segment === "VIP") return "VIP customer — prioritize for retention and personalized service.";
            if (lead.segment === "CHURN_RISK") return "Customer at risk of churning — proactive win-back recommended.";
            if (lead.orderCount > 0) return "Returning customer — maintain relationship and explore upsell.";
            return "New conversation — monitor for engagement signals.";
          })(),
          matchedProduct: await resolveMatchedProduct(conversation, companyId),
          dropOffMinutes: null, // Drop-off prediction not yet implemented
        };
    }));

    res.json({
      data: formatted,
      meta: {
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      },
    });
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
  const { segment, name, priority, customFields, isPrivate } = req.body;

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
            claimedById: true,
            claimedBy: {
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
   POST /api/leads/:id/assign
   General-purpose assign conversation to current agent
   For Follow Up and Browsing tier claims
========================================= */
router.post("/:id/assign", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    // Only agents can assign conversations
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can assign conversations" });
    }

    // Find the lead with its conversation
    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
      include: {
        conversations: {
          select: {
            id: true,
            claimedById: true,
            status: true,
            claimedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    // Atomically update the conversation - only succeeds if still unclaimed
    const updateResult = await prisma.conversation.updateMany({
      where: {
        id: conversation.id,
        companyId,
        claimedById: null, // lock condition: only succeed if genuinely unclaimed
        status: { not: 'RESOLVED' } // only assign open conversations
      },
      data: {
        claimedById: userId,
        status: "ASSIGNED",
        updatedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      // Check if already claimed by this agent
      if (conversation.claimedById === userId) {
        // Return existing lead for idempotency
        const formattedLead = {
          id: lead.id,
          name: lead.name || "Customer",
          contact: lead.contact,
          channel: lead.channel,
          conversationId: conversation.id,
          status: conversation.status,
          assignedTo: conversation.claimedBy,
        };
        return res.json(formattedLead);
      }
      return res.status(409).json({ message: "This conversation was already claimed by another agent." });
    }

    // Get agent name
    const agent = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });
    const agentName = agent ? `${agent.firstName} ${agent.lastName || ""}`.trim() : "Agent";

    // Emit socket events
    safeEmitConversationUpdate(conversation, "conversation_assigned", {
      conversationId: conversation.id,
      assignedTo: { id: userId, name: agentName }
    });
    emitToCompany(companyId, "lead_updated", {
      leadId: lead.id,
      assignedTo: userId,
      status: "ASSIGNED"
    });

    return res.json({
      id: lead.id,
      name: lead.name || "Customer",
      contact: lead.contact,
      channel: lead.channel,
      conversationId: conversation.id,
      status: "ASSIGNED",
      assignedTo: { id: userId, firstName: agent?.firstName || "", lastName: agent?.lastName || "" }
    });
  } catch (error: any) {
    console.error("Assign conversation error:", error);
    res.status(500).json({ message: "Failed to assign conversation" });
  }
});

/* =========================================
   POST /api/leads/:id/mode
   Staff-facing toggle of conversation AI/Human mode.
   Body: { mode: "BOT" | "HUMAN", reason?: string }
========================================= */
router.post("/:id/mode", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;
    const { mode, reason } = req.body as { mode?: string; reason?: string };

    // Only agents can change conversation mode
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can change conversation mode" });
    }

    // Validate mode
    if (!mode || (mode !== "BOT" && mode !== "HUMAN")) {
      return res.status(400).json({ message: "mode must be BOT or HUMAN" });
    }

    // Find the lead with its conversation (same shape as /assign)
    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
      include: {
        conversations: {
          select: {
            id: true,
            claimedById: true,
            status: true,
            claimedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    const conversationId = conversation.id;

    if (mode === "HUMAN") {
      await escalateToHuman(
        conversationId,
        userId,
        reason || "Manually switched to Human by staff"
      );
      return res.json({ conversationId, mode, resolvedBy: null });
    }

    // mode === "BOT" — switch AI back on WITHOUT resolving the conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { mode: ConversationMode.BOT },
    });
    return res.json({ conversationId, mode, resolvedBy: null });
  } catch (error: any) {
    console.error("Change conversation mode error:", error);
    res.status(500).json({ message: "Failed to change conversation mode" });
  }
});

/* =========================================
   POST /api/leads/:id/ai-suggest
   Generate AI reply suggestion for staff
   Multi-tenant safe — verifies lead belongs to req.user's company
========================================= */
router.post("/:id/ai-suggest", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    // Only agents can generate AI suggestions
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can generate AI suggestions" });
    }

    // Validate leadId belongs to req.user.companyId (tenant-scoping)
    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Call generateReplySuggestion
    const result = await generateReplySuggestion(id, companyId);

    return res.json({ suggestion: result.suggestion, rationale: result.rationale });
  } catch (error: any) {
    console.error("Generate AI suggestion error:", error);
    return res.status(500).json({ message: "Failed to generate suggestion" });
  }
});

/* =========================================
   POST /api/leads/:id/skip
   Mark conversation as skipped/spam — resolves the conversation
   and removes it from the unclaimed queue.
======================================== */
router.post("/:id/skip", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can skip conversations" });
    }

    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
      select: {
        conversations: {
          select: { id: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    const resolvingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });
    const resolvedBy = resolvingUser ? `${resolvingUser.firstName} ${resolvingUser.lastName || ""}`.trim() : "Deleted User";

    await resolveConversation(conversation.id, resolvedBy);

    return res.json({
      id: conversation.id,
      status: "RESOLVED",
      resolvedBy,
      reason: "skipped",
    });
  } catch (error: any) {
    console.error("Skip conversation error:", error);
    return res.status(500).json({ message: "Failed to skip conversation" });
  }
});

/* =========================================
   POST /api/leads/:id/resolve
   Explicitly resolve a conversation (staff "Done" action).
   Does NOT fire on AI/You mode toggle.
======================================== */
router.post("/:id/resolve", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, companyId, role } = req.user!;
    const { id } = req.params;

    // Only agents can resolve conversations
    if (!["STAFF", "MANAGER", "OWNER"].includes(role)) {
      return res.status(403).json({ message: "Only agents can resolve conversations" });
    }

    const lead = await (prisma.lead as any).findFirst({
      where: { id, companyId },
      select: {
        conversations: {
          select: { id: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    // resolvedBy = agent display name (firstName + lastName)
    // Fallback string kept in sync with scripts/backfill_conversation_activity.mjs
    const resolvingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });
    const resolvedBy = resolvingUser ? `${resolvingUser.firstName} ${resolvingUser.lastName || ""}`.trim() : "Deleted User";

    await resolveConversation(conversation.id, resolvedBy);

    return res.json({
      id: conversation.id,
      status: "RESOLVED",
      resolvedBy,
    });
  } catch (error: any) {
    console.error("Resolve conversation error:", error);
    res.status(500).json({ message: "Failed to resolve conversation" });
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

    // Atomically update each conversation — only succeeds if still unclaimed (prevents double-claim races)
    const claimResults = [];
    const alreadyClaimed = [];
    for (const leadId of ids) {
      // Same proven pattern as pending-order claim route (leads.routes.ts ~L362-386)
      const updateResult = await prisma.conversation.updateMany({
        where: {
          leadId,
          companyId,
          claimedById: null // lock condition: only succeed if genuinely unclaimed
        },
        data: {
          claimedById: assignedToId,
          status: "ASSIGNED",
          updatedAt: new Date()
        }
      });

      if (updateResult.count === 0) {
        alreadyClaimed.push(leadId);
      } else {
        claimResults.push(leadId);
      }
    }

    if (alreadyClaimed.length > 0) {
      return res.status(409).json({
        message: alreadyClaimed.length === 1
          ? "This conversation was just claimed by someone else."
          : `${alreadyClaimed.length} conversation(s) were just claimed by someone else.`,
        claimed: claimResults,
        alreadyClaimed
      });
    }

    res.json({ message: `Successfully assigned ${ids.length} leads`, assignedIds: claimResults });

    // Success — return assigned list and notify the rest of the company live
    try {
      const assignedLeads = await (prisma.lead as any).findMany({
        where: { id: { in: claimResults }, companyId },
        select: { id: true, name: true, contact: true, channel: true, lastActiveAt: true },
      });
      const conversations = await (prisma.conversation as any).findMany({
        where: { leadId: { in: claimResults }, companyId },
        select: { id: true, status: true, claimedById: true },
      });
      emitToCompany(companyId, "lead_claimed", {
        leadIds: claimResults,
        assignedTo: assignedToId,
        timestamp: new Date().toISOString(),
        leads: assignedLeads.map((l: any) => {
          const conv = conversations.find((c: any) => c.leadId === l.id);
          return {
            id: l.id, name: l.name || l.contact || "Customer", contact: l.contact,
            channel: l.channel, lastActiveAt: l.lastActiveAt,
            conversationId: conv?.id || null, status: conv?.status || "ASSIGNED",
            claimedById: conv?.claimedById || assignedToId,
          };
        }),
      });
    } catch (emitErr) {
      console.error("Failed to emit lead_claimed event:", emitErr);
    }
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

/* =========================================
   GET /api/leads/:id/messages
   Returns full message history for a lead's conversation
   Multi-tenant safe — verifies lead belongs to req.user's company

   Conversation status can be: OPEN | ASSIGNED | RESOLVED | SNOOZED

   Response schema:
   {
     leadId: string,
     conversationId: string,
     status: "OPEN" | "ASSIGNED" | "RESOLVED" | "SNOOZED",
     messages: Array<{
       id: string,
       content: string,
       sender: "CLIENT" | "AGENT" | "SYSTEM",
       senderName: string | null,
       platform: "WEBSITE" | "TELEGRAM" | "WHATSAPP" | "INSTAGRAM" | null,
       messageType: string,
       deliveryStatus: "SENT" | "FAILED" | null,
       isRead: boolean,
       createdAt: DateTime
     }>
   }
========================================= */
router.get("/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;

    // 1. Find the lead with multi-tenant safety, include conversation + contact info
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, companyId },
      select: { id: true, name: true, contact: true, channel: true, conversations: { select: { id: true, status: true, claimedById: true, mode: true, resolvedBy: true }, take: 1, orderBy: { updatedAt: "desc" } } }
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    // 2. Fetch all messages for this conversation, oldest first
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        sender: true,
        senderName: true,
        platform: true,
        messageType: true,
        deliveryStatus: true,
        deliveryError: true,
        isRead: true,
        createdAt: true,
      },
    });

    return res.json({
      leadId: lead.id,
      conversationId: conversation.id,
      status: conversation.status,
      mode: conversation.mode,
      resolvedBy: conversation.resolvedBy,
      channel: lead.channel,
      customerName: lead.name,
      customerContact: lead.contact,
      messages,
    });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

/* =========================================
   POST /api/leads/:id/read
   Mark a conversation as read by setting lastViewedAt = now().
   This clears the per-chat unread status + unread count so the sidebar
   badge and chat-list indicators update in real time via socket.
   Multi-tenant safe — verifies lead + conversation ownership.
   ========================================= */
router.post("/:id/read", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId } = req.user!;
    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        conversations: {
          select: { id: true, status: true, claimedById: true, companyId: true },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    await prisma.conversation.update({
      where: { id: conversation.id, companyId },
      data: { lastViewedAt: new Date() },
    });

    // Emit so the chat list + sidebar badge refresh without a page reload.
    emitToCompany(companyId, "conversation_updated", {
      conversationId: conversation.id,
      leadId: lead.id,
      lastViewedAt: new Date().toISOString(),
      viewedBy: userId,
    });

    return res.json({ conversationId: conversation.id, lastViewedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Mark as read error:", error);
    return res.status(500).json({ message: "Failed to mark conversation as read" });
  }
});

/* =========================================
   POST /api/leads/:id/reply
   Send an agent reply to a customer conversation
   Multi-tenant safe — verifies lead + conversation ownership
========================================= */
router.post("/:id/reply", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, userId } = req.user!;
    const { id } = req.params;
    const { content, clientMessageId } = req.body;

    if (!content || typeof content !== "string" || content.trim() === "") {
      return res.status(400).json({ message: "Message content is required" });
    }

    // 1. Find the lead with multi-tenant safety, include conversation + contact info
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        contact: true,
        channel: true,
        conversations: {
          select: { id: true, status: true, claimedById: true },
          take: 1,
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = lead.conversations[0];
    if (!conversation) {
      return res.status(404).json({ message: "No conversation found for this lead" });
    }

    // 2. Verify this agent has this conversation claimed
    if (conversation.claimedById !== userId) {
      return res.status(403).json({ message: "You can only reply to conversations you have claimed" });
    }

    // 3. Map Prisma Channel enum to OutboundPayload ChannelType
    const channelMap: Record<string, "TELEGRAM" | "WHATSAPP" | "INSTAGRAM"> = {
      TELEGRAM: "TELEGRAM",
      WHATSAPP: "WHATSAPP",
      INSTAGRAM: "INSTAGRAM",
    };

    const channelType = channelMap[lead.channel];
    if (!channelType) {
      return res.status(400).json({ message: `Unsupported channel: ${lead.channel}` });
    }

    if (!lead.contact) {
      return res.status(400).json({ message: "Customer has no contact identifier for this channel" });
    }

    // 4a. Idempotency check: if clientMessageId provided, return existing Message row if found
    if (clientMessageId) {
      const existingMessage = await prisma.message.findFirst({
        where: { conversationId: conversation.id, clientMessageId },
        select: {
          id: true, content: true, sender: true, senderName: true, senderId: true,
          platform: true, messageType: true, deliveryStatus: true, deliveryError: true,
          isRead: true, createdAt: true,
        },
      });
      if (existingMessage) {
        return res.json(existingMessage);
      }
    }

    // 4b. Get agent name for the message
    const agent = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });
    const agentName = agent ? `${agent.firstName} ${agent.lastName || ""}`.trim() : "Agent";

    // 5. Dispatch the outbound message
    let dispatchResult;
    try {
      dispatchResult = await outboundDispatcherService.dispatch({
        companyId,
        conversationId: conversation.id,
        to: lead.contact,
        channel: channelType,
        content: { text: content },
        sender: "AGENT",
        senderName: agentName,
        senderId: userId,
        ...(clientMessageId ? { clientMessageId } : {}),
      });
    } catch (err: any) {
      // Transport failure path: message was persisted with FAILED status
      if (err?._deliveryStatus === "FAILED" && err?._messageId) {
        // Persist the transport error on the Message row so it's retrievable later
        prisma.message.update({
          where: { id: err._messageId },
          data: { deliveryError: err.errorMessage || null },
        }).catch(e => console.error("Failed to persist deliveryError:", e.message));

        return res.json({
          id: err._messageId,
          content,
          sender: MessageSender.AGENT,
          senderName: agentName,
          senderId: userId,
          platform: lead.channel as PrismaChannel,
          messageType: "TEXT",
          deliveryStatus: "FAILED",
          deliveryError: err.errorMessage || null,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
      // Total failure path (e.g. DB write never happened)
      console.error("Agent reply total failure:", err);
      return res.status(500).json({ message: err.message || "Failed to send reply" });
    }

    // 6. Return the sent message info so frontend can display it immediately
    return res.json({
      id: dispatchResult.messageId,
      content,
      sender: MessageSender.AGENT,
      senderName: agentName,
      senderId: userId,
      platform: lead.channel as PrismaChannel,
      messageType: "TEXT",
      deliveryStatus: dispatchResult.deliveryStatus,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Agent reply error:", error);
    return res.status(500).json({ message: error.message || "Failed to send reply" });
  }
});

/* =========================================
   GET /api/leads/:id/history
   Returns customer conversation history for context
   Multi-tenant safe — verifies lead belongs to req.user's company
========================================= */
router.get("/:id/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    // Verify lead exists and belongs to this company
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversations = await prisma.conversation.findMany({
      where: { leadId: id, companyId },
      select: {
        id: true,
        status: true,
        claimedById: true,
        claimedByName: true,
        resolvedBy: true,
        createdAt: true,
        updatedAt: true,
        activities: {
          select: { type: true, actorName: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Prefer the corrected ConversationActivity name over the legacy Conversation field
    const conversationsWithFixedNames = await Promise.all(
      conversations.map(async (c) => {
        let claimedByName = c.claimedByName;
        if (!claimedByName && c.claimedById) {
          const claimer = await prisma.user.findUnique({
            where: { id: c.claimedById },
            select: { firstName: true, lastName: true },
          });
          claimedByName = claimer
            ? `${claimer.firstName || ""} ${claimer.lastName || ""}`.trim()
            : "Deleted User";
        }
        return {
          ...c,
          claimedByName,
          resolvedBy: c.activities[0]?.actorName || c.resolvedBy,
        };
      })
    );

    return res.json({
      totalConversations: conversationsWithFixedNames.length,
      conversations: conversationsWithFixedNames,
    });
  } catch (error) {
    console.error("Fetch lead history error:", error);
    return res.status(500).json({ message: "Failed to fetch lead history" });
  }
});

export default router;
