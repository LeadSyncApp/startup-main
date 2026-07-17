import { prisma } from "../../lib/prisma";
import { IdempotencyStatus } from "@prisma/client";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export class IdempotencyService {
    async acquireProcessingLock(key: string, ttlSeconds: number = 300): Promise<boolean> {
        try {
            // Atomic state transition using raw SQL to avoid TOCTOU
            // We insert if it doesn't exist, OR update if it is FAILED/STALE
            const query = `
                INSERT INTO "Idempotency" ("key", "status", "expiresAt", "updatedAt")
                VALUES ($1, 'PROCESSING', NOW() + ($2 * INTERVAL '1 second'), NOW())
                ON CONFLICT ("key") DO UPDATE
                SET "status" = 'PROCESSING',
                    "updatedAt" = NOW()
                WHERE ("Idempotency"."status" = 'FAILED')
                   OR ("Idempotency"."status" = 'PROCESSING' AND "Idempotency"."updatedAt" < NOW() - INTERVAL '10 minutes')
                RETURNING *;
            `;

            const result = await prisma.$executeRawUnsafe(query, key, ttlSeconds);
            
            if (result > 0) {
                console.log(`🔒 Idempotency lock acquired for key: ${key}`);
                return true;
            }
            
            console.log(`🛡️ Lock acquisition failed for key: ${key} (Duplicate/Active)`);
            return false;
        } catch (error) {
            console.error(`❌ Error acquiring idempotency lock for ${key}:`, error);
            throw error;
        }
    }

    async markCompleted(key: string, result: any): Promise<void> {
        await prisma.idempotency.update({
            where: { key },
            data: {
                status: IdempotencyStatus.COMPLETED,
                result: result,
                updatedAt: new Date()
            }
        });
        console.log(`✅ Idempotency marked as COMPLETED for key: ${key}`);
    }

    async markFailed(key: string, error: any): Promise<void> {
        await prisma.idempotency.update({
            where: { key },
            data: {
                status: IdempotencyStatus.FAILED,
                result: { 
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
                updatedAt: new Date()
            }
        });
        console.log(`❌ Idempotency marked as FAILED for key: ${key}`);
    }
}

export const idempotencyService = new IdempotencyService();
