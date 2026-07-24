-- Migration: Fix AutoReplyRule schema mismatch
-- Adds the missing `useAI` column that exists in Prisma schema but not in the database
-- Run: psql -f this file against your database

-- Add the missing useAI column to AutoReplyRule
ALTER TABLE "AutoReplyRule" ADD COLUMN IF NOT EXISTS "useAI" BOOLEAN NOT NULL DEFAULT false;

-- Add missing foreign key constraint for AutoReplyLog.ruleId -> AutoReplyRule.id
-- This was missing from the original auto_reply_rules.sql migration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'AutoReplyLog_ruleId_fkey' 
        AND table_name = 'AutoReplyLog'
    ) THEN
        ALTER TABLE "AutoReplyLog" 
        ADD CONSTRAINT "AutoReplyLog_ruleId_fkey" 
        FOREIGN KEY ("ruleId") REFERENCES "AutoReplyRule"("id") ON DELETE SET NULL;
    END IF;
END
$$;