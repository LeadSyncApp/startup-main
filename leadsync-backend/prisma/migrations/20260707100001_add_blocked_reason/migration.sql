-- Add blockedReason column to RuleDecisionLog
ALTER TABLE "RuleDecisionLog" ADD COLUMN "blockedReason" TEXT;

-- Add index for blockedReason
CREATE INDEX "RuleDecisionLog_blockedReason_idx" ON "RuleDecisionLog"("blockedReason");