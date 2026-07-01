-- ==========================================
-- Migration: Fix schema to match live DB
-- ==========================================
-- Changes:
--   1. Add missing Message columns: senderName, senderId, isRead
--   2. Add missing Conversation column: claimedByName, needsStaffReason
--   3. Add missing index: Message_conversationId_isRead_idx
-- ==========================================

-- 1. ADD missing columns to Message (zero data loss — nullable/defaulted)
ALTER TABLE "Message" ADD COLUMN "senderName" TEXT;
ALTER TABLE "Message" ADD COLUMN "senderId" TEXT;
ALTER TABLE "Message" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;

-- 2. ADD missing index for isRead queries
CREATE INDEX IF NOT EXISTS "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");

-- 3. ADD missing columns to Conversation (zero data loss — nullable)
ALTER TABLE "Conversation" ADD COLUMN "claimedByName" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "needsStaffReason" TEXT;