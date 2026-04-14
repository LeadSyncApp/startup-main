/*
  Warnings:

  - A unique constraint covering the columns `[instagramPageId]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CLAIMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadSegment" AS ENUM ('NEW', 'REGULAR', 'VIP', 'CHURN_RISK');

-- CreateEnum
CREATE TYPE "ConversationIntent" AS ENUM ('BROWSING', 'ORDERING', 'SUPPORT', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'SNOOZED');

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'INSTAGRAM';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'BOT_CREATED_ORDER';
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING';
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE 'ARCHIVED';

-- DropIndex
DROP INDEX "Conversation_companyId_idx";

-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "botKnowledgeBase" TEXT,
ADD COLUMN "botLearnedContext" TEXT,
ADD COLUMN "botPolicies" TEXT DEFAULT '',
ADD COLUMN "businessAddress" TEXT,
ADD COLUMN "businessName" TEXT,
ADD COLUMN "gstin" TEXT,
ADD COLUMN "instagramConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "instagramPageAccessToken" TEXT,
ADD COLUMN "instagramPageId" TEXT,
ADD COLUMN "invoiceCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "aiHandled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "aiSummary" TEXT,
ADD COLUMN "aiSummaryAt" TIMESTAMP(3),
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "intent" "ConversationIntent",
ADD COLUMN "priorityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sentimentScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sessionState" JSONB,
ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "summary" TEXT;

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "orderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "segment" "LeadSegment" NOT NULL DEFAULT 'NEW',
ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "items" JSONB,
ADD COLUMN "predictedValue" DOUBLE PRECISION,
ADD COLUMN "priorityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "staffId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentStatus" TEXT NOT NULL,
    "paymentProvider" TEXT NOT NULL DEFAULT 'razorpay',
    "paymentRef" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "targetSegment" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotKnowledge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FAQ',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "triggerDelayMinutes" INTEGER NOT NULL DEFAULT 1440,
    "action" TEXT NOT NULL,
    "actionPayload" JSONB,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "triggeredFor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentionedIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Broadcast_companyId_idx" ON "Broadcast"("companyId");

-- CreateIndex
CREATE INDEX "Broadcast_createdAt_idx" ON "Broadcast"("createdAt");

-- CreateIndex
CREATE INDEX "OrderLog_orderId_idx" ON "OrderLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderLog_timestamp_idx" ON "OrderLog"("timestamp");

-- CreateIndex
CREATE INDEX "BotKnowledge_companyId_idx" ON "BotKnowledge"("companyId");

-- CreateIndex
CREATE INDEX "BotKnowledge_companyId_isActive_idx" ON "BotKnowledge"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_idx" ON "AutomationRule"("companyId");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_isActive_idx" ON "AutomationRule"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationLog_ruleId_idx" ON "AutomationLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationLog_companyId_idx" ON "AutomationLog"("companyId");

-- CreateIndex
CREATE INDEX "InternalNote_conversationId_idx" ON "InternalNote"("conversationId");

-- CreateIndex
CREATE INDEX "InternalNote_companyId_idx" ON "InternalNote"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_instagramPageId_key" ON "Company"("instagramPageId");

-- CreateIndex
CREATE INDEX "Conversation_companyId_updatedAt_idx" ON "Conversation"("companyId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Conversation_sentimentScore_idx" ON "Conversation"("sentimentScore");

-- CreateIndex
CREATE INDEX "Conversation_assignedToId_idx" ON "Conversation"("assignedToId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_priorityScore_idx" ON "Conversation"("priorityScore");

-- CreateIndex
CREATE INDEX "Lead_totalSpend_idx" ON "Lead"("totalSpend");

-- CreateIndex
CREATE INDEX "Lead_lastActiveAt_idx" ON "Lead"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_companyId_approvalStatus_idx" ON "Order"("companyId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- CreateIndex
CREATE INDEX "Order_companyId_source_idx" ON "Order"("companyId", "source");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_priorityScore_idx" ON "Order"("priorityScore");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "Order_isDeleted_idx" ON "Order"("isDeleted");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLog" ADD CONSTRAINT "OrderLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotKnowledge" ADD CONSTRAINT "BotKnowledge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;