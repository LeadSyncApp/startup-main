import { decryptSecret } from "../../utils/encryption";
import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Prisma, ConversationStatus } from "@prisma/client";
import { authMiddleware, injectTenantContext, AuthRequest } from "../../middleware/auth.middleware";
import { getGroq } from "../../services/ai/ai.service";
import { cacheService } from "../../services/infrastructure/cache.service";
import { upload, fileParserService } from "../../services/integrations/fileParser.service";
import { getMenuSnapshot } from "../../utils/shop-ai.utils";

import { pgBossService } from "../../services/infrastructure/pgboss/pgboss.service";

import { getMerchantMetricsDashboard } from "../../controllers/dashboard.controller";

const router = Router();

// Remap a free-text business type (from dashboard settings) to the typed enum.
function remapBusinessType(value: string | undefined): "RETAIL" | "RESTAURANT" | "SERVICES" | undefined {
  if (!value) return undefined;
  if (value === "Food & Beverage" || value === "Bakery & Food" || value === "Café & Food Outlet" || value === "F&B Outlet") return "RESTAURANT";
  if (value === "Services / Appointments" || value === "Client Agency" || value === "Service / Clinic") return "SERVICES";
  if (value === "RETAIL" || value === "RESTAURANT" || value === "SERVICES") return value;
  return "RETAIL";
}

// Add the fast controller for the new rollup dashboard pattern
router.get("/metrics", authMiddleware, getMerchantMetricsDashboard as any);

