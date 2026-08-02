ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_resetTokenHash_key" ON "User"("resetTokenHash") WHERE "resetTokenHash" IS NOT NULL;
