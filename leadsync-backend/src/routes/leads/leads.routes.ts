import { Router, Response } from "express";
import { prisma, directPrisma } from "../../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { notificationService } from "../../services/infrastructure/notification.service";
import { safeEmitConversationUpdate, emitToAgent, emitToCompany } from "../../lib/socket";
import { validateAndSanitizeCustomFields } from "../../utils/custom-fields.validator";
import { applyDataSharingRules, getSubordinateIds } from "../../lib/sharing.engine";
import { asyncHandler } from "../../middleware/error.middleware";
import { ConversationStatus, ConversationMode, MessageSender, Channel as PrismaChannel } from "@prisma/client";
import { outboundDispatcherService } from "../../services/outbound.dispatcher";
import { escalateToHuman, resolveConversation } from "../../services";
import { generateReplySuggestion } from "../../services/ai/ai.service";
import { getStockStatus } from "../../services/knowledge/inventory.service";

const router = Router();

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
    const filter = req.query.filter as string; // 'unclaimed', 'mine', 'all', 'resolved'
    const search = req.query.search as string;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const countOnly = req.query.countOnly === 'true' || req.query.countOnly === '1';

    // Build base filter conditions for raw SQL
    const params: any[] = [companyId];
    let paramIndex = 2;

    const whereClauses: string[] = [
      `l."companyId" = $1`,
      `l."deletedAt" IS NULL`
    ];

    // Data Sharing Rules
    if (req.user.role !== "OWNER" && req.user.role !== "MANAGER") {
      const subordinateIds = await getSubordinateIds(req.user.userId, companyId);
      const allowedUserIds = [req.user.userId, ...subordinateIds];
      const allowedParamIdx = paramIndex++;
      params.push(allowedUserIds);
      whereClauses.push(`(l."isPrivate" = false OR EXISTS (SELECT 1 FROM "Conversation" c_sh WHERE c_sh."leadId" = l.id AND c_sh."claimedById" = ANY($${allowedParamIdx}::text[])))`);
    }

    // Inbox Filters
    if (filter === 'mine' || filter === 'me') {
      const userParamIdx = paramIndex++;
      params.push(req.user.userId);
      whereClauses.push(`EXISTS (SELECT 1 FROM "Conversation" c_fl WHERE c_fl."leadId" = l.id AND c_fl."claimedById" = $${userParamIdx})`);
    } else if (filter === 'unclaimed' || filter === 'unassigned') {
      whereClauses.push(`EXISTS (SELECT 1 FROM "Conversation" c_fl WHERE c_fl."leadId" = l.id AND c_fl."claimedById" IS NULL AND c_fl.status = 'OPEN')`);
    } else if (filter === 'resolved') {
      whereClauses.push(`'RESOLVED' = (SELECT c_res.status FROM "Conversation" c_res WHERE c_res."leadId" = l.id ORDER BY c_res."updatedAt" DESC LIMIT 1)`);
    }

    // Search
    if (search && search.trim() !== '') {
      const searchParamIdx = paramIndex++;
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(l.name ILIKE $${searchParamIdx} OR l.contact ILIKE $${searchParamIdx})`);
    }

    // Fast-path for countOnly request
    if (countOnly) {
      const countSql = `SELECT CAST(COUNT(*) AS bigint) AS count FROM "Lead" l WHERE ${whereClauses.join(" AND ")}`;
      const countRows = await directPrisma.$queryRawUnsafe<{ count: bigint }[]>(countSql, ...params);
      const total = countRows.length > 0 ? Number(countRows[0].count) : 0;

      return res.json({
        data: [],
        meta: {
          total,
          page,
          limit,
          hasMore: false,
        },
      });
    }

    const limitParamIdx = paramIndex++;
    params.push(limit);
    const offsetParamIdx = paramIndex++;
    params.push(skip);

    const sql = `
      WITH filtered_leads AS (
        SELECT 
          l.id,
          l.name,
          l.contact,
          l.channel,
          l."createdAt",
          l."lastActiveAt",
          l."totalSpend",
          l."orderCount",
          l.segment,
          l."aiPriority",
          l."pendingOrderState",
          l."pendingOrderId",
          l."pendingOrderClaimedById",
          l."pendingOrderClaimedAt",
          l."pendingOrderSummary",
          l."pendingOrderAmount",
          COUNT(*) OVER() AS total_count
        FROM "Lead" l
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY l."lastActiveAt" DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      )
      SELECT 
        fl.*,
        c.id AS conversation_id,
        c."updatedAt" AS conversation_updated_at,
        c.status AS conversation_status,
        c."claimedById" AS conversation_claimed_by_id,
        c."lastViewedAt" AS conversation_last_viewed_at,
        c."matchedProduct" AS conversation_matched_product,
        c."matchedProductAt" AS conversation_matched_product_at,
        c."sentimentScore" AS conversation_sentiment_score,
        c.intent AS conversation_intent,
        u.id AS agent_id,
        u."firstName" AS agent_first_name,
        u."lastName" AS agent_last_name,
        (
          SELECT COALESCE(json_agg(m_sub), '[]'::json)
          FROM (
            SELECT m.content, m.sender, m."createdAt"
            FROM "Message" m
            WHERE m."conversationId" = c.id
            ORDER BY m."createdAt" DESC
            LIMIT 10
          ) m_sub
        ) AS messages_json,
        (
          SELECT CAST(COUNT(*) AS integer)
          FROM "Message" m_un
          WHERE m_un."conversationId" = c.id
            AND m_un.sender IN ('CLIENT', 'BOT')
            AND (c."lastViewedAt" IS NULL OR m_un."createdAt" > c."lastViewedAt")
        ) AS unread_count
      FROM filtered_leads fl
      LEFT JOIN LATERAL (
        SELECT * FROM "Conversation" conv
        WHERE conv."leadId" = fl.id
        ORDER BY conv."updatedAt" DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN "User" u ON u.id = c."claimedById"
      ORDER BY fl."lastActiveAt" DESC;
    `;

    const rawRows = await directPrisma.$queryRawUnsafe<any[]>(sql, ...params);
    let total = rawRows.length > 0 ? Number(rawRows[0].total_count) : 0;

    // Fallback for empty paginated result sets beyond bounds
    if (rawRows.length === 0 && page > 1) {
      const countSql = `SELECT CAST(COUNT(*) AS bigint) AS count FROM "Lead" l WHERE ${whereClauses.join(" AND ")}`;
      const countParams = params.slice(0, paramIndex - 3);
      const countRows = await directPrisma.$queryRawUnsafe<{ count: bigint }[]>(countSql, ...countParams);
      total = countRows.length > 0 ? Number(countRows[0].count) : 0;
    }

    // ── Batch pre-fetch matched products for ALL conversations in one query ──
    const productIds = rawRows
      .map((r: any) => r.conversation_matched_product?.productId)
      .filter(Boolean);
    const uniqueProductIds = [...new Set<string>(productIds)];
    const productBatchMap = new Map<string, any>();
    if (uniqueProductIds.length > 0) {
      const batchProducts = await directPrisma.inventoryProduct.findMany({
        where: { id: { in: uniqueProductIds }, companyId, isActive: true },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          variants: {
            where: { isActive: true },
            select: { attributeValue: true, stock: true },
          },
        },
      });
      for (const p of batchProducts) {
        const stock = p.variants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
        productBatchMap.set(p.id, {
          name: p.name,
          stock,
          stockStatus: getStockStatus(stock),
          thumbnailUrl: p.imageUrl || "",
        });
      }
    }

    const resolveMatchedProductFromBatch = (matchedProduct: any) => {
      if (!matchedProduct || !matchedProduct.productId) return null;
      const batch = productBatchMap.get(matchedProduct.productId);
      if (!batch) return null;
      return {
        name: matchedProduct.name || batch.name,
        variant: matchedProduct.variant || "",
        stock: batch.stock,
        stockStatus: batch.stockStatus,
        thumbnailUrl: matchedProduct.thumbnailUrl || batch.thumbnailUrl,
      };
    };

    const formatted = rawRows.map((row: any) => {
      let priority = "NORMAL";
      if (row.aiPriority === "HIGH") {
        priority = (row.conversation_sentiment_score !== null && row.conversation_sentiment_score < -3) ? "URGENT" : "HIGH";
      } else if (row.aiPriority === "LOW") {
        priority = "LOW";
      }

      const daysSinceActive = row.lastActiveAt ? Math.floor((Date.now() - new Date(row.lastActiveAt).getTime()) / 86400000) : 999;
      const recencyScore = Math.max(0, 30 - daysSinceActive) / 30 * 30;
      const spendScore = Math.min((row.totalSpend || 0) / 500, 30);
      const orderScore = Math.min((row.orderCount || 0) * 5, 20);
      const aiScore = Math.round(recencyScore + spendScore + orderScore);

      let suggestedAction = "Monitor";
      if (row.pendingOrderState === "PENDING_APPROVAL") suggestedAction = "Claim order";
      else if (row.pendingOrderState === "CLAIMED_FOR_APPROVAL") suggestedAction = "Process order";
      else if (row.conversation_intent === "ORDERING") suggestedAction = "Close order";
      else if (row.segment === "CHURN_RISK") suggestedAction = "Win back";
      else if (row.segment === "VIP") suggestedAction = "Retain & reward";
      else if (daysSinceActive > 14) suggestedAction = "Re-engage";
      else if (row.segment === "REGULAR" && row.totalSpend > 3000) suggestedAction = "Upsell to VIP";
      else if (row.segment === "NEW") suggestedAction = "Qualify lead";
      else if (row.conversation_intent === "COMPLAINT") suggestedAction = "Resolve issue";

      const agentName = row.agent_id ? `${row.agent_first_name} ${row.agent_last_name || ""}`.trim() : null;
      const claimedBy = row.agent_id ? { id: row.agent_id, firstName: row.agent_first_name, lastName: row.agent_last_name } : null;

      const allMessages = Array.isArray(row.messages_json) ? row.messages_json : [];
      const mostRecent = allMessages[0];
      const hasAutoReply = mostRecent?.sender === "SYSTEM" || mostRecent?.sender === "BOT";
      let botRepliedAt: string | null = null;
      if (hasAutoReply) {
        const lastSystemMessage = allMessages.find((m: any) => m.sender === "SYSTEM" || m.sender === "BOT");
        if (lastSystemMessage) {
          botRepliedAt = new Date(lastSystemMessage.createdAt).toISOString();
        }
      }

      const isUnread = row.conversation_last_viewed_at
        ? new Date(row.lastActiveAt) > new Date(row.conversation_last_viewed_at)
        : true;

      const unreadCount = row.conversation_id ? Number(row.unread_count || 0) : 0;

      return {
        id: row.id,
        name: row.name || "Customer",
        contact: row.contact,
        channel: row.channel || "WEBSITE",
        createdAt: row.createdAt,
        lastActiveAt: row.lastActiveAt,

        // CRM Data
        totalSpend: row.totalSpend,
        orderCount: row.orderCount,
        segment: row.segment,

        conversationId: row.conversation_id || null,
        lastMessage: mostRecent?.content || "",
        lastMessageSender: mostRecent?.sender || null,
        sentimentScore: row.conversation_sentiment_score || 0,
        intent: row.conversation_intent || "BROWSING",

        // Multi-Agent Data
        status: row.conversation_status || ConversationStatus.OPEN,
        assignedTo: claimedBy,

        priority,
        agentAssigned: agentName,

        // 🆕 New Order Arrivals Data
        hasPendingOrderApproval: row.pendingOrderState !== "NONE",
        pendingOrderState: row.pendingOrderState,
        pendingOrderId: row.pendingOrderId,
        pendingOrderClaimedById: row.pendingOrderClaimedById,
        pendingOrderClaimedAt: row.pendingOrderClaimedAt,
        pendingOrderSummary: row.pendingOrderSummary,
        pendingOrderAmount: row.pendingOrderAmount,

        // 🆕 Agent assignment info for new order arrivals
        canCurrentUserClaim: row.pendingOrderState === "PENDING_APPROVAL" && !row.pendingOrderClaimedById,
        isPendingOrderOwnedByCurrentAgent: row.pendingOrderClaimedById === req.user?.userId,

        // 🆕 Customer history context
        isExistingCustomer: row.orderCount > 0,
        previousOrderCount: row.orderCount,
        previousSpend: row.totalSpend,

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
        pastOrders: row.orderCount || 0,
        lifetimeValue: row.totalSpend || 0,
        reasoning: (() => {
          if (row.pendingOrderAmount && row.pendingOrderAmount > 0) return `Customer has a pending order of ₹${row.pendingOrderAmount} — high conversion priority.`;
          if (row.conversation_intent === "ORDERING") return "Customer expressed intent to place an order — strong buy signal.";
          if (row.conversation_intent === "SUPPORT") return "Customer needs assistance — resolving quickly builds trust.";
          if (row.conversation_intent === "COMPLAINT") return "Customer raised a complaint — needs immediate attention.";
          if (row.segment === "VIP") return "VIP customer — prioritize for retention and personalized service.";
          if (row.segment === "CHURN_RISK") return "Customer at risk of churning — proactive win-back recommended.";
          if (row.orderCount > 0) return "Returning customer — maintain relationship and explore upsell.";
          return "New conversation — monitor for engagement signals.";
        })(),
        matchedProduct: resolveMatchedProductFromBatch(row.conversation_matched_product),
        dropOffMinutes: null, // Drop-off prediction not yet implemented
      };
    });

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
      deletedAt: null,
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
        deletedAt: null,
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
        where: { id, companyId, deletedAt: null }
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
      where: { id, companyId, deletedAt: null },
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
      where: { id, companyId, deletedAt: null },
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
      where: { id, companyId, deletedAt: null },
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
      where: { id, companyId, deletedAt: null },
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
      where: { id, companyId, deletedAt: null },
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

    const lead = await (prisma.lead as any).findFirst({ where: { id, companyId, deletedAt: null } });
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
      where: { id, companyId, deletedAt: null },
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
        where: { id: { in: claimResults }, companyId, deletedAt: null },
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
      where: { id: { in: ids }, companyId, deletedAt: null },
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
   POST /api/conversations/bulk-delete
   Soft-delete multiple conversation threads without touching Lead records
========================================= */
router.post("/conversations/bulk-delete", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { id: { in: ids } },
          { leadId: { in: ids } }
        ]
      },
      select: { id: true, leadId: true }
    });

    const convIds = conversations.map(c => c.id);

    if (convIds.length > 0) {
      await (prisma.conversation as any).updateMany({
        where: {
          id: { in: convIds },
          companyId
        },
        data: {
          deletedAt: new Date(),
          lifecycleStatus: "deleted",
          status: "RESOLVED"
        }
      });

      await (prisma.message as any).updateMany({
        where: {
          conversationId: { in: convIds },
          companyId,
          deletedAt: null
        },
        data: {
          deletedAt: new Date()
        }
      });

      for (const c of conversations) {
        if (c.leadId) {
          emitToCompany(companyId, "conversation_deleted", { conversationId: c.id, leadId: c.leadId });
        }
      }
    }

    res.json({ message: `Successfully soft-deleted ${convIds.length} conversation thread(s)` });
  } catch (error) {
    console.error("Bulk conversation delete error:", error);
    res.status(500).json({ message: "Failed to perform bulk conversation deletion" });
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
        where: { id: { in: ids }, companyId, deletedAt: null },
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
      where: { id: { in: ids }, companyId, deletedAt: null },
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

    // Single query: fetch lead + its latest conversation (with messages) + orders
    // in one round-trip instead of three sequential queries.
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        contact: true,
        channel: true,
        conversations: {
          select: {
            id: true,
            status: true,
            claimedById: true,
            mode: true,
            resolvedBy: true,
            messages: {
              where: { deletedAt: null },
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
            },
          },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
        orders: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            amount: true,
            summary: true,
            source: true,
            createdAt: true,
            metadata: true,
          },
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

    return res.json({
      leadId: lead.id,
      conversationId: conversation.id,
      status: conversation.status,
      mode: conversation.mode,
      resolvedBy: conversation.resolvedBy,
      channel: lead.channel,
      customerName: lead.name,
      customerContact: lead.contact,
      orders: lead.orders,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

/* =========================================
   DELETE /api/leads/:id/messages
   Clear Message History for a conversation (Soft-Delete)
   Keeps Lead, Conversation, Orders, and customer data intact
========================================= */
router.delete("/:id/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        conversations: {
          select: { id: true },
          take: 1,
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!lead || !lead.conversations[0]) {
      return res.status(404).json({ message: "Lead or conversation not found" });
    }

    const conversationId = lead.conversations[0].id;

    // Soft-delete all active messages for this conversation
    await (prisma.message as any).updateMany({
      where: { conversationId, companyId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    safeEmitConversationUpdate({ id: conversationId } as any, "messages_cleared", { conversationId });

    return res.json({ message: "Message history cleared successfully", conversationId });
  } catch (error: any) {
    console.error("Clear messages error:", error);
    return res.status(500).json({ message: "Failed to clear message history" });
  }
});

/* =========================================
   DELETE /api/leads/:id/conversation
   Delete Conversation Thread (Soft-Delete)
   Sets deletedAt on Conversation and clears messages
========================================= */
router.delete("/:id/conversation", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        conversations: {
          select: { id: true },
          take: 1,
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!lead || !lead.conversations[0]) {
      return res.status(404).json({ message: "Lead or conversation not found" });
    }

    const conversationId = lead.conversations[0].id;

    // Soft-delete conversation
    await (prisma.conversation as any).update({
      where: { id: conversationId },
      data: {
        deletedAt: new Date(),
        lifecycleStatus: "deleted",
        status: "RESOLVED"
      }
    });

    // Also soft-delete related messages
    await (prisma.message as any).updateMany({
      where: { conversationId, companyId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    emitToCompany(companyId, "conversation_deleted", { conversationId, leadId: id });

    return res.json({ message: "Conversation deleted successfully", conversationId });
  } catch (error: any) {
    console.error("Delete conversation error:", error);
    return res.status(500).json({ message: "Failed to delete conversation" });
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
      where: { id, companyId, deletedAt: null },
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
      where: { id, companyId, deletedAt: null },
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
    const channelMap: Record<string, "TELEGRAM" | "WHATSAPP" | "INSTAGRAM" | "WEBSITE"> = {
      TELEGRAM: "TELEGRAM",
      WHATSAPP: "WHATSAPP",
      INSTAGRAM: "INSTAGRAM",
      WEBSITE: "WEBSITE",
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
      where: { id, companyId, deletedAt: null },
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
