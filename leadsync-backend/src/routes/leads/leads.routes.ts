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
        assignedTo: conversation?.assignedTo || null, // { id, name }

        priority,
        agentAssigned: conversation?.assignedTo?.name || null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Fetch leads error:", error);
    res.status(500).json({ message: "Failed to fetch leads" });
  }
});

export default router;
