export const LEAD_FOLLOWUP_JOB_NAME = "LEAD_FOLLOWUP";

/**
 * Payload for lead follow-up jobs (used for lead.followup and lead.cold_recovery)
 */
export interface LeadFollowUpJobPayload {
  companyId: string;
  leadId: string;
  eventKey: "lead.followup" | "lead.cold_recovery";
}