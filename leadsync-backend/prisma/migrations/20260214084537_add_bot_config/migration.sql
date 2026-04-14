-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "botBusinessType" TEXT,
ADD COLUMN     "botMenu" JSONB,
ADD COLUMN     "botWelcomeMessage" TEXT;
