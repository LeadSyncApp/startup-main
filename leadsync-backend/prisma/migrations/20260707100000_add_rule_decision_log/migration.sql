-- CreateRuleDecisionLog table for observability
CREATE TABLE "RuleDecisionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageText" TEXT NOT NULL,
    "topScore" DOUBLE PRECISION,
    "secondScore" DOUBLE PRECISION,
    "gap" DOUBLE PRECISION,
    "pathTaken" TEXT NOT NULL,
    "matchedRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleDecisionLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "RuleDecisionLog_companyId_idx" ON "RuleDecisionLog"("companyId");
CREATE INDEX "RuleDecisionLog_companyId_pathTaken_idx" ON "RuleDecisionLog"("companyId", "pathTaken");
CREATE INDEX "RuleDecisionLog_matchedRuleId_idx" ON "RuleDecisionLog"("matchedRuleId");
CREATE INDEX "RuleDecisionLog_createdAt_idx" ON "RuleDecisionLog"("createdAt");

-- Add foreign key constraints (referential integrity)
ALTER TABLE "RuleDecisionLog" 
ADD CONSTRAINT "RuleDecisionLog_companyId_fkey" 
FOREIGN KEY ("companyId") 
REFERENCES "Company"("id") 
ON DELETE CASCADE;

ALTER TABLE "RuleDecisionLog" 
ADD CONSTRAINT "RuleDecisionLog_conversationId_fkey" 
FOREIGN KEY ("conversationId") 
REFERENCES "Conversation"("id") 
ON DELETE SET NULL;

ALTER TABLE "RuleDecisionLog" 
ADD CONSTRAINT "RuleDecisionLog_matchedRuleId_fkey" 
FOREIGN KEY ("matchedRuleId") 
REFERENCES "ConversationalRule"("id") 
ON DELETE SET NULL;