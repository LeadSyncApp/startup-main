ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "claimedByName" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "needsStaffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "previousHandledById" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "previousConversationId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);