import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/* ===============================
   GET REVENUE STATS
   Aggregates delivered orders
============================== */
router.get("/revenue", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const companyId = req.user.companyId;

        // Fetch last 6 months of delivered orders
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const orders = await prisma.order.findMany({
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
        const monthlyData: Record<string, number> = {};
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

    } catch (error) {
        console.error("Analytics revenue error:", error);
        res.status(500).json({ message: "Failed to fetch revenue stats" });
    }
});

export default router;
