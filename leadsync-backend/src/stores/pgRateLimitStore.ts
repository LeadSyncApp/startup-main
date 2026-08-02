import { Pool } from "pg";

const DB_SSL_CONFIG = process.env.DATABASE_URL?.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : undefined;

let tableCreated = false;

async function ensureTable(pool: Pool) {
  if (tableCreated) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "RateLimitEntry" (
      key       TEXT PRIMARY KEY,
      count     INTEGER NOT NULL DEFAULT 1,
      expiresAt TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON "RateLimitEntry" (expiresAt);
  `);
  tableCreated = true;
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL?.replace(/[?&]sslmode=require&?/, "?").replace(/\?$/, "");
  return new Pool({ connectionString: url, ssl: DB_SSL_CONFIG, max: 5 });
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) pool = createPool();
  return pool;
}

/**
 * Starts periodic cleanup of expired rate-limit entries.
 * Runs every 5 minutes, deletes rows older than 1 hour.
 */
export function startRateLimitCleanup(): void {
  setInterval(async () => {
    try {
      await getPool().query(
        `DELETE FROM "RateLimitEntry" WHERE expiresAt < NOW() - INTERVAL '1 hour'`
      );
    } catch {
      // silent — cleanup is best-effort
    }
  }, 5 * 60 * 1000).unref();
}

export class PgRateLimitStore {
  private windowMs: number;

  constructor(opts?: { windowMs?: number; max?: number }) {
    this.windowMs = opts?.windowMs ?? 15 * 60 * 1000;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    await ensureTable(getPool());
    const expiresAt = new Date(Date.now() + this.windowMs);
    const res = await getPool().query(
      `INSERT INTO "RateLimitEntry" (key, count, expiresAt)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE
         SET count = "RateLimitEntry".count + 1
       RETURNING count, expiresAt`,
      [key, expiresAt]
    );
    const row = res.rows[0];
    return { totalHits: row.count, resetTime: new Date(row.expiresAt) };
  }

  async decrement(key: string): Promise<void> {
    await getPool().query(
      `UPDATE "RateLimitEntry" SET count = GREATEST(count - 1, 0)
       WHERE key = $1`,
      [key]
    );
  }

  async resetKey(key: string): Promise<void> {
    await getPool().query(`DELETE FROM "RateLimitEntry" WHERE key = $1`, [key]);
  }

  async resetAll(): Promise<void> {
    await getPool().query(`DELETE FROM "RateLimitEntry"`);
  }
}
