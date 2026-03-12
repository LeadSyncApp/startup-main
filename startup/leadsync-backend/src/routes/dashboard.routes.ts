import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { generateStructuredMenu, generateLearnedContext } from "../services/ai.service";
import { cacheService } from "../services/cache.service";
import { upload, fileParserService } from "../services/fileParser.service";

const router = Router();

/* =====================================================
   GET /api/dashboard/kpis
   FIXED: No Promise.all (prevents connection pool crash)
===================================================== */
router.get(
  "/kpis",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const companyId = req.user.companyId;

      /* CHECK CACHE */
      const cacheKey = `dashboard_kpis_${companyId}`;
      const cachedData = cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      /* =====================================================
         OPTIMIZED: Parallel Queries + GroupBy Aggregation
      ===================================================== */
      const [
        leads,
        conversations,
        agents,
        orders, // Total orders count
        orderStats, // Grouped by approvalStatus
        deliveredStats, // Grouped by status (for DELIVERED)
        botStats, // Grouped by source (for BOT_DETECTED)
        revenueData,
      ] = await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.conversation.count({ where: { companyId } }),
        prisma.user.count({ where: { companyId } }),
        prisma.order.count({ where: { companyId } }),

        // 1. Group by Approval Status (PENDING, APPROVED, REJECTED)
        prisma.order.groupBy({
          by: ["approvalStatus"],
          where: { companyId },
          _count: { approvalStatus: true },
        }),

        // 2. Count DELIVERED explicitly (status field)
        prisma.order.count({
          where: { companyId, status: "DELIVERED" },
        }),

        // 3. Count BOT_DETECTED (source field)
        prisma.order.count({
          where: { companyId, source: "BOT_DETECTED" },
        }),

        // 4. Revenue Aggregate
        prisma.order.aggregate({
          where: { companyId, status: "DELIVERED" },
          _sum: { amount: true },
        }),
      ]);

      // Process Grouped Data
      const pendingOrders =
        orderStats.find((s) => s.approvalStatus === "PENDING")?._count
          .approvalStatus || 0;
      const approvedOrders =
        orderStats.find((s) => s.approvalStatus === "APPROVED")?._count
          .approvalStatus || 0;
      const rejectedOrders =
        orderStats.find((s) => s.approvalStatus === "REJECTED")?._count
          .approvalStatus || 0;

      const totalRevenue = revenueData._sum.amount || 0;

      const responseData = {
        leads,
        conversations,
        orders,
        agents,
        pendingOrders,
        approvedOrders,
        rejectedOrders,
        deliveredOrders: deliveredStats,
        aiDetectedOrders: botStats,
        totalRevenue,
      };

      // Set Cache (60 seconds TTL)
      cacheService.set(cacheKey, responseData, 60);

      res.json(responseData);
    } catch (err) {
      console.error("KPI fetch error:", err);
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  }
);

