-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'BOT_DETECTED');

-- CreateEnum
CREATE TYPE "OrderApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "approvalStatus" "OrderApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "Order_approvalStatus_idx" ON "Order"("approvalStatus");
