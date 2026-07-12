-- Split timeRange into hourRange (hour-of-day) and dateRange (day-of-month)
-- Add new columns for hourRange and dateRange
ALTER TABLE "ConversationalRule" 
ADD COLUMN "hourRange" JSONB,
ADD COLUMN "dateRange" JSONB;

-- Create index for faster condition queries
CREATE INDEX "ConversationalRule_hourRange_idx" ON "ConversationalRule" USING GIN ("hourRange");
CREATE INDEX "ConversationalRule_dateRange_idx" ON "ConversationalRule" USING GIN ("dateRange");

-- Drop the old timeRange column (note: data migration handled separately)
-- Note: We keep conditions JSON for backward compatibility but add dedicated columns