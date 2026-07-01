import PgBoss from 'pg-boss';
import { Job } from 'pg-boss';
import Groq from 'groq-sdk';
import { getGroq, generateShopReply } from '../../ai/ai.service';
import { cleanupIdempotency } from '../cleanup.worker';
import { pgBossService } from './pgboss.service';
import { getTenantPrismaContext, prisma } from '../../../lib/prisma';
import { EMAIL_JOB_NAME } from './jobs/email.job';
import { PDF_JOB_NAME } from './jobs/pdf.job';
import { AUTOMATION_JOB_NAME } from './jobs/automation.job';
import {
  CLEANUP_IDEMPOTENCY_JOB_NAME,
  CLEANUP_WEBHOOKS_JOB_NAME,
  CLEANUP_AUTOMATION_LOGS_JOB_NAME,
  RECOVER_WEBHOOK_JOB_NAME
} from './jobs/cleanup.job';
import { PROCESS_AI_TASK_JOB_NAME } from './jobs/ai.job';
import { DELAYED_AUTO_REPLY_JOB_NAME } from './jobs/delayedAutoReply.job';
import { executeDelayedAutomation } from '../../workflow/automation.service';
import { tenantContextStorage } from '../../context/tenantContext.provider';
import { outboundDispatcherService } from '../../outbound.dispatcher';
import { autoReplyService } from '../../automation/autoReply.service';
import { LEAD_FOLLOWUP_JOB_NAME } from './jobs/leadFollowUp.job';
import { executeLeadFollowUpCron } from '../../automation/leadFollowUp.cron';

export async function processConfigMaintenanceTask(job: { data: any }) {
  const { tenantContextEnvelope, rawTaskPayload } = job.data;

  // Ensure even background operations inherit global safety layers, model bindings, and tenant secrets
  return tenantContextStorage.run(tenantContextEnvelope, async () => {
    const outcome = await generateShopReply({
      user_message: `Execute internal metadata optimization profile target: ${rawTaskPayload.text}`,
      menu_snapshot: rawTaskPayload.snapshotContext
    });
    
    return outcome;
  });
}

export async function processIncomingMessageJob(job: { data: any }) {
  const payload = job.data;

  // ⚡ CONSOLIDATED SINGLE-TURN DISPATCH: Route directly into the Omni-Turn hub
  const context = tenantContextStorage.getStore();
  if (!context) throw new Error("Execution Context Error: Background job invoked outside TenantContext boundary.");

  const aiTurnResult = await generateShopReply({
    user_message: payload.message,
    menu_snapshot: payload.enrichmentContext?.categories || []
  });

  // The classification is extracted natively from the unified structural output frame
  const validatedIntent = aiTurnResult.intent_type; 

  await outboundDispatcherService.dispatchAction(validatedIntent, aiTurnResult);
}

export class WorkerRegistry {
  private static isRegistered = false;

  public static async initializePgBossWorkers(boss: any): Promise<void> {
    console.log('👷 [PgBoss] Registering workers...');

    // 1. Send Email Worker
    await boss.work(EMAIL_JOB_NAME, { batchSize: 5 }, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      for (const job of jobs) {
        const { companyId, orderId } = job.data;
        const tenantDb = getTenantPrismaContext(companyId);
        
        console.log(`[PgBoss] Processing ${EMAIL_JOB_NAME}. JobID: ${job.id}, OrderID: ${orderId}`);
        
        // Simulating email logic
        const order = await tenantDb.order.findUnique({ where: { id: orderId } });
        if (!order) throw new Error(`Order ${orderId} not found`);
        
        console.log(`[Email] Email sent for Order ${orderId} in company ${companyId}`);
      }
    });

