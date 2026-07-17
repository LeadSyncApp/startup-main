-- Migration: Add clientMessageId column + partial unique index for idempotency
ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Message_conversationId_clientMessageId_key" ON "Message"("conversationId", "clientMessageId") WHERE "clientMessageId" IS NOT NULL;