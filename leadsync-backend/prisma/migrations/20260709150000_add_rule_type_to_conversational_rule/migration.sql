-- Migration: Add ruleType to ConversationalRule
-- Type 1: Canned reply (existing confident_match behavior)
-- Type 2: Otto Query with RAG context
-- Type 3: Otto Query with product catalog

ALTER TABLE "ConversationalRule" ADD COLUMN "ruleType" INTEGER NOT NULL DEFAULT 1;

-- Backfill default values for existing rules
-- (All existing rules will default to Type 1 - canned reply behavior)

-- Create index for ruleType queries
CREATE INDEX "ConversationalRule_companyId_ruleType_idx" ON "ConversationalRule"("companyId", "ruleType");