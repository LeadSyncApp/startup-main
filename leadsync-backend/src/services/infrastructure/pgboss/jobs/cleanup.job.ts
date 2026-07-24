export interface CleanupJobPayload {
  mode: 'idle' | 'force';
  retentionDays?: number;
}

export const CLEANUP_IDEMPOTENCY_JOB_NAME = 'CLEANUP_IDEMPOTENCY';
export const CLEANUP_WEBHOOKS_JOB_NAME = 'CLEANUP_WEBHOOKS';
export const RECOVER_WEBHOOK_JOB_NAME = 'RECOVER_WEBHOOK';
