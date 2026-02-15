import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

/**
 * GET /api/leads
 * Company scoped via JWT
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const companyId = req.user.companyId;

    const leads = await prisma.lead.findMany({
      where: {
        companyId,
      },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = leads.map((lead) => ({
      id: lead.id,
      name: lead.name || "Customer",
      contact: lead.contact,
      channel: lead.channel,
      createdAt: lead.createdAt,
      conversationId: lead.conversations[0]?.id || null,
      lastMessage: lead.conversations[0]?.messages[0]?.content || "",
      priority: "NORMAL",
      status: "NEW",
      agentAssigned: null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Fetch leads error:", error);
    res.status(500).json({ message: "Failed to fetch leads" });
  }
});

export default router;
