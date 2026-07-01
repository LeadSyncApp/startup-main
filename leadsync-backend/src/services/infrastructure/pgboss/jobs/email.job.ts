export interface EmailJobPayload {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export const EMAIL_JOB_NAME = 'SEND_EMAIL';
