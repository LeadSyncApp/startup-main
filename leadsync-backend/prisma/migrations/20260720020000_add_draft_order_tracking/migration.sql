-- CreateEnum
CREATE TYPE "DraftOrderStatus" AS ENUM ('DRAFTING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'ABANDONED');

-- CreateTable
CREATE TABLE "DraftOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "leadId" TEXT,
    "items" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "DraftOrderStatus" NOT NULL DEFAULT 'DRAFTING',
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "shippingAddress" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftOrder_companyId_idx" ON "DraftOrder"("companyId");

-- CreateIndex
CREATE INDEX "DraftOrder_conversationId_idx" ON "DraftOrder"("conversationId");

-- CreateIndex
CREATE INDEX "DraftOrder_conversationId_status_idx" ON "DraftOrder"("conversationId", "status");

-- CreateIndex
CREATE INDEX "DraftOrder_updatedAt_idx" ON "DraftOrder"("updatedAt");

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
