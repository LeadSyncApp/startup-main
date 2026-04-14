-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('BOT', 'HUMAN');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "mode" "ConversationMode" NOT NULL DEFAULT 'BOT';
