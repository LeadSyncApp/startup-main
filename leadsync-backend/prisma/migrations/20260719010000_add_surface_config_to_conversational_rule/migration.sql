-- Migration: add_surface_config_to_conversational_rule
-- Captures the intentional drift between the live dev database and schema.prisma:
--   1. Drops the already-removed AutoReplyRule / AutoReplyLog models (orphan tables
--      still present in the DB; their removal was never previously migrated).
--   2. Adds surfaceConfig (Json) + eventConfig (Json) to ConversationalRule.
--   3. Sets the triggerType column default to 'TEXT_MATCH'.
--   4. Adds the ConversationalRule_triggerType_idx index.
-- NOTE: The separate orphan "TelegramLease" table is intentionally NOT dropped here;
-- it is out of scope for this change and is tracked as a follow-up cleanup.

-- 1a. Drop foreign keys referencing the soon-to-be-dropped tables
ALTER TABLE "AutoReplyLog" DROP CONSTRAINT IF EXISTS "AutoReplyLog_companyId_fkey";
ALTER TABLE "AutoReplyLog" DROP CONSTRAINT IF EXISTS "AutoReplyLog_ruleId_fkey";
ALTER TABLE "AutoReplyRule" DROP CONSTRAINT IF EXISTS "AutoReplyRule_companyId_fkey";

-- 1b. Drop the removed AutoReply models
DROP TABLE IF EXISTS "AutoReplyLog";
DROP TABLE IF EXISTS "AutoReplyRule";

-- 2. Surface configuration fields on ConversationalRule
ALTER TABLE "ConversationalRule"
  ADD COLUMN IF NOT EXISTS "surfaceConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "eventConfig" JSONB;

-- 3. Default triggerType to TEXT_MATCH (new canonical default)
ALTER TABLE "ConversationalRule" ALTER COLUMN "triggerType" SET DEFAULT 'TEXT_MATCH';

-- 4. Index for triggerType-based rule lookups
CREATE INDEX IF NOT EXISTS "ConversationalRule_triggerType_idx" ON "ConversationalRule"("triggerType");
