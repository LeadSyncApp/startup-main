-- Migration: fix_knowledgechunk_unique
-- Creates the KnowledgeChunk table with the corrected per-company unique constraint.
-- All statements are additive only — no existing data is altered or dropped.

BEGIN;

-- CreateExtension (idempotent: no-op if already present)
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum (idempotent: no-op if already present)
DO $$ BEGIN
  CREATE TYPE "KnowledgeSourceType" AS ENUM ('RULE', 'PRODUCT', 'POLICY', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "sourceId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(384),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (per-company unique as corrected in schema.prisma)
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_companyId_sourceType_sourceId_key"
    ON "KnowledgeChunk"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_companyId_idx"
    ON "KnowledgeChunk"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_companyId_isActive_idx"
    ON "KnowledgeChunk"("companyId", "isActive");

-- AddForeignKey (idempotent: no-op if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeChunk_companyId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;