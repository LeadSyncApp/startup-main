import { pgBossService } from "../pgboss/pgboss.service";
import { QueueProvider, JobOptions } from "./queue-provider.interface";

export class PgBossProvider implements QueueProvider {
  async enqueue(jobName: string, payload: any, options?: JobOptions): Promise<{ id: string }> {
    // pgboss send takes (name, payload, options)
    const jobId = await pgBossService.getBoss().send(jobName, payload, options as any);
    return { id: jobId || "unknown" };
  }

  async schedule(jobName: string, cron: string, payload: any): Promise<void> {
    // pgboss schedule takes (name, cron, payload)
    await pgBossService.getBoss().schedule(jobName, cron, payload);
  }

  async cancel(jobId: string): Promise<void> {
      await (pgBossService.getBoss() as any).cancel(jobId);
  }
}
