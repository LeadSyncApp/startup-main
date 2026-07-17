import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function getMerchantMetricsDashboard(req: any, res: Response) {
  const companyId = req.user?.companyId; // Extract safely mapped tenant token parameters

  try {
    const cachedRollup = await prisma.companyAnalyticsRollup.findUnique({
      where: { companyId }
    });

    return res.status(200).json({
      status: "success",
      metrics: {
        totalRevenue: cachedRollup?.totalRevenue || 0.0,
        totalOrders: cachedRollup?.totalOrdersCount || 0,
        totalLeads: cachedRollup?.totalLeadsCount || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to isolate dashboard metrics safely." });
  }
}
