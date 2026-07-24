-- KnowledgeChunk: add hybrid search infrastructure (additive, non-destructive)
-- 1. Generated tsvector column for Postgres full-text search on `content`
-- 2. GIN index on the tsvector column for fast tsquery lookups
-- 3. HNSW ANN index on the existing embedding vector column (was unindexed, full seq-scan before)

ALTER TABLE "KnowledgeChunk"
ADD COLUMN "contentTsv" tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX "KnowledgeChunk_contentTsv_idx"
ON "KnowledgeChunk" USING GIN ("contentTsv");

CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
