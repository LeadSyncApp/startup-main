import { pgBossService } from './pgboss.service';
import {
  CLEANUP_IDEMPOTENCY_JOB_NAME,
  CLEANUP_WEBHOOKS_JOB_NAME,
  RECOVER_WEBHOOK_JOB_NAME
} from './jobs/cleanup.job';
export class SchedulerRegistry {
  private static isRegistered = false;

  public static async registerSchedules(): Promise<void> {
    if (this.isRegistered) return;

    const boss = pgBossService.getBoss();
    console.log('⏱️  [PgBoss] Registering schedules...');

    try {
      // Idempotent Job scheduling
      await boss.schedule(CLEANUP_IDEMPOTENCY_JOB_NAME, '0 2 * * *', { 
        retryLimit: 0,
        singletonKey: CLEANUP_IDEMPOTENCY_JOB_NAME, // Ensure singleton execution
        singletonSeconds: 3000 // Don't allow overlaps if it takes long
      }); 
      await boss.schedule(CLEANUP_WEBHOOKS_JOB_NAME, '0 0 * * *'); // Every midnight
      await boss.schedule(RECOVER_WEBHOOK_JOB_NAME, '*/15 * * * *'); // Every 15 minutes

      this.isRegistered = true;
      console.log('✅ [PgBoss] Schedules registered successfully');
    } catch (error) {
      console.error('❌ [PgBoss] Failed to register schedules:', error);
      throw error;
    }
  }

  public static get hasRegistered(): boolean {
    return this.isRegistered;
  }
}
