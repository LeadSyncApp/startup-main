-- CreateEnum
CREATE TYPE "PendingOrderState" AS ENUM ('NONE', 'PENDING_APPROVAL', 'CLAIMED_FOR_APPROVAL');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "pendingOrderState" "PendingOrderState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "pendingOrderId" TEXT,
ADD COLUMN     "pendingOrderClaimedById" TEXT,
ADD COLUMN     "pendingOrderClaimedAt" TIMESTAMP(3),
ADD COLUMN     "pendingOrderSummary" TEXT,
ADD COLUMN     "pendingOrderAmount" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Lead_pendingOrderState_idx" ON "Lead"("pendingOrderState");

-- CreateIndex
CREATE INDEX "Lead_pendingOrderClaimedById_idx" ON "Lead"("pendingOrderClaimedById");
