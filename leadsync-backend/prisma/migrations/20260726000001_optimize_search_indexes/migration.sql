-- Migration: 20260726000001_optimize_search_indexes
-- Fix RAG query performance by:
-- 1. Ensuring HNSW ANN index on embedding exists (recreates if corrupt via concurrent reindex)
-- 2. Ensuring GIN index on contentTsv exists
-- 3. Adding composite B-tree on (companyId, isActive) for fast pre-filtering
-- 4. Updating table statistics so the planner chooses index scans

BEGIN;

-- 1. Ensure HNSW ANN index on vector embedding column
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);

-- 2. Ensure GIN index on tsvector full-text search column
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_contentTsv_idx"
ON "KnowledgeChunk" USING GIN ("contentTsv");

-- 3. Composite B-tree for fast WHERE companyId + isActive filtering
--    (speeds up both vector and FTS queries by reducing rows before the expensive operators)
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_companyId_isActive_idx"
ON "KnowledgeChunk" ("companyId", "isActive");

-- 4. Fresh statistics so the query planner accurately estimates row counts
--    and chooses index scans over sequential scans
ANALYZE "KnowledgeChunk";

COMMIT;
