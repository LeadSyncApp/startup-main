import PgBossModule from 'pg-boss';
// @ts-ignore
import { Client } from 'pg';

// Supabase uses a certificate chain with a self-signed root CA that Node.js
// doesn't trust by default. We need rejectUnauthorized: false for pg driver connections.
// This is scoped to PgBoss connections only — Prisma handles TLS internally.
const DB_SSL_CONFIG = process.env.DATABASE_URL?.includes('sslmode=require')
  ? { rejectUnauthorized: false }
  : undefined;

class PgBossService {
  private static instance: PgBossService;
  private boss: any = null;
  private isRunning = false;

  // Complete list of all operational queues your application workers/schedules depend on
  private readonly requiredQueues = [
    'webhook.process',
    'ai-triage-job',
    'GENERATE_PDF',
    'SEND_EMAIL',
    'RECOVER_WEBHOOK',
    'CLEANUP_IDEMPOTENCY',
    'PROCESS_AI_TASK',
    'CLEANUP_WEBHOOKS',
    'menu.restructure.job',
    'knowledge.train.job',
    'voice.process.job',
    'CHECK_MISSED_REPLY_SLA',
    'NIGHTLY_PAYMENT_RECONCILIATION',
    'PROCESS_OUTBOX_EVENTS',
    'broadcast.send'
  ];

  private constructor() {}

  public static getInstance(): PgBossService {
    if (!PgBossService.instance) {
      PgBossService.instance = new PgBossService();
    }
    return PgBossService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.boss) return;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }

    const PgBossConstructor = PgBossModule as any;

    if (typeof PgBossConstructor !== 'function') {
      throw new Error("Could not find PgBoss constructor in the module");
    }

    // Strip sslmode from connection string — we pass ssl config explicitly via the
    // `ssl` option so that rejectUnauthorized: false actually takes effect.
    // When sslmode=require is in the URL, pg's parser overrides our ssl config.
    const cleanConnectionString = connectionString.replace(/[?&]sslmode=require&?/, '?').replace(/\?$/, '');

    this.boss = new PgBossConstructor({
      connectionString: cleanConnectionString,
      application_name: 'leadsync-pgboss',
      ssl: DB_SSL_CONFIG,
    });

    this.boss.on('error', (error: Error) => {
      console.error('PgBoss unexpected error:', error);
    });

    // Hardened Production Schema Initialization
    const cleanPgUrl = connectionString.replace(/[?&]sslmode=require&?/, '?').replace(/\?$/, '');
    const pgClientPre = new Client({
      connectionString: cleanPgUrl,
      ssl: DB_SSL_CONFIG,
    });
    try {
      await pgClientPre.connect();
      const schemaCheck = await pgClientPre.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss';"
      );
      if (schemaCheck.rowCount === 0) {
        // Only bootstrap if the schema is entirely missing
        console.log("🚀 Initializing clean, persistent pgboss queue schema architecture...");
      }
    } catch (resetErr) {
      console.error('⚠️ [PgBoss] Schema check failed:', resetErr);
    } finally {
      await pgClientPre.end().catch(() => {});
    }

    await this.boss.start();
    this.isRunning = true;
    console.log('✅ [PgBoss] Core service started successfully');

    console.log('📦 [PgBoss] Seeding queues via official client creation APIs...');
    try {
      for (const queue of this.requiredQueues) {
        await this.boss.createQueue(queue);
      }
      // Allow retries with exponential backoff for transient failures (DB blips,
      // Groq 503s, Telegram timeouts). After 3 attempts the job is dead-lettered.
      await this.boss.updateQueue('webhook.process', {
        retryLimit: 3,
        retryBackoff: true,
      }).catch((e: any) => {
        console.error('⚠️ [PgBoss] Failed to set retry policy on webhook.process:', e.message);
      });
      console.log('✅ [PgBoss] Queue registration/verifications complete.');
    } catch (apiErr) {
      console.error('⚠️ Client-side queue verification failed:', apiErr);
    }

    console.log('✅ [PgBoss] All required queues verified and initialized');
  }

  public getBoss(): any {
    if (!this.boss || !this.isRunning) {
      throw new Error('PgBoss not initialized');
    }
    return this.boss;
  }

  public get isStarted(): boolean {
    return this.isRunning;
  }

  public async stop(): Promise<void> {
    if (this.boss && this.isRunning) {
      try {
        await this.boss.stop({ graceful: true, timeout: 10000 });
        this.isRunning = false;
        console.log('🛑 [PgBoss] Stopped gracefully');
      } catch (error) {
        console.error('⚠️ [PgBoss] Error during shutdown:', error);
      }
    }
  }
}

export const pgBossService = PgBossService.getInstance();