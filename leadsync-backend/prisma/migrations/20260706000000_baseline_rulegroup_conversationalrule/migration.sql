-- CreateTable
CREATE TABLE "RuleGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'AI_INSTRUCTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationalRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerType" TEXT NOT NULL DEFAULT 'KEYWORD',
    "conditions" JSONB,
    "templateBody" TEXT NOT NULL DEFAULT '',
    "useAI" BOOLEAN NOT NULL DEFAULT false,
    "brandVoice" TEXT DEFAULT 'friendly',
    "targetLanguage" TEXT DEFAULT 'auto',
    "sourcePrompt" TEXT,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "ConversationalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationalRuleLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "conversationId" TEXT,
    "leadId" TEXT,
    "inboundText" TEXT NOT NULL,
    "responseSent" TEXT,
    "matchedKeyword" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationalRuleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RuleGroup_companyId_idx" ON "RuleGroup"("companyId");
CREATE INDEX "RuleGroup_companyId_type_idx" ON "RuleGroup"("companyId", "type");
CREATE UNIQUE INDEX "RuleGroup_companyId_name_key" ON "RuleGroup"("companyId", "name");

CREATE INDEX "ConversationalRule_companyId_idx" ON "ConversationalRule"("companyId");
CREATE INDEX "ConversationalRule_companyId_isEnabled_idx" ON "ConversationalRule"("companyId", "isEnabled");
CREATE INDEX "ConversationalRule_triggerKeywords_idx" ON "ConversationalRule"("triggerKeywords");
CREATE INDEX "ConversationalRule_groupId_idx" ON "ConversationalRule"("groupId");

CREATE INDEX "ConversationalRuleLog_companyId_idx" ON "ConversationalRuleLog"("companyId");
CREATE INDEX "ConversationalRuleLog_ruleId_idx" ON "ConversationalRuleLog"("ruleId");
CREATE INDEX "ConversationalRuleLog_createdAt_idx" ON "ConversationalRuleLog"("createdAt");
CREATE INDEX "ConversationalRuleLog_status_idx" ON "ConversationalRuleLog"("status");

-- AddForeignKey
ALTER TABLE "RuleGroup" ADD CONSTRAINT "RuleGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationalRule" ADD CONSTRAINT "ConversationalRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationalRule" ADD CONSTRAINT "ConversationalRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationalRuleLog" ADD CONSTRAINT "ConversationalRuleLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationalRuleLog" ADD CONSTRAINT "ConversationalRuleLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ConversationalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;