async function formatCompanyResponse(company: any) {
  if (!company) return null;


  const structuredMenu = getMenuSnapshot(
    company.botConfiguration?.botStructuredMenu?.categories || []
  );

  return {
    id: company.id,
    name: company.name,
    createdAt: company.createdAt,
    telegramBotToken: decryptSecret(company.telegramBotToken),
    telegramBotUsername: company.telegramBotUsername,
    telegramWebhookSecret: decryptSecret(company.telegramWebhookSecret),
    telegramConnected: company.telegramConnected,
    instagramConnected: company.instagramConnected,
    instagramPageId: company.instagramPageId,
    businessType: company.businessType,
    botWelcomeMessage: company.botWelcomeMessage,
    botStructuredMenu: structuredMenu || null,
    botMenu: company.botConfiguration?.botMenu || null,
    botCommands: company.botConfiguration?.botCommands || null,
    botKnowledgeBase: company.botConfiguration?.botKnowledgeBase || null,
    botLearnedContext: company.botConfiguration?.botLearnedContext || null,
    botPolicies: company.botConfiguration?.botPolicies || "",
    businessName: company.businessName,
    businessAddress: company.businessAddress,
    gstin: company.gstin,
    upiId: company.upiId,
    companyCode: company.companyCode,
    businessStartHour: company.businessStartHour,
    businessEndHour: company.businessEndHour,
    customOooMessage: company.customOooMessage,
    scale: company.scale,
  };
}

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
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      /* =====================================================
         OPTIMIZED: Sequential Queries to hold/release 1 DB connection
      ===================================================== */
      const leads = await prisma.lead.count({ where: { companyId, deletedAt: null } });
      const conversations = await prisma.conversation.count({ where: { companyId, deletedAt: null } });
      const agents = await prisma.user.count({ where: { companyId, isActive: true } });
      const orders = await prisma.order.count({ where: { companyId, isDeleted: false } });

      // CRM Stats
      const openDeals = 0;
      const pendingTasks = 0;
      const activeAccounts = 0;

      // 1. Group by Approval Status (PENDING, APPROVED, REJECTED)
      const orderStats = await prisma.order.groupBy({
        by: ["approvalStatus"],
        where: { companyId },
        _count: { approvalStatus: true },
      });

      // 2. Count DELIVERED explicitly
      const deliveredStats = await prisma.order.count({
        where: { companyId, status: { in: ["DELIVERED"] } },
      });

      // 3. Count BOT_DETECTED (source field)
      const botStats = await prisma.order.count({
        where: { companyId, source: "BOT_DETECTED" },
      });

      // 4. Revenue Aggregate
      const revenueData = await prisma.order.aggregate({
        where: { companyId, isDeleted: false, status: { in: ["DELIVERED", "PAID"] } },
        _sum: { amount: true },
      });

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
        openDeals,
        pendingTasks,
        activeAccounts,
      };

      // Set Cache (60 seconds TTL)
      await cacheService.set(cacheKey, responseData, 60);

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
  injectTenantContext,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const company = await (prisma.company as any).findUnique({
        where: { id: req.user.companyId },
        include: {
          botConfiguration: true,
        },
      });

      const companyFormatted = await formatCompanyResponse(company);

      const activeAgents = await prisma.user.findMany({
        where: { companyId: req.user.companyId, isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true, isAvailable: true }
      });

      const conversationCounts = await prisma.conversation.groupBy({
        by: ["claimedById"],
        where: {
          companyId: req.user.companyId,
          status: ConversationStatus.OPEN,
          claimedById: { in: activeAgents.map(a => a.id) }
        },
        _count: {
          _all: true
        }
      });

      const countsMap = new Map<string, number>();
      conversationCounts.forEach(c => {
        if (c.claimedById) {
          countsMap.set(c.claimedById, c._count._all || 0);
        }
      });

      const agentWorkloads = activeAgents.map((agent) => ({
        id: agent.id,
        name: `${agent.firstName} ${agent.lastName || ""}`.trim(),
        role: agent.role,
        isAvailable: agent.isAvailable,
        openChats: countsMap.get(agent.id) || 0
      }));

      res.json({ company: companyFormatted, agentWorkloads });
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
  injectTenantContext,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { botBusinessType, botWelcomeMessage } = req.body;

      const updatedCompany = await prisma.company.update({
        where: { id: req.user.companyId },
        data: {
          businessType: remapBusinessType(botBusinessType),
          botWelcomeMessage,
        },
        include: {
          botConfiguration: true,
        },
      });

      res.json({
        message: "Welcome updated successfully",
        company: await formatCompanyResponse(updatedCompany),
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
  injectTenantContext,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { businessName, businessAddress, gstin, upiId, businessStartHour, businessEndHour, customOooMessage, scale } = req.body;

      const dataToUpdate: any = {
        businessName,
        businessAddress,
        gstin,
        upiId,
      };

      if (scale !== undefined) {
        dataToUpdate.scale = scale;
      }

      if (businessStartHour !== undefined) {
        dataToUpdate.businessStartHour = Number(businessStartHour);
      }
      if (businessEndHour !== undefined) {
        dataToUpdate.businessEndHour = Number(businessEndHour);
      }
      if (customOooMessage !== undefined) {
        dataToUpdate.customOooMessage = String(customOooMessage);
      }

      const updated = await (prisma.company as any).update({
        where: { id: req.user.companyId },
        data: dataToUpdate,
        include: {
          botConfiguration: true,
        },
      });

      // Clear cached company profile
      await cacheService.delete(cacheService.getCompanyKey(req.user.companyId));

      res.json({ message: "Business details updated", company: await formatCompanyResponse(updated) });
    } catch (error) {
      console.error("Failed to update business details:", error);
      res.status(500).json({ message: "Failed to update business details" });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/bot-config
   异步：将繁重的LLM重组任务推送到后台队列
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

      // 1. Instantly update basic text fields in the DB
      await prisma.company.update({
        where: { id: companyId },
        data: {
          businessType: remapBusinessType(botBusinessType),
          botWelcomeMessage,
        }
      });

      // 2. Run the direct consolidated parser asynchronously to prevent slow timeouts and eliminate out-of-band state queues
      const { restructureMenu } = await import("../../services/ai/ai.service.js");
      
      const existingCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          botConfiguration: {
            select: { botStructuredMenu: true },
          },
        },
      });

      restructureMenu(companyId, shopDescription, existingCompany?.botConfiguration?.botStructuredMenu || null)
        .catch((err: any) => console.error("[SyncMenuRestructureError] Direct restructure failed:", err));

      // 3. Invalidate cache
      await cacheService.delete(cacheService.getCompanyKey(companyId));

      // 4. Return immediate acceptance to keep UI lightning fast
      return res.status(202).json({
        status: "accepted",
        message: "Menu restructuring job successfully enqueued to background workers."
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
  injectTenantContext,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { structuredMenu, botBusinessType, botWelcomeMessage, mergeProducts } = req.body;
      const companyId = req.user.companyId;

      // Fetch the tenant profile configuration upfront
      const company = await (prisma.company as any).findUnique({
        where: { id: companyId },
        select: { currencySymbol: true }
      });
      const currency = company?.currencySymbol || "$";

      // 1. Transactionally update Company config and sync Products
      const result = await prisma.$transaction(async (tx) => {
        // Update Company/Config
        const updated = await tx.company.update({
          where: { id: companyId },
          data: {
            businessType: remapBusinessType(botBusinessType),
            botWelcomeMessage,
            botConfiguration: {
              upsert: {
                create: {
                  botStructuredMenu: structuredMenu,
                },
                update: {
                  botStructuredMenu: structuredMenu,
                },
              },
            },
          },
          include: {
            botConfiguration: true,
          },
        });

        // Sync to Product Table (The Master Catalog)
        if (structuredMenu && Array.isArray(structuredMenu.categories)) {
          // Sync behavior: overwrite or merge
          if (!mergeProducts) {
             await tx.product.deleteMany({ where: { companyId } });
          }

          // Prepare records
          const productsToCreate = structuredMenu.categories.flatMap((cat: any) => 
            (cat.items || []).map((item: any) => ({
              companyId,
              name: item.name,
              price: Number(item.price) || 0,
              category: cat.name,
              isActive: true,
              stockQuantity: typeof item.stock !== 'undefined' ? Number(item.stock) : 999, // use extracted stock, fallback to 999
              trackInventory: true // default to true so stock updates when sold
            }))
          );

          // Seed botKnowledgeBase if it's empty or requested
          const menuSummary = structuredMenu.categories.map((cat: any) => {
             const items = (cat.items || []).map((i: any) => `${i.name} (${currency}${i.price})`).join(", ");
             return `${cat.name}: ${items}`;
          }).join("\n");

          if (productsToCreate.length > 0) {
            if (mergeProducts) {
                // For merging, skip items with existing names to prevent clutter
                const existing = await tx.product.findMany({ where: { companyId } });
                const existingNames = new Set(existing.map((p: any) => p.name.toLowerCase()));
                const filtered = productsToCreate.filter((p: any) => !existingNames.has(p.name.toLowerCase()));
                
                if (filtered.length > 0) {
                    await tx.product.createMany({
                        data: filtered,
                        skipDuplicates: true
                    });
                }
            } else {
                await tx.product.createMany({
                    data: productsToCreate,
                    skipDuplicates: true
                });
            }
          }

          // Update Company/Config with knowledge summary too
          const finalUpdated = await tx.company.update({
            where: { id: companyId },
            data: {
              businessType: remapBusinessType(botBusinessType),
              botWelcomeMessage,
              botConfiguration: {
                upsert: {
                  create: {
                    botStructuredMenu: structuredMenu,
                    botKnowledgeBase: menuSummary,
                  },
                  update: {
                    botStructuredMenu: structuredMenu,
                    botKnowledgeBase: menuSummary,
                  },
                },
              },
            },
            include: {
              botConfiguration: true,
            },
          });

          return finalUpdated;
        }

        // Handle case where structuredMenu is null/empty but business types might have changed
        return await tx.company.update({
            where: { id: companyId },
            data: { businessType: remapBusinessType(botBusinessType), botWelcomeMessage },
            include: { botConfiguration: true }
        });
      });

      const companyFormatted = await formatCompanyResponse(result);

      // Invalidate cache
      await cacheService.delete(cacheService.getCompanyKey(companyId));

      res.json({
        message: "Menu and Master Catalog synchronized successfully",
        company: companyFormatted,
      });
    } catch (error: any) {
      console.error("[Dashboard Save Menu] Error:", {
          message: error.message,
          code: error.code,
          meta: error.meta
      });
      res.status(500).json({
        message: "Failed to save menu",
        error: error.message
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
  injectTenantContext,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });

      const { botKnowledgeBase, botLearnedContext, botPolicies } = req.body;

      const updated = await (prisma.company as any).update({
        where: { id: req.user.companyId },
        data: {
          botConfiguration: {
            upsert: {
              create: {
                botKnowledgeBase,
                botLearnedContext,
                botPolicies,
              },
              update: {
                botKnowledgeBase,
                botLearnedContext,
                botPolicies,
              },
            },
          },
        },
        include: {
          botConfiguration: true,
        },
      });

      res.json({ message: "Knowledge saved", company: await formatCompanyResponse(updated) });
    } catch (error) {
      res.status(500).json({ message: "Failed to save knowledge" });
    }
  }
);

