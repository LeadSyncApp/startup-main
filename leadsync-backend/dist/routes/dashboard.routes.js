"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const ai_service_1 = require("../services/ai.service");
const cache_service_1 = require("../services/cache.service");
const fileParser_service_1 = require("../services/fileParser.service");
const router = (0, express_1.Router)();
/* =====================================================
   GET /api/dashboard/kpis
   FIXED: No Promise.all (prevents connection pool crash)
===================================================== */
router.get("/kpis", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const companyId = req.user.companyId;
        /* CHECK CACHE */
        const cacheKey = `dashboard_kpis_${companyId}`;
        const cachedData = cache_service_1.cacheService.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        /* =====================================================
           OPTIMIZED: Parallel Queries + GroupBy Aggregation
        ===================================================== */
        const [leads, conversations, agents, orders, // Total orders count
        orderStats, // Grouped by approvalStatus
        deliveredStats, // Grouped by status (for DELIVERED)
        botStats, // Grouped by source (for BOT_DETECTED)
        revenueData,] = await Promise.all([
            prisma_1.prisma.lead.count({ where: { companyId } }),
            prisma_1.prisma.conversation.count({ where: { companyId } }),
            prisma_1.prisma.user.count({ where: { companyId } }),
            prisma_1.prisma.order.count({ where: { companyId } }),
            // 1. Group by Approval Status (PENDING, APPROVED, REJECTED)
            prisma_1.prisma.order.groupBy({
                by: ["approvalStatus"],
                where: { companyId },
                _count: { approvalStatus: true },
            }),
            // 2. Count DELIVERED explicitly (status field)
            prisma_1.prisma.order.count({
                where: { companyId, status: "DELIVERED" },
            }),
            // 3. Count BOT_DETECTED (source field)
            prisma_1.prisma.order.count({
                where: { companyId, source: "BOT_DETECTED" },
            }),
            // 4. Revenue Aggregate
            prisma_1.prisma.order.aggregate({
                where: { companyId, status: "DELIVERED" },
                _sum: { amount: true },
            }),
        ]);
        // Process Grouped Data
        const pendingOrders = orderStats.find((s) => s.approvalStatus === "PENDING")?._count
            .approvalStatus || 0;
        const approvedOrders = orderStats.find((s) => s.approvalStatus === "APPROVED")?._count
            .approvalStatus || 0;
        const rejectedOrders = orderStats.find((s) => s.approvalStatus === "REJECTED")?._count
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
        cache_service_1.cacheService.set(cacheKey, responseData, 60);
        res.json(responseData);
    }
    catch (err) {
        console.error("KPI fetch error:", err);
        res.status(500).json({ message: "Failed to fetch KPIs" });
    }
});
/* =====================================================
   GET /api/dashboard/bot-config
===================================================== */
router.get("/bot-config", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const company = await prisma_1.prisma.company.findUnique({
            where: { id: req.user.companyId },
            select: {
                botBusinessType: true,
                botWelcomeMessage: true,
                botStructuredMenu: true,
                botMenu: true,
                botKnowledgeBase: true,
                botLearnedContext: true,
                botPolicies: true,
            },
        });
        res.json({ company });
    }
    catch (error) {
        console.error("Fetch bot config error:", error);
        res.status(500).json({
            message: "Failed to fetch bot configuration",
        });
    }
});
/* =====================================================
   PATCH /api/dashboard/update-welcome
===================================================== */
router.patch("/update-welcome", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { botBusinessType, botWelcomeMessage } = req.body;
        const updatedCompany = await prisma_1.prisma.company.update({
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
    }
    catch (error) {
        console.error("Update welcome error:", error);
        res.status(500).json({
            message: "Failed to update welcome",
        });
    }
});
/* =====================================================
   PATCH /api/dashboard/bot-config
===================================================== */
router.patch("/bot-config", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const companyId = req.user.companyId;
        const { botBusinessType, botWelcomeMessage, shopDescription, } = req.body;
        if (!shopDescription) {
            return res.status(400).json({
                message: "shopDescription is required",
            });
        }
        const existingCompany = await prisma_1.prisma.company.findUnique({
            where: { id: companyId },
            select: { botStructuredMenu: true },
        });
        const existingMenu = existingCompany?.botStructuredMenu || null;
        const structuredMenu = await (0, ai_service_1.generateStructuredMenu)(shopDescription, existingMenu);
        const categories = structuredMenu?.categories || [];
        const keyboardMenu = [];
        for (let i = 0; i < categories.length; i += 2) {
            const row = [
                categories[i]?.name,
                categories[i + 1]?.name,
            ].filter(Boolean);
            keyboardMenu.push(row);
        }
        const updatedCompany = await prisma_1.prisma.company.update({
            where: { id: companyId },
            data: {
                botBusinessType,
                botWelcomeMessage,
                botStructuredMenu: structuredMenu,
                botMenu: keyboardMenu,
            },
        });
        // Invalidate cache
        cache_service_1.cacheService.delete(cache_service_1.cacheService.getCompanyKey(companyId));
        res.json({
            message: existingMenu
                ? "Menu updated successfully (merged)"
                : "Menu generated successfully",
            company: updatedCompany,
        });
    }
    catch (error) {
        console.error("Bot config update error:", error);
        res.status(500).json({
            message: "Failed to update bot configuration",
        });
    }
});
/* =====================================================
   PATCH /api/dashboard/save-edited-menu
===================================================== */
router.patch("/save-edited-menu", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { structuredMenu, botBusinessType, botWelcomeMessage } = req.body;
        const updatedCompany = await prisma_1.prisma.company.update({
            where: { id: req.user.companyId },
            data: {
                botStructuredMenu: structuredMenu,
                botBusinessType,
                botWelcomeMessage,
            },
        });
        // Invalidate cache
        cache_service_1.cacheService.delete(cache_service_1.cacheService.getCompanyKey(req.user.companyId));
        res.json({
            message: "Menu saved successfully",
            company: updatedCompany,
        });
    }
    catch (error) {
        console.error("Save menu error:", error);
        res.status(500).json({
            message: "Failed to save menu",
        });
    }
});
/* =====================================================
   PATCH /api/dashboard/save-knowledge
===================================================== */
router.patch("/save-knowledge", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { botKnowledgeBase, botLearnedContext, botPolicies } = req.body;
        const updated = await prisma_1.prisma.company.update({
            where: { id: req.user.companyId },
            data: {
                botKnowledgeBase,
                botLearnedContext,
                botPolicies
            }
        });
        res.json({ message: "Knowledge saved", company: updated });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to save knowledge" });
    }
});
/* =====================================================
   POST /api/dashboard/train-ai
===================================================== */
router.post("/train-ai", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { botKnowledgeBase } = req.body;
        if (!botKnowledgeBase) {
            return res.status(400).json({ message: "Knowledge base is empty" });
        }
        const learned = await (0, ai_service_1.generateLearnedContext)(botKnowledgeBase);
        const updated = await prisma_1.prisma.company.update({
            where: { id: req.user.companyId },
            data: {
                botKnowledgeBase,
                botLearnedContext: learned
            }
        });
        res.json({ message: "AI Trained successfully", botLearnedContext: learned });
    }
    catch (error) {
        console.error("Training error:", error);
        res.status(500).json({ message: "Failed to train AI" });
    }
});
/* =====================================================
   POST /api/dashboard/analyze-menu
   (AI Smart Paste - Extract without saving)
===================================================== */
router.post("/analyze-menu", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { rawText, mergeWithExisting } = req.body;
        if (!rawText) {
            return res.status(400).json({ message: "Raw text is required" });
        }
        let existingMenu = null;
        if (mergeWithExisting) {
            const company = await prisma_1.prisma.company.findUnique({
                where: { id: req.user.companyId },
                select: { botStructuredMenu: true },
            });
            existingMenu = company?.botStructuredMenu;
        }
        const analyzed = await (0, ai_service_1.generateStructuredMenu)(rawText, existingMenu);
        res.json({ menu: analyzed });
    }
    catch (error) {
        console.error("Analyze menu error:", error);
        res.status(500).json({ message: "Failed to analyze menu" });
    }
});
/* =====================================================
   POST /api/dashboard/upload-menu-file
   (Support: PDF, DOCX, XLSX, CSV)
===================================================== */
router.post("/upload-menu-file", auth_middleware_1.authMiddleware, fileParser_service_1.upload.single("file"), async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        console.log(`📂 Processing file: ${file.originalname} (${file.mimetype})`);
        // 1. Extract Text
        const extractedText = await fileParser_service_1.fileParserService.extractText(file);
        if (!extractedText || extractedText.trim().length === 0) {
            return res.status(400).json({ message: "Could not extract any text from the file" });
        }
        // 2. Determine merge preference
        const mergeWithExisting = req.body.mergeWithExisting === 'true';
        let existingMenu = null;
        if (mergeWithExisting) {
            const company = await prisma_1.prisma.company.findUnique({
                where: { id: req.user.companyId },
                select: { botStructuredMenu: true },
            });
            existingMenu = company?.botStructuredMenu;
        }
        // 3. Let AI structure the extracted data
        console.log(`🧱 Structuring data with AI...`);
        const analyzed = await (0, ai_service_1.generateStructuredMenu)(extractedText, existingMenu);
        res.json({
            message: "File processed successfully",
            menu: analyzed,
            extractedSample: extractedText.slice(0, 500) + "..."
        });
    }
    catch (error) {
        console.error("File upload/analysis error:", error);
        res.status(500).json({ message: error.message || "Failed to process file" });
    }
});
exports.default = router;
