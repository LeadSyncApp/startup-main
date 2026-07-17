import { z } from 'zod';

/**
 * Unified Zod Validation Schema for PgBoss structured logs.
 * Validates the critical runtime log events: job_completed and job_failed.
 */
export const PgBossLogSchema = z.union([
  z.object({
    event: z.literal('job_completed'),
    jobName: z.string(),
    jobId: z.string().uuid(),
    recordsProcessed: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
    timestamp: z.string().datetime(), // Validates ISO 8601
  }),
  z.object({
    event: z.literal('job_failed'),
    jobName: z.string(),
    jobId: z.string().uuid(),
    error: z.string(),
    stack: z.string().optional(),
    timestamp: z.string().datetime(), // Validates ISO 8601
  })
]);

// Type inference from schema
export type PgBossLog = z.infer<typeof PgBossLogSchema>;
