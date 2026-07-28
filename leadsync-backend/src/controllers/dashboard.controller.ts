import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { cacheService } from '../services/infrastructure/cache.service';

export async function getMerchantMetricsDashboard(req: any, res: Response) {
  const companyId = req.user?.companyId; // Extract safely mapped tenant token parameters

  try {
    if (companyId) {
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = `dashboard_metrics_${companyId}`;
      const cached = forceRefresh ? null : await cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    const cachedRollup = await prisma.companyAnalyticsRollup.findUnique({
      where: { companyId }
    });

    const responseData = {
      status: "success",
      metrics: {
        totalRevenue: cachedRollup?.totalRevenue || 0.0,
        totalOrders: cachedRollup?.totalOrdersCount || 0,
        totalLeads: cachedRollup?.totalLeadsCount || 0
      }
    };

    if (companyId) {
      await cacheService.set(`dashboard_metrics_${companyId}`, responseData, 60);
    }

    return res.status(200).json(responseData);
  } catch (error) {
    return res.status(500).json({ error: "Failed to isolate dashboard metrics safely." });
  }
}
