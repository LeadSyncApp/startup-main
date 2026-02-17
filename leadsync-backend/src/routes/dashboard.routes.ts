import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { generateStructuredMenu } from "../services/geminiService";
import { cacheService } from "../services/cache.service";

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

      // Set Cache (30 seconds TTL)
      cacheService.set(cacheKey, responseData, 30);

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

      const company = await prisma.company.findUnique({
        where: { id: req.user.companyId },
        select: {
          botBusinessType: true,
          botWelcomeMessage: true,
          botStructuredMenu: true,
          botMenu: true,
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

export default router;
