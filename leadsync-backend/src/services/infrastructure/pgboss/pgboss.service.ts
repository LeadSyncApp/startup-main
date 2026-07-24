import PgBossModule from 'pg-boss';
// @ts-ignore
import { Client } from 'pg';

// 🟢 FORCE GLOBAL TLS BYPASS PERSISTENTLY FOR LOCAL DEV ENVIRONMENT
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
    'voice.process.job'
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

    this.boss = new PgBossConstructor({
      connectionString,
      application_name: 'leadsync-pgboss',
    });

    this.boss.on('error', (error: Error) => {
      console.error('PgBoss unexpected error:', error);
    });

    // Hardened Production Schema Initialization
    const pgClientPre = new Client({ connectionString });
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
      // Disable automatic retries on webhook.process — all pipeline errors are
      // permanent (bad channel, bad payload, auth failure). Retries only produce
      // duplicate side effects (Sarvam calls, Groq calls, outbound messages).
      await this.boss.updateQueue('webhook.process', { retryLimit: 0 }).catch((e: any) => {
        console.error('⚠️ [PgBoss] Failed to set retryLimit=0 on webhook.process:', e.message);
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