/* =====================================================
   GET /api/dashboard/bot-config
===================================================== */
router.get(
  "/bot-config",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const company = await (prisma.company as any).findUnique({
        where: { id: req.user.companyId },
        select: {
          botBusinessType: true,
          botWelcomeMessage: true,
          botStructuredMenu: true,
          botMenu: true,
          botKnowledgeBase: true,
          botLearnedContext: true,
          botPolicies: true,
          businessName: true,
          businessAddress: true,
          gstin: true,
        },
      });

      res.json({ company });
    } catch (error) {
      console.error("Fetch bot config error:", error);
      res.status(500).json({
        message: "Failed to fetch bot configuration",
      });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/update-welcome
===================================================== */
router.patch(
  "/update-welcome",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { botBusinessType, botWelcomeMessage } = req.body;

      const updatedCompany = await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          botBusinessType,
          botWelcomeMessage,
        },
      });

      res.json({
        message: "Welcome updated successfully",
        company: updatedCompany,
      });
    } catch (error) {
      console.error("Update welcome error:", error);
      res.status(500).json({
        message: "Failed to update welcome",
      });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/business-details
===================================================== */
router.patch(
  "/business-details",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { businessName, businessAddress, gstin } = req.body;

      const updated = await (prisma.company as any).update({
        where: { id: req.user.companyId },
        data: {
          businessName,
          businessAddress,
          gstin,
        }
      });

      res.json({ message: "Business details updated", company: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to update business details" });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/bot-config
===================================================== */
router.patch(
  "/bot-config",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const companyId = req.user.companyId;

      const {
        botBusinessType,
        botWelcomeMessage,
        shopDescription,
      } = req.body;

      if (!shopDescription) {
        return res.status(400).json({
          message: "shopDescription is required",
        });
      }

      const existingCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: { botStructuredMenu: true },
      });

      const existingMenu = existingCompany?.botStructuredMenu || null;

      const structuredMenu = await generateStructuredMenu(
        shopDescription,
        existingMenu
      );

      const categories = structuredMenu?.categories || [];

      const keyboardMenu: string[][] = [];

      for (let i = 0; i < categories.length; i += 2) {
        const row = [
          categories[i]?.name,
          categories[i + 1]?.name,
        ].filter(Boolean);

        keyboardMenu.push(row);
      }

      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: {
          botBusinessType,
          botWelcomeMessage,
          botStructuredMenu: structuredMenu,
          botMenu: keyboardMenu,
        },
      });

      // Invalidate cache
      cacheService.delete(cacheService.getCompanyKey(companyId));

      res.json({
        message: existingMenu
          ? "Menu updated successfully (merged)"
          : "Menu generated successfully",
        company: updatedCompany,
      });

    } catch (error) {
      console.error("Bot config update error:", error);
      res.status(500).json({
        message: "Failed to update bot configuration",
      });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/save-edited-menu
===================================================== */
router.patch(
  "/save-edited-menu",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { structuredMenu, botBusinessType, botWelcomeMessage } = req.body;

      const updatedCompany = await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          botStructuredMenu: structuredMenu,
          botBusinessType,
          botWelcomeMessage,
        },
      });

      // Invalidate cache
      cacheService.delete(cacheService.getCompanyKey(req.user.companyId));

      res.json({
        message: "Menu saved successfully",
        company: updatedCompany,
      });
    } catch (error) {
      console.error("Save menu error:", error);
      res.status(500).json({
        message: "Failed to save menu",
      });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/save-knowledge
===================================================== */
router.patch(
  "/save-knowledge",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { botKnowledgeBase, botLearnedContext, botPolicies } = req.body;

      const updated = await (prisma.company as any).update({
        where: { id: req.user.companyId },
        data: {
          botKnowledgeBase,
          botLearnedContext,
          botPolicies
        }
      });

      res.json({ message: "Knowledge saved", company: updated });
    } catch (error) {
      res.status(500).json({ message: "Failed to save knowledge" });
    }
  }
);

/* =====================================================
   POST /api/dashboard/train-ai
===================================================== */
router.post(
  "/train-ai",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { botKnowledgeBase } = req.body;
      if (!botKnowledgeBase) {
        return res.status(400).json({ message: "Knowledge base is empty" });
      }

      const learned = await generateLearnedContext(botKnowledgeBase);

      const updated = await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          botKnowledgeBase,
          botLearnedContext: learned
        }
      });

      res.json({ message: "AI Trained successfully", botLearnedContext: learned });
    } catch (error) {
      console.error("Training error:", error);
      res.status(500).json({ message: "Failed to train AI" });
    }
  }
);

/* =====================================================
   POST /api/dashboard/analyze-menu
   (AI Smart Paste - Extract without saving)
===================================================== */
router.post(
  "/analyze-menu",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { rawText, mergeWithExisting } = req.body;
      if (!rawText) {
        return res.status(400).json({ message: "Raw text is required" });
      }

      let existingMenu = null;
      if (mergeWithExisting) {
        const company = await prisma.company.findUnique({
          where: { id: req.user.companyId },
          select: { botStructuredMenu: true },
        });
        existingMenu = company?.botStructuredMenu;
      }

      const analyzed = await generateStructuredMenu(rawText, existingMenu);

      res.json({ menu: analyzed });
    } catch (error) {
      console.error("Analyze menu error:", error);
      res.status(500).json({ message: "Failed to analyze menu" });
    }
  }
);

/* =====================================================
   POST /api/dashboard/upload-menu-file
   (Support: PDF, DOCX, XLSX, CSV)
===================================================== */
router.post(
  "/upload-menu-file",
  authMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(`📂 Processing file: ${file.originalname} (${file.mimetype})`);

      // 1. Extract Text
      const extractedText = await fileParserService.extractText(file);

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract any text from the file" });
      }

      // 2. Determine merge preference
      const mergeWithExisting = req.body.mergeWithExisting === 'true';
      let existingMenu = null;

      if (mergeWithExisting) {
        const company = await prisma.company.findUnique({
          where: { id: req.user.companyId },
          select: { botStructuredMenu: true },
        });
        existingMenu = company?.botStructuredMenu;
      }

      // 3. Let AI structure the extracted data
      console.log(`🧱 Structuring data with AI...`);
      const analyzed = await generateStructuredMenu(extractedText, existingMenu);

      res.json({
        message: "File processed successfully",
        menu: analyzed,
        extractedSample: extractedText.slice(0, 500) + "..."
      });
    } catch (error: any) {
      console.error("File upload/analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to process file" });
    }
  }
);

