import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../services/infrastructure/cache.service';
import { OrderStatus } from '@prisma/client';

const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
  OrderStatus.SHIPPED,
  OrderStatus.PROCESSING,
  OrderStatus.PREPARING,
  OrderStatus.READY
];

const PENDING_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.NEW,
  OrderStatus.BOT_CREATED_ORDER,
  OrderStatus.USER_CONFIRMED_PENDING_AGENT
];

function getStartOfTodayInTimezone(timezone: string = "Asia/Kolkata"): Date {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  let offset = "+05:30";
  if (timezone === "UTC") offset = "Z";
  return new Date(`${dateStr}T00:00:00.000${offset}`);
}

export async function getMerchantMetricsDashboard(req: any, res: Response) {
  const companyId = req.user?.companyId;

  try {
    if (!companyId) {
      return res.status(400).json({ error: "Missing companyId in auth context." });
    }

    const forceRefresh = req.query.refresh === 'true';
    const cacheKey = `dashboard_metrics_${companyId}`;
    const cached = forceRefresh ? null : await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true }
    });

    const startOfToday = getStartOfTodayInTimezone(company?.timezone || "Asia/Kolkata");

    // 1. Total counts
    const [totalOrders, totalLeads, paidOrdersCount, pendingOrdersCount] = await Promise.all([
      prisma.order.count({ where: { companyId, isDeleted: false } }),
      prisma.lead.count({ where: { companyId, deletedAt: null } }),
      prisma.order.count({ where: { companyId, isDeleted: false, status: { in: PAID_STATUSES } } }),
      prisma.order.count({ where: { companyId, isDeleted: false, status: { in: PENDING_STATUSES } } }),
    ]);

    // 2. Revenue aggregates
    const [totalRevenueData, todayCollectionData, pendingPaymentsData] = await Promise.all([
      prisma.order.aggregate({
        where: { companyId, isDeleted: false, status: { in: PAID_STATUSES } },
        _sum: { amountInSubunits: true, amount: true }
      }),
      prisma.order.aggregate({
        where: {
          companyId,
          isDeleted: false,
          status: { in: PAID_STATUSES },
          createdAt: { gte: startOfToday }
        },
        _sum: { amountInSubunits: true, amount: true }
      }),
      prisma.order.aggregate({
        where: {
          companyId,
          isDeleted: false,
          status: { in: PENDING_STATUSES }
        },
        _sum: { amountInSubunits: true, amount: true }
      })
    ]);

    const getSum = (data: any) => data._sum.amountInSubunits !== null && data._sum.amountInSubunits !== undefined
      ? Number(data._sum.amountInSubunits) / 100
      : (data._sum.amount || 0);

    const totalRevenue = getSum(totalRevenueData);
    const todayCollection = getSum(todayCollectionData);
    const pendingPayments = getSum(pendingPaymentsData);

    const responseData = {
      status: "success",
      metrics: {
        totalRevenue,
        totalOrders,
        totalLeads,
        todayCollection,
        pendingPayments,
        paidOrders: paidOrdersCount,
        pendingOrders: pendingOrdersCount
      }
    };

    await cacheService.set(cacheKey, responseData, 60);

    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error("Dashboard metrics calculation error:", error);
    return res.status(500).json({ error: "Failed to isolate dashboard metrics safely." });
  }
}
