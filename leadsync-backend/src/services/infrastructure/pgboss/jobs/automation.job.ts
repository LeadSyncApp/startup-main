export interface AutomationJobPayload {
  automationId: string;
  triggerEvent: string;
  payload: Record<string, unknown>;
}

export const AUTOMATION_JOB_NAME = 'RUN_AUTOMATION';
