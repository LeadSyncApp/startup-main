import { Router, Response } from "express";
import { prisma } from "../../lib/prisma";
import { authMiddleware, authorizeRoles, AuthRequest } from "../../middleware/auth.middleware";
import { cacheService } from "../../services/infrastructure/cache.service";
import ExcelJS from "exceljs";

const router = Router();

/* ===============================
   GET MAIN ANALYTICS DASHBOARD
   Aggregates granular data for charts
 ============================== */
router.get("/dashboard", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const companyId = req.user.companyId;

        // Check cache
        const forceRefresh = req.query.refresh === "true";
        const cacheKey = `analytics_dashboard_${companyId}`;
        const cached = forceRefresh ? null : await cacheService.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // 1. Date Ranges
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(now.getDate() - 14);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // 2. Fetch Orders (Delivered or Completed)
        const orders = await prisma.order.findMany({
            where: {
                companyId,
                status: { in: ["DELIVERED", "PAID"] },
                createdAt: { gte: thirtyDaysAgo }
            },
            select: {
                amount: true,
                createdAt: true,
                summary: true,
                metadata: true,
                orderItems: true,
                processedBy: { select: { firstName: true, lastName: true } }
            }
        });

        // 3. Daily Revenue Calculation (Last 14 Days)
        const dailyRevenue: Record<string, number> = {};
        const dailyOrders: Record<string, number> = {};

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


        // 4. Calculate Top Products
        // ⚡ CLEAN SINGLE SOURCE OF TRUTH: Rely entirely on the structured JSON populated by the AI orchestrator worker
        const productPerformanceMatrix = orders.reduce((acc: any, order: any) => {
            const items = (order.orderItems as any[]) || [];
            items.forEach(item => {
                const identifier = item.sku || item.name;
                if (identifier) {
                    acc[identifier] = (acc[identifier] || 0) + (item.quantity || 1);
                }
            });
            return acc;
        }, {});

        const topProducts = Object.entries(productPerformanceMatrix)
            .sort((a: any, b: any) => b[1] - a[1]) // Sort desc by quantity sold
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));


        // 5. Agent Performance (Orders Processed)
        const agentMap: Record<string, number> = {};
        orders.forEach(o => {
            const agent = o.processedBy as any;
            if (agent) {
                const agentName = `${agent.firstName} ${agent.lastName || ""}`.trim();
                agentMap[agentName] = (agentMap[agentName] || 0) + 1;
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

        const responseData = {
            revenueChart,
            topProducts,
            topAgents,
            aggregates: {
                revenue30d: totalRevenue30d,
                orders30d: orders.length,
                aov
            }
        };

        // Set cache (60 seconds TTL)
        await cacheService.set(cacheKey, responseData, 60);

        res.json(responseData);

    } catch (error) {
        console.error("Dashboard Analytics Error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
});

/* ================================
   GET /analytics/revenue
   Full revenue analytics for the Revenue page
 ================================ */
router.get("/revenue", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const companyId = req.user.companyId;

        // Check cache
        const forceRefresh = req.query.refresh === "true";
        const cacheKey = `analytics_revenue_${companyId}`;
        const cached = forceRefresh ? null : await cacheService.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const now = new Date();

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);

        const PAID_STATUSES = ["DELIVERED", "PAID"] as const;

        const [currentOrders, previousOrders] = await Promise.all([
            prisma.order.findMany({
                where: {
                    companyId,
                    status: { in: [...PAID_STATUSES] },
                    isDeleted: false,
                    createdAt: { gte: thirtyDaysAgo }
                },
                include: {
                    lead: { select: { name: true, contact: true, channel: true } },
                    processedBy: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { createdAt: "desc" }
            }),
            prisma.order.findMany({
                where: {
                    companyId,
                    status: { in: [...PAID_STATUSES] },
                    isDeleted: false,
                    createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
                },
                select: { amount: true }
            })
        ]);

        // KPIs
        const totalRevenue = currentOrders.reduce((s, o) => s + o.amount, 0);
        const orderCount = currentOrders.length;
        const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

        // Trend % vs previous 30-day period
        const prevRevenue = previousOrders.reduce((s, o) => s + o.amount, 0);
        const trend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;

        // Daily timeline — last 30 days
        const dailyMap: Record<string, { value: number; orders: number }> = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            dailyMap[key] = { value: 0, orders: 0 };
        }
        currentOrders.forEach(o => {
            const key = o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            if (dailyMap[key]) {
                dailyMap[key].value += o.amount;
                dailyMap[key].orders += 1;
            }
        });
        const timeline = Object.entries(dailyMap).map(([name, d]) => ({ name, ...d }));

        // 7-day forecast via linear regression on last 14 days
        const last14 = timeline.slice(-14);
        const n = last14.length;
        const xMean = (n - 1) / 2;
        const yMean = last14.reduce((s, d) => s + d.value, 0) / n;
        const sxx = last14.reduce((s, _, i) => s + Math.pow(i - xMean, 2), 0) || 1;
        const sxy = last14.reduce((s, d, i) => s + (i - xMean) * (d.value - yMean), 0);
        const slope = sxy / sxx;

        const forecast: { name: string; forecast: number }[] = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            const key = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            forecast.push({
                name: key,
                forecast: Math.max(0, Math.round(yMean + slope * (n - 1 + i - xMean)))
            });
        }

        // Recent orders (latest 10)
        const recentOrders = currentOrders.slice(0, 10).map(o => ({
            customer: o.lead?.name || o.lead?.contact || "Unknown",
            amount: o.amount,
            date: o.createdAt,
            status: o.status
        }));

        // Agent performance
        const agentMap: Record<string, { name: string; revenue: number; orders: number }> = {};
        currentOrders.forEach(o => {
            if (o.processedBy) {
                const { id, firstName, lastName } = o.processedBy as any;
                const agentName = `${firstName} ${lastName || ""}`.trim();
                if (!agentMap[id]) agentMap[id] = { name: agentName, revenue: 0, orders: 0 };
                agentMap[id].revenue += o.amount;
                agentMap[id].orders += 1;
            }
        });
        const agentPerformance = Object.values(agentMap)
            .map(a => ({ ...a, avgValue: a.orders > 0 ? Math.round(a.revenue / a.orders) : 0 }))
            .sort((a, b) => b.revenue - a.revenue);

        // Channel attribution
        const channelMap: Record<string, { revenue: number; orders: number }> = {};
        currentOrders.forEach(o => {
            const ch = (o.lead?.channel as string) || "UNKNOWN";
            if (!channelMap[ch]) channelMap[ch] = { revenue: 0, orders: 0 };
            channelMap[ch].revenue += o.amount;
            channelMap[ch].orders += 1;
        });
        const channelAttribution = Object.entries(channelMap).map(([channel, d]) => ({
            channel,
            ...d,
            percentage: totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0
        }));

        const responseData = { totalRevenue, orderCount, avgOrderValue, trend, timeline, forecast, recentOrders, agentPerformance, channelAttribution };

        // Set cache (60 seconds TTL)
        await cacheService.set(cacheKey, responseData, 60);

        res.json(responseData);

    } catch (error) {
        console.error("Revenue Analytics Error:", error);
        res.status(500).json({ message: "Failed to fetch revenue data" });
    }
});