/* =====================================================
   GET /api/dashboard/alerts
   Returns counts for urgent conversations, pending orders, active bot chats
===================================================== */
router.get(
  "/alerts",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.user!;

      const [urgentLeads, pendingOrders, botConversations] = await Promise.all([
        // Conversations with negative sentiment → shown as "urgent leads"
        prisma.conversation.count({
          where: { companyId, sentimentScore: { lt: -3 } },
        }).catch(() => 0),
        // Orders awaiting agent approval
        prisma.order.count({
          where: {
            companyId,
            status: { in: ["NEW", "BOT_CREATED_ORDER", "PENDING"] as any },
            isDeleted: false,
          },
        }).catch(() => 0),
        // Active bot-mode conversations
        prisma.conversation.count({
          where: { companyId, mode: "BOT" },
        }).catch(() => 0),
      ]);

      res.json({ urgentLeads, pendingOrders, botConversations });
    } catch (error) {
      console.error("Alerts KPI error:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  }
);

/* =====================================================
   GET /api/dashboard/funnel
   Lead counts per segment + conversion to order rate
===================================================== */
router.get("/funnel", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;

    const [newCount, regularCount, vipCount, churnCount, totalOrders] = await Promise.all([
      (prisma.lead as any).count({ where: { companyId, segment: "NEW" } }),
      (prisma.lead as any).count({ where: { companyId, segment: "REGULAR" } }),
      (prisma.lead as any).count({ where: { companyId, segment: "VIP" } }),
      (prisma.lead as any).count({ where: { companyId, segment: "CHURN_RISK" } }),
      (prisma.order as any).count({ where: { companyId, isDeleted: false, status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] } } }),
    ]);

    const total = newCount + regularCount + vipCount + churnCount;
    const conversionRate = total > 0 ? Math.round((totalOrders / total) * 100) : 0;

    res.json({
      stages: [
        { label: "New Leads",   value: newCount,     color: "#6366f1" },
        { label: "Regular",     value: regularCount, color: "#10b981" },
        { label: "VIP",         value: vipCount,     color: "#8b5cf6" },
        { label: "Churn Risk",  value: churnCount,   color: "#ef4444" },
        { label: "Orders",      value: totalOrders,  color: "#f59e0b" },
      ],
      conversionRate,
      totalLeads: total,
    });
  } catch (err) {
    console.error("Funnel error:", err);
    res.status(500).json({ message: "Failed to fetch funnel" });
  }
});

/* =====================================================
   GET /api/dashboard/forecast
   Last 30 days revenue + linear forecast for next 14 days
===================================================== */
router.get("/forecast", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await (prisma.order as any).findMany({
      where: {
        companyId,
        isDeleted: false,
        status: { in: ["DELIVERED", "COMPLETED", "SHIPPED"] },
        completedAt: { gte: since },
      },
      select: { completedAt: true, amount: true },
      orderBy: { completedAt: "asc" },
    });

    // Bucket into daily revenue
    const dayMap: Record<string, number> = {};
    for (const o of orders) {
      const day = new Date(o.completedAt).toISOString().slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + o.amount;
    }

    const historical = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));

    // Simple linear regression for next 14 days
    if (historical.length >= 3) {
      const n = historical.length;
      const xMean = (n - 1) / 2;
      const yMean = historical.reduce((s, d) => s + d.revenue, 0) / n;
      let num = 0, den = 0;
      historical.forEach((d, i) => {
        num += (i - xMean) * (d.revenue - yMean);
        den += (i - xMean) ** 2;
      });
      const slope = den !== 0 ? num / den : 0;
      const intercept = yMean - slope * xMean;

      const forecast: { date: string; revenue: number; forecast: boolean }[] = [];
      for (let i = 1; i <= 14; i++) {
        const futureDate = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
        const predicted = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
        forecast.push({ date: futureDate, revenue: predicted, forecast: true });
      }

      return res.json({ historical, forecast });
    }

    res.json({ historical, forecast: [] });
  } catch (err) {
    console.error("Forecast error:", err);
    res.status(500).json({ message: "Failed to generate forecast" });
  }
});

/* =====================================================
   GET /api/dashboard/agent-stats
   Per-agent performance metrics
===================================================== */
router.get("/agent-stats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;

    const agents = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const stats = await Promise.all(agents.map(async (agent) => {
      const [conversations, orders] = await Promise.all([
        prisma.conversation.count({ where: { companyId, assignedToId: agent.id } }),
        (prisma.order as any).count({ where: { companyId, processedById: agent.id, isDeleted: false, createdAt: { gte: since } } }),
      ]);
      return { id: agent.id, name: agent.name, conversations, orders };
    }));

    res.json(stats.sort((a, b) => b.orders - a.orders));
  } catch (err) {
    console.error("Agent stats error:", err);
    res.status(500).json({ message: "Failed to fetch agent stats" });
  }
});

export default router;
