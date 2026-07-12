-- Optional table for logging model comparison results
-- This is observation-only and does not affect production data

CREATE TABLE IF NOT EXISTS "ModelParseComparisonLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "input_text" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "raw_output" TEXT NOT NULL,
    "parsed_successfully" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ModelParseComparisonLog_model_name_idx" ON "ModelParseComparisonLog"("model_name");
CREATE INDEX IF NOT EXISTS "ModelParseComparisonLog_created_at_idx" ON "ModelParseComparisonLog"("created_at");