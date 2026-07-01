import { IdempotencyStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * IdempotencyGuard
 * Manages the lifecycle of webhook event processing to avoid duplicate processing of the same events.
 */
export class IdempotencyGuard {
  /**
   * Attempts to lock an event for processing. 
   * If the event is already being processed or completed, it returns the current status.
   * If the event is new, it locks it with 'PROCESSING' state and returns 'NEW'.
   */
  static async checkOrLock(key: string, ttlHours: number = 2): Promise<'NEW' | 'PROCESSING' | 'COMPLETED'> {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    try {
      await prisma.idempotency.create({
        data: {
          key,
          status: IdempotencyStatus.PROCESSING,
          expiresAt,
        },
      });
      return 'NEW';
    } catch (error: any) {
      // P2002 is the unique constraint violation code in Prisma
      if (error.code === 'P2002') {
        const existing = await prisma.idempotency.findUnique({ where: { key } });
        if (existing) {
          if (existing.status === IdempotencyStatus.PROCESSING) return 'PROCESSING';
          if (existing.status === IdempotencyStatus.COMPLETED) return 'COMPLETED';
        }
      }
      throw error;
    }
  }

  /**
   * Marks the event processing as completed.
   */
  static async complete(key: string, result: any = {}): Promise<void> {
    await prisma.idempotency.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        result: result,
      },
    });
  }

  /**
   * Marks the event processing as failed.
   */
  static async fail(key: string): Promise<void> {
    await prisma.idempotency.update({
      where: { key },
      data: {
        status: IdempotencyStatus.FAILED,
      },
    });
  }
}
