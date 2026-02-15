import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { generateStructuredMenu } from "../services/geminiService";

const router = Router();

/* =====================================================
   GET /api/dashboard/kpis
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

      const [leads, conversations, orders, agents] = await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.conversation.count({ where: { companyId } }),
        prisma.order.count({ where: { companyId } }),
        prisma.user.count({ where: { companyId } }),
      ]);

      res.json({
        leads,
        conversations,
        orders,
        agents,
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

      const companyId = req.user.companyId;

      const company = await prisma.company.findUnique({
        where: { id: companyId },
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
   PATCH /api/dashboard/bot-config
   (AI GENERATE OR MERGE MENU)
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

      /* 🔥 Fetch existing menu for merge */
      const existingCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: { botStructuredMenu: true },
      });

      const existingMenu = existingCompany?.botStructuredMenu || null;

      /* 🔥 Generate or Merge */
      const structuredMenu = await generateStructuredMenu(
        shopDescription,
        existingMenu
      );

      const categories = structuredMenu?.categories || [];

      /* 🔥 Convert to Telegram keyboard (2 per row) */
      const keyboardMenu: string[][] = [];

      for (let i = 0; i < categories.length; i += 2) {
        const row = [
          categories[i]?.name,
          categories[i + 1]?.name,
        ].filter(Boolean);

        keyboardMenu.push(row);
      }

      /* 🔥 Save to DB */
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

      const companyId = req.user.companyId;

      const {
        structuredMenu,
        botBusinessType,
        botWelcomeMessage,
      } = req.body;

      if (!structuredMenu || !structuredMenu.categories) {
        return res.status(400).json({
          message: "Structured menu is required",
        });
      }

      const categories = structuredMenu.categories;

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
        message: "Edited menu saved successfully",
        company: updatedCompany,
      });
    } catch (error) {
      console.error("Save edited menu error:", error);
      res.status(500).json({
        message: "Failed to save edited menu",
      });
    }
  }
);

export default router;
