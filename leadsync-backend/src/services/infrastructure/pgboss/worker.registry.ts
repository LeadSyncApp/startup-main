import PgBoss from 'pg-boss';
import { Job } from 'pg-boss';
import Groq from 'groq-sdk';
import { getGroq, generateShopReply } from '../../ai/ai.service';
import { cleanupIdempotency } from '../cleanup.worker';
import { pgBossService } from './pgboss.service';
import { getTenantPrismaContext, prisma } from '../../../lib/prisma';
import { EMAIL_JOB_NAME } from './jobs/email.job';
import { PDF_JOB_NAME } from './jobs/pdf.job';
import { invoiceService } from '../../integrations/invoice.service';
import {
  CLEANUP_IDEMPOTENCY_JOB_NAME,
  CLEANUP_WEBHOOKS_JOB_NAME,
  RECOVER_WEBHOOK_JOB_NAME
} from './jobs/cleanup.job';
import { PROCESS_AI_TASK_JOB_NAME } from './jobs/ai.job';
import { tenantContextStorage, resolveTenantContext } from '../../context/tenantContext.provider';
import { outboundDispatcherService } from '../../outbound.dispatcher';

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
        const { orderId, paymentRef } = job.data;
        
        console.log(`[PgBoss] Processing ${PDF_JOB_NAME}. JobID: ${job.id}, OrderID: ${orderId}`);
        
        try {
          // Fetch order to retrieve the companyId (bypasses tenant check because it queries by ID)
          const order = await prisma.order.findUnique({
            where: { id: orderId }
          });

          if (!order) {
            throw new Error(`Order ${orderId} not found`);
          }

          // Resolve tenant context for the company
          const tenantContext = await resolveTenantContext(order.companyId);

          // Wrap invoice generation and order status updates inside the resolved tenant context scope
          await tenantContextStorage.run(tenantContext, async () => {
            // Call the real invoice generation service
            const invoice = await invoiceService.ensureInvoiceForPaidOrder(orderId, paymentRef);

            if (!invoice || !invoice.pdfUrl) {
              throw new Error(`Invoice generation did not complete successfully or is missing PDF URL for Order ${orderId}`);
            }

            // Update Order fulfillment status under the resolved company tenant context
            const tenantDb = getTenantPrismaContext(invoice.companyId);
            await tenantDb.order.update({
              where: { id: orderId },
              data: { status: 'COMPLETED' }
            });
            
            console.log(`[PDF] Invoice successfully generated for Order ${orderId}. Order marked as COMPLETED.`);
          });
        } catch (error: any) {
          console.error(`❌ [PgBoss] Error processing ${PDF_JOB_NAME} for Order ${orderId}:`, error);
          throw error; // Rethrow so pg-boss retries the job
        }
      }
    });

    // 3. Menu Restructure & Knowledge training are now executed dynamically and synchronously
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
