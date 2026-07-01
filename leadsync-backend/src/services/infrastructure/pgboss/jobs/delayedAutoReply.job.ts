/**
 * Delayed Auto-Reply Job
 *
 * 🛑 FIX: Replaces fragile setTimeout() with pg-boss persistent scheduled jobs.
 * Survives server restarts — the job is stored in PostgreSQL and will fire
 * even if the server goes down and comes back up.
 */
export const DELAYED_AUTO_REPLY_JOB_NAME = "delayed_auto_reply";

export interface DelayedAutoReplyPayload {
  ruleId: string;
  eventKey: string;
  companyId: string;
  conversationId: string;
  leadId: string;
  contact: string;
  channel: string;
  customerName?: string;
  brandName?: string;
  messageBody: string;
  useAI: boolean;
  orderId?: string;
  customerHistory?: {
    orderCount: number;
    totalSpend: number;
    segment: string;
  };
}