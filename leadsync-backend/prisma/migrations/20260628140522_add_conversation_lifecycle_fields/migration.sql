-- Add lifecycle fields to Conversation table for archive/returning-customer tracking
ALTER TABLE "Conversation"
  ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "isReturningCustomer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Backfill: any currently OPEN/ASSIGNED conversation without a claim is implicitly active
-- (default already applied). Existing conversations default to 'active' lifecycle.

CREATE INDEX "Conversation_lifecycleStatus_idx" ON "Conversation"("lifecycleStatus");
CREATE INDEX "Conversation_archivedAt_idx" ON "Conversation"("archivedAt");
CREATE INDEX "Conversation_leadId_lifecycleStatus_idx" ON "Conversation"("leadId", "lifecycleStatus");