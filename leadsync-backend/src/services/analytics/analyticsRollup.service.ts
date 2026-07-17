import { prisma } from '../../lib/prisma';

export class AnalyticsRollupService {
  /**
   * High-Performance Atomic KPI Increment.
   * Modulates a pre-aggregated row using a database native structural execution loop.
   */
  public static async incrementMerchantKPIs(companyId: string, data: { revenueDelta?: number; orderDelta?: number; leadDelta?: number }) {
    const revenue = data.revenueDelta || 0;
    const orders = data.orderDelta || 0;
    const leads = data.leadDelta || 0;

    // Use native raw SQL execution blocks to enforce atomic incrementation safely
    await prisma.$executeRaw`
      INSERT INTO "CompanyAnalyticsRollup" ("id", "companyId", "totalRevenue", "totalOrdersCount", "totalLeadsCount", "updatedAt")
      VALUES (gen_random_uuid(), ${companyId}, ${revenue}, ${orders}, ${leads}, NOW())
      ON CONFLICT ("companyId") DO UPDATE 
      SET 
        "totalRevenue" = "CompanyAnalyticsRollup"."totalRevenue" + ${revenue},
        "totalOrdersCount" = "CompanyAnalyticsRollup"."totalOrdersCount" + ${orders},
        "totalLeadsCount" = "CompanyAnalyticsRollup"."totalLeadsCount" + ${leads},
        "updatedAt" = NOW();
    `;
  }
}
