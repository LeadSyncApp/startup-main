"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ===============================
   GET MAIN ANALYTICS DASHBOARD
   Aggregates granular data for charts
============================== */
router.get("/dashboard", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const companyId = req.user.companyId;
        // 1. Date Ranges
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(now.getDate() - 14);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        // 2. Fetch Orders (Delivered only)
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                companyId,
                status: "DELIVERED",
                createdAt: { gte: thirtyDaysAgo }
            },
            select: {
                amount: true,
                createdAt: true,
                summary: true,
                processedBy: { select: { name: true } }
            }
        });
        // 3. Daily Revenue Calculation (Last 14 Days)
        const dailyRevenue = {};
        const dailyOrders = {};
        // Initialize last 14 days with 0
        for (let i = 0; i < 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyRevenue[dateStr] = 0;
            dailyOrders[dateStr] = 0;
        }
        orders.forEach(o => {
            const dateStr = o.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (o.createdAt >= fourteenDaysAgo) {
                if (dailyRevenue[dateStr] !== undefined) {
                    dailyRevenue[dateStr] += o.amount;
                    dailyOrders[dateStr] += 1;
                }
            }
        });
        const revenueChart = Object.entries(dailyRevenue).map(([date, amount]) => ({
            date,
            amount,
            orders: dailyOrders[date]
        })).reverse();
        // 4. Calculate Top Products (Simple frequency analysis)
        const productMap = {};
        orders.forEach(o => {
            // Summary format: "2 x Dosa" or "Dosa"
            // Split by newline if multiple products
            const lines = o.summary.split('\n');
            lines.forEach(line => {
                // Remove quantity prefix (e.g., "2 x ")
                // Regex: Start with number, optional x, space
                const cleanName = line.replace(/^\d+\s*x\s*/i, "").trim();
                if (cleanName) {
                    productMap[cleanName] = (productMap[cleanName] || 0) + 1;
                }
            });
        });
        const topProducts = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1]) // Sort desc by count
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        // 5. Agent Performance (Orders Processed)
        const agentMap = {};
        orders.forEach(o => {
            if (o.processedBy?.name) {
                agentMap[o.processedBy.name] = (agentMap[o.processedBy.name] || 0) + 1;
            }
        });
        const topAgents = Object.entries(agentMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        // 6. Total Revenue (Last 30 days)
        const totalRevenue30d = orders.reduce((sum, o) => sum + o.amount, 0);
        // 7. Average Order Value
        const aov = orders.length > 0 ? Math.round(totalRevenue30d / orders.length) : 0;
        res.json({
            revenueChart,
            topProducts,
            topAgents,
            aggregates: {
                revenue30d: totalRevenue30d,
                orders30d: orders.length,
                aov
            }
        });
    }
    catch (error) {
        console.error("Dashboard Analytics Error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
});
exports.default = router;
