import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { generateStructuredMenu } from "../services/geminiService";

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

      const leads = await prisma.lead.count({
        where: { companyId },
      });

      const conversations = await prisma.conversation.count({
        where: { companyId },
      });

      const orders = await prisma.order.count({
        where: { companyId },
      });

      const agents = await prisma.user.count({
        where: { companyId },
      });

      const pendingOrders = await prisma.order.count({
        where: {
          companyId,
          approvalStatus: "PENDING",
        },
      });

      const approvedOrders = await prisma.order.count({
        where: {
          companyId,
          approvalStatus: "APPROVED",
        },
      });

      const rejectedOrders = await prisma.order.count({
        where: {
          companyId,
          approvalStatus: "REJECTED",
        },
      });

      const deliveredOrders = await prisma.order.count({
        where: {
          companyId,
          status: "DELIVERED",
        },
      });

      const aiDetectedOrders = await prisma.order.count({
        where: {
          companyId,
          source: "BOT_DETECTED",
        },
      });

      const revenueData = await prisma.order.aggregate({
        where: {
          companyId,
          status: "DELIVERED",
        },
        _sum: {
          amount: true,
        },
      });

      const totalRevenue = revenueData._sum.amount || 0;

      res.json({
        leads,
        conversations,
        orders,
        agents,
        pendingOrders,
        approvedOrders,
        rejectedOrders,
        deliveredOrders,
        aiDetectedOrders,
        totalRevenue,
      });

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
