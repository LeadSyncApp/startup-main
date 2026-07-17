export interface ProcessAITaskPayload {
  taskId: string;
  prompt: string;
  context?: Record<string, unknown>;
}

export interface GenerateSummaryPayload {
  targetId: string;
  type: 'conversation' | 'order' | 'deal';
}

export interface LeadScoringPayload {
  leadId: string;
  rulesetId?: string;
}

export const PROCESS_AI_TASK_JOB_NAME = 'PROCESS_AI_TASK';
export const GENERATE_SUMMARY_JOB_NAME = 'GENERATE_SUMMARY';
export const LEAD_SCORING_JOB_NAME = 'LEAD_SCORING';
