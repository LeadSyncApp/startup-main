-- Add dedupKey column for webhook deduplication (content + time-bucket hash)
ALTER TABLE "Message" ADD COLUMN "dedupKey" TEXT;
CREATE UNIQUE INDEX "Message_dedupKey_key" ON "Message"("dedupKey");