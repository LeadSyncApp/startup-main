-- Add reliable identity field for who resolved a conversation
ALTER TABLE "Conversation" ADD COLUMN "resolvedById" TEXT;

-- Activity/history log for conversations
CREATE TYPE "ConversationActivityType" AS ENUM ('ASSIGNED', 'TRANSFERRED', 'RESOLVED', 'REOPENED');

CREATE TABLE "ConversationActivity" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "ConversationActivityType" NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationActivity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConversationActivity_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ConversationActivity_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ConversationActivity_companyId_idx" ON "ConversationActivity"("companyId");
CREATE INDEX "ConversationActivity_conversationId_idx" ON "ConversationActivity"("conversationId");
CREATE INDEX "ConversationActivity_actorId_idx" ON "ConversationActivity"("actorId");