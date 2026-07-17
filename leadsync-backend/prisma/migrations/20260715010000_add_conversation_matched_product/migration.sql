ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "matchedProduct" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "matchedProductAt" TIMESTAMP;
