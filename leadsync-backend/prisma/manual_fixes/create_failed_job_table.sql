CREATE TABLE IF NOT EXISTS "FailedJob" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "queue" TEXT NOT NULL,
  "jobId" TEXT,
  "payload" JSONB NOT NULL,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "companyId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "reprocessedAt" TIMESTAMPTZ(6),
  CONSTRAINT "FailedJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FailedJob_queue_idx" ON "FailedJob"("queue");
CREATE INDEX IF NOT EXISTS "FailedJob_companyId_idx" ON "FailedJob"("companyId");
CREATE INDEX IF NOT EXISTS "FailedJob_createdAt_idx" ON "FailedJob"("createdAt");