/* ================================
   GET /analytics/crm
   CRM Pipeline and Deal Analytics
 ================================ */
router.get("/crm", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { companyId } = req.user!;

        // 1. Pipeline Funnel (Disabled to omit corporate CRM bloat)
        const funnel: any[] = [];

        // 2. Win/Loss Ratio (Disabled to omit corporate CRM bloat)
        const dealStats: any[] = [];

        // 3. Activity Metrics (Disabled to omit corporate CRM bloat)
        const taskStats: any[] = [];

        // 4. Expected Revenue (Disabled to omit corporate CRM bloat)
        const expectedRevenue = 0;

        res.json({
            funnel,
            dealStats,
            taskStats,
            expectedRevenue,
            period: "90d"
        });
    } catch (error) {
        console.error("CRM Analytics Error:", error);
        res.status(500).json({ message: "Failed to fetch CRM analytics" });
    }
});

/* ================================
   GET /analytics/export
   Download orders as Excel (OWNER/MANAGER only)
 ================================ */
router.get("/export", authMiddleware, authorizeRoles("OWNER", "MANAGER"), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const companyId = req.user.companyId;
        const { from, to } = req.query;

        const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 86_400_000);
        const toDate = to ? new Date(to as string) : new Date();

        const orders = await prisma.order.findMany({
            where: {
                companyId,
                isDeleted: false,
                createdAt: { gte: fromDate, lte: toDate }
            },
            include: {
                lead: { select: { name: true, contact: true, channel: true } },
                processedBy: { select: { firstName: true, lastName: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Orders");

        sheet.columns = [
            { header: "Date", key: "date", width: 18 },
            { header: "Customer", key: "customer", width: 22 },
            { header: "Contact", key: "contact", width: 22 },
            { header: "Channel", key: "channel", width: 14 },
            { header: "Summary", key: "summary", width: 42 },
            { header: "Amount", key: "amount", width: 16 },
            { header: "Status", key: "status", width: 20 },
            { header: "Agent", key: "agent", width: 22 },
        ];

        // Bold header row
        sheet.getRow(1).font = { bold: true };

        orders.forEach(o => {
            const agent = o.processedBy as any;
            const agentName = agent ? `${agent.firstName} ${agent.lastName || ""}`.trim() : "Bot / Unassigned";
            sheet.addRow({
                date: o.createdAt.toLocaleDateString(),
                customer: o.lead?.name || o.lead?.contact || "Unknown",
                contact: o.lead?.contact || "",
                channel: o.lead?.channel || "",
                summary: o.summary,
                amount: o.amount,
                status: o.status,
                agent: agentName
            });
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=leadsync-orders-${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ message: "Export failed" });
    }
});

/* ================================
   GET /analytics/export-leads
   Download leads as Excel (OWNER/MANAGER only)
 ================================ */
router.get("/export-leads", authMiddleware, authorizeRoles("OWNER", "MANAGER"), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const leads = await prisma.lead.findMany({
            where: { companyId: req.user.companyId, deletedAt: null },
            include: {
                conversations: {
                    select: { channel: true, updatedAt: true },
                    orderBy: { updatedAt: "desc" },
                    take: 1,
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Leads");

        sheet.columns = [
            { header: "Name", key: "name", width: 24 },
            { header: "Contact", key: "contact", width: 28 },
            { header: "Channel", key: "channel", width: 14 },
            { header: "Segment", key: "segment", width: 16 },
            { header: "Status", key: "status", width: 14 },
            { header: "Total Spend", key: "totalSpend", width: 18 },
            { header: "Orders", key: "orderCount", width: 10 },
            { header: "Last Active", key: "lastActiveAt", width: 20 },
            { header: "Created", key: "createdAt", width: 20 },
        ];

        sheet.getRow(1).font = { bold: true };

        leads.forEach((l) => {
            sheet.addRow({
                name: l.name || "Unknown",
                contact: l.contact,
                channel: l.channel,
                segment: l.segment,
                status: l.status,
                totalSpend: l.totalSpend,
                orderCount: l.orderCount,
                lastActiveAt: l.lastActiveAt.toLocaleDateString(),
                createdAt: l.createdAt.toLocaleDateString(),
            });
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=leadsync-leads-${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Leads Export Error:", error);
        res.status(500).json({ message: "Export failed" });
    }
});

export default router;
