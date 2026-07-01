export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: string;
    delay: number;
  };
}

export interface QueueProvider {
  enqueue(jobName: string, payload: any, options?: JobOptions): Promise<{ id: string }>;
  schedule(jobName: string, cron: string, payload: any): Promise<void>;
  cancel(jobId: string): Promise<void>;
}
