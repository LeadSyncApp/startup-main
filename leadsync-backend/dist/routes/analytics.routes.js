"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/* ===============================
   GET REVENUE STATS
   Aggregates delivered orders
============================== */
router.get("/revenue", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const companyId = req.user.companyId;
        // Fetch last 6 months of delivered orders
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                companyId,
                status: "DELIVERED",
                createdAt: { gte: sixMonthsAgo }
            },
            select: {
                amount: true,
                createdAt: true,
                lead: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: "asc" }
        });
        // Group by month for chart
        const monthlyData = {};
        orders.forEach(o => {
            const month = o.createdAt.toLocaleString('default', { month: 'short' });
            monthlyData[month] = (monthlyData[month] || 0) + o.amount;
        });
        const timeline = Object.entries(monthlyData).map(([name, value]) => ({
            name,
            value
        }));
        // Total stats
        const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
        res.json({
            timeline,
            totalRevenue,
            orderCount: orders.length,
            recentOrders: orders.slice(-10).map(o => ({
                customer: o.lead?.name || "Unknown",
                amount: o.amount,
                date: o.createdAt
            }))
        });
    }
    catch (error) {
        console.error("Analytics revenue error:", error);
        res.status(500).json({ message: "Failed to fetch revenue stats" });
    }
});
exports.default = router;
