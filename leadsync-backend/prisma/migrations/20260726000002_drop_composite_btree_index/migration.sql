-- Migration: 20260726000002_drop_composite_btree_index
-- Problem: The B-tree index on (companyId, isActive) causes the planner to
-- skip the HNSW ANN index for vector queries. For companies with many chunks
-- (1000+), this means computing distances for ALL matching rows instead of
-- using the approximate nearest neighbor index — a catastrophic plan choice.
--
-- The lesson from the previous migration (optimize_search_indexes) was that
-- indexes designed for relational lookups actively harm ANN queries.
-- pgvector's HNSW index already handles the multi-tenant case correctly:
-- it finds approximate nearest neighbors globally, and the WHERE clause
-- filters to the target company. For small companies (<100 chunks) this
-- is indistinguishable from a seq scan; for large ones it's orders of
-- magnitude faster.
--
-- The GIN index on contentTsv and the HNSW index on embedding remain.

BEGIN;

DROP INDEX IF EXISTS "KnowledgeChunk_companyId_isActive_idx";

-- Re-run ANALYZE now that the misleading index is gone
ANALYZE "KnowledgeChunk";

COMMIT;