    // 2. Generate PDF Worker
    await boss.work(PDF_JOB_NAME, { batchSize: 1 }, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      for (const job of jobs) {
        const { companyId, orderId } = job.data;
        const tenantDb = getTenantPrismaContext(companyId);
        
        console.log(`[PgBoss] Processing ${PDF_JOB_NAME}. JobID: ${job.id}, OrderID: ${orderId}`);
        
        await tenantDb.$transaction(async (tx) => {
          // Mock PDF binary generation
          const mockPdfBuffer = Buffer.from('mock-pdf-content');
          console.log(`[PDF] Generated PDF for Order ${orderId} (${mockPdfBuffer.length} bytes)`);

          // Update Order fulfillment status
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'COMPLETED' }
          });
          
          console.log(`[PDF] Order ${orderId} marked as COMPLETED`);
        });
      }
    });

    // 3. Run Automation Worker
    await boss.work(AUTOMATION_JOB_NAME, { batchSize: 5 }, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      for (const job of jobs) {
        console.log(`[PgBoss] Processing ${AUTOMATION_JOB_NAME}. JobID: ${job.id}`);
        await executeDelayedAutomation(job.data as any);
      }
    });

    // 4. Menu Restructure & Knowledge training are now executed dynamically and synchronously
    // via direct, high-performance in-memory flows inside ai.service.ts to prevent out-of-band state desynchronizations.

    // Cleanup Idempotency
    await boss.work(CLEANUP_IDEMPOTENCY_JOB_NAME, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      const job = jobs[0];
      if (!job) return;
      const startTime = Date.now();
      console.log(`⏱️  [PgBoss] Starting ${CLEANUP_IDEMPOTENCY_JOB_NAME}. JobID: ${job.id}`);
      
      try {
        const count = await cleanupIdempotency();
        const duration = Date.now() - startTime;
        
        console.log(JSON.stringify({
          event: "job_completed",
          jobName: CLEANUP_IDEMPOTENCY_JOB_NAME,
          jobId: job.id,
          recordsProcessed: count,
          durationMs: duration,
          timestamp: new Date().toISOString()
        }));
      } catch (err: any) {
        console.error(JSON.stringify({
          event: "job_failed",
          jobName: CLEANUP_IDEMPOTENCY_JOB_NAME,
          jobId: job.id,
          error: err.toString(),
          stack: err.stack,
          timestamp: new Date().toISOString()
        }));
        throw err;
      }
    });

    // Cleanup Webhooks
    await boss.work(CLEANUP_WEBHOOKS_JOB_NAME, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      console.log(`[PgBoss] Processed ${CLEANUP_WEBHOOKS_JOB_NAME}`);
    });

    // Cleanup Automation Logs
    await boss.work(CLEANUP_AUTOMATION_LOGS_JOB_NAME, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      console.log(`[PgBoss] Processed ${CLEANUP_AUTOMATION_LOGS_JOB_NAME}`);
    });

    // Recover Webhook
    await boss.work(RECOVER_WEBHOOK_JOB_NAME, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      console.log(`[PgBoss] Processed ${RECOVER_WEBHOOK_JOB_NAME}`);
    });

    // Process AI Task
    await boss.work(PROCESS_AI_TASK_JOB_NAME, async (jobs: Array<{ id: string; name: string; data: any }>) => {
      for (const job of jobs) {
        await processIncomingMessageJob(job);
      }
    });

    // 🛑 FIX: Delayed Auto-Reply Worker — replaces fragile setTimeout.
    // This job is fired by pg-boss after the configured delay (minutes/hours/days).
    // It survives server restarts because pg-boss stores the job in PostgreSQL.
    await boss.work(DELAYED_AUTO_REPLY_JOB_NAME, async (jobs: Array<{ id: string; data: any }>) => {
      for (const job of jobs) {
        try {
          console.log(`[PgBoss] Processing ${DELAYED_AUTO_REPLY_JOB_NAME}. JobID: ${job.id}`);
          
          const payload = job.data;
          const tenantDb = getTenantPrismaContext(payload.companyId);
          
          // 🛑 FIX: Fetch the LIVE rule from DB instead of trusting stale job payload
          // This ensures we respect any rule changes (disable, message edit) made while the job was pending
          const liveRule = await tenantDb.autoReplyRule.findUnique({
            where: { id: payload.ruleId },
          });
          
          if (!liveRule || !liveRule.isEnabled) {
            console.log(`[PgBoss] Skipping ${DELAYED_AUTO_REPLY_JOB_NAME} JobID: ${job.id} — rule disabled or deleted`);
            continue;
          }
          
          await autoReplyService.executeDelayedAutoReply(
            {
              id: liveRule.id,
              messageBody: liveRule.messageBody,
              useAI: liveRule.useAI || false,
              brandVoice: liveRule.brandVoice,
              targetLanguage: liveRule.targetLanguage,
            },
            {
              companyId: payload.companyId,
              conversationId: payload.conversationId,
              leadId: payload.leadId,
              contact: payload.contact,
              channel: payload.channel,
              customerName: payload.customerName,
              brandName: payload.brandName,
              orderId: payload.orderId,
              customerHistory: payload.customerHistory,
            },
            payload.eventKey
          );
          
          console.log(`[PgBoss] ${DELAYED_AUTO_REPLY_JOB_NAME} completed for JobID: ${job.id}`);
        } catch (err: any) {
          console.error(`[PgBoss] ${DELAYED_AUTO_REPLY_JOB_NAME} failed for JobID: ${job.id}:`, err.message);
          
          // 🛑 FIX: Log failure to autoReplyLog for visibility
          try {
            const payload = job.data;
            const tenantDb = getTenantPrismaContext(payload.companyId);
            await tenantDb.autoReplyLog.create({
              data: {
                companyId: payload.companyId,
                ruleId: payload.ruleId,
                eventKey: payload.eventKey,
                triggeredFor: payload.leadId,
                recipient: payload.contact,
                channel: payload.channel,
                messageBody: payload.messageBody,
                status: "FAILED",
                error: err.message,
              },
            });
          } catch (logErr) {
            console.error(`[PgBoss] Failed to create failure log for JobID: ${job.id}:`, logErr);
          }
          
          throw err; // Let pg-boss handle retries
        }
      }
    });

    // ⏰ Lead Follow-Up Cron Worker
    await boss.work(LEAD_FOLLOWUP_JOB_NAME, async (jobs: Array<{ id: string; data: any }>) => {
      for (const job of jobs) {
        try {
          console.log(`[PgBoss] Processing ${LEAD_FOLLOWUP_JOB_NAME}. JobID: ${job.id}`);
          const result = await executeLeadFollowUpCron();
          console.log(`[PgBoss] ${LEAD_FOLLOWUP_JOB_NAME} completed for JobID: ${job.id}`, result);
        } catch (err: any) {
          console.error(`[PgBoss] ${LEAD_FOLLOWUP_JOB_NAME} failed for JobID: ${job.id}:`, err.message);
          throw err;
        }
      }
    });

  }

  public static async registerWorkers(): Promise<void> {
    if (this.isRegistered) return;
    const boss = pgBossService.getBoss();
    await this.initializePgBossWorkers(boss);
    this.isRegistered = true;
    console.log('✅ [PgBoss] Workers registered successfully');
  }

  public static get hasRegistered(): boolean {
    return this.isRegistered;
  }
}