/* =====================================================
   PATCH /api/dashboard/assignment-strategy
===================================================== */
router.patch(
  "/assignment-strategy",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    res.json({ message: "Deprecated" });
  }
);

/* =====================================================
   POST /api/dashboard/train-ai
   异步：将AI知识库训练任务推送到后台队列
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

      // Clear out background queueing. Run the direct consolidated trainer asynchronously.
      const { trainKnowledge } = await import("../../services/ai/ai.service.js");
      trainKnowledge(req.user.companyId, botKnowledgeBase)
        .catch((err: any) => console.error("[SyncKnowledgeTrainError] Direct train failed:", err));

      return res.status(202).json({
        status: "accepted",
        message: "AI knowledge-base training compilation pushed to background queue."
      });
    } catch (error) {
      console.error("Training error:", error);
      res.status(500).json({ message: "Failed to train AI" });
    }
  }
);

/* =====================================================
   POST /api/dashboard/:id/voice-reply
   ⚡ REPLACE / SECURE CONVERSATION MODE VOICE LINK
===================================================== */
router.post("/:id/voice-reply", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { voicePayloadUrl } = req.body;

    // Instantly dispatch to background speech-to-text / parsing queues
    const boss = pgBossService.getBoss();
    await boss.send("voice.process.job", {
      conversationId: id,
      voicePayloadUrl
    });

    return res.status(202).json({
      status: "accepted",
      message: "Voice transaction enqueued for single-turn background execution processing."
    });
  } catch (error: any) {
    console.error("Voice reply error:", error);
    res.status(500).json({ message: "Failed to process voice reply" });
  }
});

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
      const companyId = req.user.companyId;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(`📂 Processing file: ${file.originalname} (${file.mimetype})`);

      // 1. Log file tracking state atomically in the DB
      const pendingFile = await prisma.merchantFile.create({
        data: {
          companyId,
          fileUrl: "", // Wait, do we have fileUrl? since we don't upload to S3 here, actually fileParser reads from buffer.
          fileName: file.originalname,
          status: "PROCESSING"
        }
      });

      // We need to pass the extracted text or raw content to pg-boss, or just extract text here:
      const extractedText = await fileParserService.extractText(file);

      if (!extractedText || extractedText.trim().length === 0) {
        await prisma.merchantFile.update({ where: { id: pendingFile.id }, data: { status: "FAILED", error: "Could not extract any text from the file" }});
        return res.status(400).json({ message: "Could not extract any text from the file" });
      }

      // 2. Run the direct consolidated parser asynchronously and update progress status on completion
      const { restructureMenu } = await import("../../services/ai/ai.service.js");
      restructureMenu(companyId, extractedText, null, pendingFile.id)
        .catch(async (err: any) => {
          console.error("[SyncFileRestructureError] Direct file parsing failed:", err);
          await prisma.merchantFile.update({
            where: { id: pendingFile.id },
            data: { status: "FAILED", error: err?.message || String(err) }
          });
        });

      // 3. Return a clean 202 Accepted status immediately
      return res.status(202).json({
        status: "accepted",
        message: "Menu parsing pipeline successfully initiated out-of-band.",
        fileId: pendingFile.id
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

      // Unclaimed active conversations → shown as "urgent leads" (needs human attention)
      const urgentLeads = await prisma.conversation.count({
        where: {
          companyId,
          deletedAt: null,
          lifecycleStatus: "active",
          claimedById: null,
        },
      }).catch(() => 0);

      // New Order Arrivals (replaces pending orders)
      const newOrderArrivals = await (prisma.lead as any).count({
        where: {
          companyId,
          deletedAt: null,
          pendingOrderState: "PENDING_APPROVAL"
        },
      }).catch(() => 0);

      // Active conversations being handled by bot (mode = BOT, not yet escalated to human)
      const botConversations = await prisma.conversation.count({
        where: {
          companyId,
          deletedAt: null,
          lifecycleStatus: "active",
          mode: "BOT",
        },
      }).catch(() => 0);

      res.json({ urgentLeads, pendingOrders: newOrderArrivals, botConversations });
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

    // Single groupBy query instead of 5 separate count queries
    const segmentCounts = await prisma.lead.groupBy({
      by: ["segment"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });

    const countMap = new Map<string, number>();
    segmentCounts.forEach(s => {
      countMap.set(s.segment, s._count._all || 0);
    });

    const newCount = countMap.get("NEW") || 0;
    const regularCount = countMap.get("REGULAR") || 0;
    const vipCount = countMap.get("VIP") || 0;
    const churnCount = countMap.get("CHURN_RISK") || 0;

    // Separate query for Order table (different model)
    const totalOrders = await (prisma.order as any).count({ where: { companyId, isDeleted: false, status: { notIn: ["BOT_CREATED_ORDER", "REJECTED", "CANCELLED"] } } });

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
        status: { in: ["DELIVERED", "PAID"] },
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
      select: { id: true, firstName: true, lastName: true },
    });

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const agentIds = agents.map(a => a.id);

    // Group conversations count by claimedById in a single query
    // TODO(post-deprecation): This comment previously referred to 'assignedToId', a
    // leftover from the now-deprecated workflow/assignment.service.ts. The code
    // correctly groups by claimedById (the live column written by ai.orchestrator.worker.ts).
    const conversationsGrouped = await prisma.conversation.groupBy({
      by: ["claimedById"],
      where: {
        companyId,
        claimedById: { in: agentIds }
      },
      _count: {
        _all: true
      }
    });

    // Group orders count by processedById in a single query
    const ordersGrouped = await (prisma.order as any).groupBy({
      by: ["processedById"],
      where: {
        companyId,
        processedById: { in: agentIds },
        isDeleted: false,
        completedAt: { gte: since }
      },
      _count: {
        _all: true
      }
    });

    const convMap = new Map<string, number>();
    conversationsGrouped.forEach((item: any) => {
      if (item.claimedById) {
        convMap.set(item.claimedById, item._count._all || 0);
      }
    });

    const orderMap = new Map<string, number>();
    ordersGrouped.forEach((item: any) => {
      if (item.processedById) {
        orderMap.set(item.processedById, item._count._all || 0);
      }
    });

    const stats = agents.map(agent => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName || ""}`.trim(),
      conversations: convMap.get(agent.id) || 0,
      orders: orderMap.get(agent.id) || 0,
    }));

    res.json(stats.sort((a, b) => b.orders - a.orders));
  } catch (err) {
    console.error("Agent stats error:", err);
    res.status(500).json({ message: "Failed to fetch agent stats" });
  }
});

/**
 * GET /dashboard/conversation-summary
 * Manager/owner/admin overview of who is currently handling which conversation.
 */
router.get("/conversation-summary", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    if (role !== "OWNER" && role !== "MANAGER") {
      return res.status(403).json({ error: "Manager/owner only" });
    }
    const companyId = req.user!.companyId;

    const active = await prisma.conversation.findMany({
      where: {
        companyId,
        deletedAt: null,
        lifecycleStatus: "active",
        claimedById: { not: null },
      },
      include: {
        claimedBy: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, name: true } },
      },
    });

    const unclaimed = await prisma.conversation.count({
      where: {
        companyId,
        deletedAt: null,
        lifecycleStatus: "active",
        claimedById: null,
      },
    });

    const byStaffMap = new Map<string, { staffId: string; staffName: string; conversations: any[] }>();
    for (const c of active) {
      if (!c.claimedById) continue;
      if (!byStaffMap.has(c.claimedById)) {
        const staff = c.claimedBy;
        byStaffMap.set(c.claimedById, {
          staffId: c.claimedById,
          staffName: staff ? `${staff.firstName || ""} ${staff.lastName || ""}`.trim() || c.claimedById : "Unknown",
          conversations: [],
        });
      }
      byStaffMap.get(c.claimedById)!.conversations.push({
        id: c.id,
        customerName: c.lead?.name || "Customer",
        channel: c.channel,
      });
    }

    res.json({
      totalActive: active.length + unclaimed,
      unclaimed,
      byStaff: Array.from(byStaffMap.values()).map((s) => ({ ...s, count: s.conversations.length })),
    });
  } catch (err: any) {
    console.error("Conversation summary error:", err);
    res.status(500).json({ error: "Failed to fetch conversation summary" });
  }
});

/* =====================================================
   GET /api/dashboard/low-stock
   Returns count + top 5 low-stock inventory variants.
   Tenant-scoped via authMiddleware companyId.
   Reuses the same LOW_STOCK_THRESHOLD (5) from
   businessNotification.service.ts and inventory.service.ts.
===================================================== */
const LOW_STOCK_THRESHOLD = 5;

router.get("/low-stock", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;

    const products = await prisma.inventoryProduct.findMany({
      where: { companyId, isActive: true },
      include: {
        variants: {
          where: { isActive: true },
          select: { id: true, attributeValue: true, stock: true, sku: true },
        },
      },
    });

    const lowStockItems: {
      productId: string;
      productName: string;
      variantId: string;
      variantName: string;
      stock: number;
      sku: string | null;
    }[] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        if (variant.stock !== null && variant.stock <= LOW_STOCK_THRESHOLD) {
          lowStockItems.push({
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName: variant.attributeValue,
            stock: variant.stock,
            sku: variant.sku,
          });
        }
      }
    }

    lowStockItems.sort((a, b) => a.stock - b.stock);

    res.json({
      totalLowStock: lowStockItems.length,
      items: lowStockItems.slice(0, 5),
    });
  } catch (err) {
    console.error("Low stock error:", err);
    res.status(500).json({ message: "Failed to fetch low stock data" });
  }
});

export default router;
