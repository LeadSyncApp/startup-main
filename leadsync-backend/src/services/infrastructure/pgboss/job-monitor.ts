import { pgBossService } from './pgboss.service';

export interface JobMonitoringStatus {
  jobName: string;
  jobId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'created' | 'active' | 'completed' | 'failed' | 'retry' | 'cancelled';
  attempts: number;
}

export class JobMonitorService {
  /**
   * Retrieves the status of a specific job.
   * This is an abstraction layer that can be extended later to read from customized
   * materialized views or specific tables without exposing the underlying PgBoss API.
   */
  public async getJobStatus(jobName: string, jobId: string): Promise<JobMonitoringStatus | null> {
    const boss = pgBossService.getBoss();
    
    // Abstracting pg-boss job fetching. 
    // In actual implementation, we might query the pgboss.job table directly
    // or use `boss.getJobById(jobName, jobId)` if PgBoss exposes it.
    // For now, this is a placeholder/abstraction structure.
    
    const job = await boss.getJobById(jobName, jobId);
    
    if (!job) {
      return null;
    }

    return {
      jobName: job.name,
      jobId: job.id,
      createdAt: new Date(job.createdOn),
      startedAt: job.startedOn ? new Date(job.startedOn) : undefined,
      completedAt: job.completedOn ? new Date(job.completedOn) : undefined,
      status: job.state as JobMonitoringStatus['status'],
      attempts: job.retryCount,
    };
  }

  /**
   * Fetch recent jobs by name
   */
  public async getRecentJobs(jobName: string, limit = 50): Promise<JobMonitoringStatus[]> {
    // This is a stub for the abstraction layer. Actual DB queries can be implemented here.
    return [];
  }
}

export const jobMonitorService = new JobMonitorService();
