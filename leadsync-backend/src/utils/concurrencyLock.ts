import { Prisma } from "@prisma/client";
import { basePrisma } from "../lib/prisma";
import { stepProfiler } from "./stepProfiler";

/**
 * Standard CRC32 string hashing algorithm.
 * Guarantees consistent integer output matching crc-32 library.
 */
function crc32(str: string): number {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xFF];
  }
  return (crc ^ -1) | 0;
}

export class ConcurrencyLock {
  /**
   * Acquires a distributed PostgreSQL transactional advisory lock for the given conversationId.
   * Enforces a strict, atomic FIFO queue sequence across all cluster replicas by utilizing
   * the database tier.
   *
   * SAFE FOR PGBOUNCER (TRANSACTION MODE):
   * This uses pg_advisory_xact_lock rather than session locks, tying the lock lifecycle exclusively 
   * to the database transaction (Prisma $transaction) rather than the database connection.
   *
   * @param conversationId - The unique identifier to lock.
   * @param action - The logic to execute while holding the lock. This MUST execute its queries via the passed `tx` object!
   */
  public static async withConversationLock<T>(
    conversationId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    if (!conversationId) {
      console.warn("⚠️ [ConcurrencyLock] Empty conversation ID provided. Skipping lock.");
      return await action(basePrisma);
    }

    // Generate two completely distinct 32-bit hash coordinates from the single unique string
    const hashPartA = crc32(conversationId) | 0;
    const hashPartB = crc32(conversationId.split('').reverse().join('')) | 0;

    // Pack both 32-bit halves into a single 64-bit BigInt for pg_advisory_xact_lock
    // PostgreSQL only accepts ONE bigint argument, not two
    const lockKey = (BigInt(hashPartA & 0xFFFFFFFF) << 32n) | BigInt(hashPartB & 0xFFFFFFFF);

    return await stepProfiler.time(
      "ConcurrencyLock.withConversationLock total block",
      "concurrencyLock.ts:56",
      "Lock",
      `basePrisma.$transaction (pg_advisory_xact_lock Key=${lockKey})`,
      true,
      async () => {
        return await basePrisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            await stepProfiler.time(
              "pg_advisory_xact_lock acquisition",
              "concurrencyLock.ts:61",
              "Lock",
              `SELECT pg_advisory_xact_lock(${lockKey})`,
              true,
              () => tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1);`, lockKey)
            );

            console.log(`🔒 [ConcurrencyLock] Acquired 64-bit transaction-scoped distributed lock for Conversation=${conversationId} (Key=${lockKey})`);
            
            return await action(tx);
          },
          {
            timeout: 60000,   // Max time for processing logic
            maxWait: 60000    // Max time to wait for a database connection
          }
        );
      }
    );
  }
}
