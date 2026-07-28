-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "firstStaffReplyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClaimLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
