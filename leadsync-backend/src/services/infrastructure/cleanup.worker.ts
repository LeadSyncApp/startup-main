import { prisma } from "../../lib/prisma";

/**
 * Cleanup Idempotency records based on safety constraints:
 * - NEVER DELETE status = 'PROCESSING' unless updatedAt < NOW() - INTERVAL '7 days'
 * - COMPLETED / FAILED can be safely deleted if expired
 */
export async function cleanupIdempotency(): Promise<number> {
  const batchSize = 1000;
  let totalDeleted = 0;
  let hasMore = true;

  console.log("🧹 [Cleanup:Idempotency] Starting safe batched deletion...");

  while (hasMore) {
    // 1. SELECT IDs with LIMIT to prevent sequential scans / lock exhaustion
    const records: { key: string }[] = await prisma.$queryRaw`
      SELECT key FROM "Idempotency"
      WHERE 
        (status IN ('COMPLETED', 'FAILED') AND "expiresAt" < NOW())
        OR 
        (status = 'PROCESSING' AND "updatedAt" < NOW() - INTERVAL '7 days')
      LIMIT ${batchSize}
    `;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    const keys = records.map((r: any) => r.key);

    // 2. Safely delete using Prisma's native, parameterized deleteMany API
    const deleteResult = await prisma.idempotency.deleteMany({
      where: {
        key: { in: keys }
      }
    });

    const count = deleteResult.count;
    totalDeleted += count;
    console.log(`🧹 [Cleanup:Idempotency] Deleted batch of ${count} records.`);

    if (keys.length < batchSize) {
      hasMore = false;
    } else {
      // Small, non-blocking delay between batches to reduce WAL and VACUUM contention under load
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`🧹 [Cleanup:Idempotency] Finished. Total deleted: ${totalDeleted}`);
  return totalDeleted;
}

/**
 * Cleanup non-pending webhooks older than 30 days retention window
 */
export async function cleanupWebhooks(): Promise<number> {
  const batchSize = 1000;
  let totalDeleted = 0;
  let hasMore = true;

  console.log("🧹 [Cleanup:Webhooks] Starting safe batched deletion of webhooks (PROCESSED/FAILED, >30 days old)...");

  while (hasMore) {
    const records: { id: string }[] = await prisma.$queryRaw`
      SELECT id FROM "IncomingWebhook"
      WHERE 
        status IN ('PROCESSED', 'FAILED') 
        AND "createdAt" < NOW() - INTERVAL '30 days'
      LIMIT ${batchSize}
    `;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    const ids = records.map((r: any) => r.id);

    // Safely delete using Prisma's native, parameterized deleteMany API
    const deleteResult = await prisma.incomingWebhook.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    const count = deleteResult.count;
    totalDeleted += count;
    console.log(`🧹 [Cleanup:Webhooks] Deleted batch of ${count} webhooks.`);

    if (ids.length < batchSize) {
      hasMore = false;
    } else {
      // Small, non-blocking delay between batches to reduce WAL and VACUUM contention under load
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`🧹 [Cleanup:Webhooks] Finished. Total deleted: ${totalDeleted}`);
  return totalDeleted;
}


