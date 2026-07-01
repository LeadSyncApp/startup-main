-- Add missing Conversation columns (safe to re-run)
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "claimedByName" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "needsStaffReason" TEXT;