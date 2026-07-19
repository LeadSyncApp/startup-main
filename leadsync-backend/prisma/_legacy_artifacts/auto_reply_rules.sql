-- Migration: Add AutoReplyRule and AutoReplyLog models
-- Run: npx prisma migrate dev --name add_auto_reply

-- New model: AutoReplyRule
-- One per company per eventKey (e.g., "order.confirmed", "lead.welcome")
CREATE TABLE "AutoReplyRule" (
    "id"            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"     TEXT        NOT NULL,
    "eventKey"      TEXT        NOT NULL, -- "order.placed" | "order.confirmed" | "order.ready" | "order.delivered" | "lead.welcome" | "lead.followup" | "lead.cold_recovery"
    "isEnabled"     BOOLEAN     NOT NULL DEFAULT true,
    "messageBody"   TEXT        NOT NULL,
    "delayMinutes"  INTEGER     NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "AutoReplyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
    CONSTRAINT "AutoReplyRule_companyId_eventKey_key" UNIQUE ("companyId", "eventKey")
);

CREATE INDEX "AutoReplyRule_companyId_idx" ON "AutoReplyRule"("companyId");
CREATE INDEX "AutoReplyRule_eventKey_idx" ON "AutoReplyRule"("eventKey");
CREATE INDEX "AutoReplyRule_isEnabled_idx" ON "AutoReplyRule"("isEnabled");

-- New model: AutoReplyLog
-- Audit trail for every auto-reply sent
CREATE TABLE "AutoReplyLog" (
    "id"            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"     TEXT        NOT NULL,
    "ruleId"        TEXT,
    "eventKey"      TEXT        NOT NULL,
    "triggeredFor"  TEXT        NOT NULL, -- leadId or conversationId
    "recipient"     TEXT        NOT NULL, -- phone/contact
    "channel"       TEXT        NOT NULL, -- TELEGRAM | WHATSAPP | INSTAGRAM
    "messageBody"   TEXT        NOT NULL,
    "status"        TEXT        NOT NULL DEFAULT 'SENT', -- SENT | FAILED
    "error"         TEXT,
    "sentAt"        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoReplyLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE INDEX "AutoReplyLog_companyId_idx" ON "AutoReplyLog"("companyId");
CREATE INDEX "AutoReplyLog_ruleId_idx" ON "AutoReplyLog"("ruleId");
CREATE INDEX "AutoReplyLog_sentAt_idx" ON "AutoReplyLog"("sentAt");
CREATE INDEX "AutoReplyLog_status_idx" ON "AutoReplyLog"("status");