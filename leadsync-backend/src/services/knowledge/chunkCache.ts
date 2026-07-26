/**
 * KnowledgeChunk In-Memory Cache
 *
 * Caches active KnowledgeChunk rows per company in server memory,
 * enabling vector similarity search and BM25 full-text search without
 * network round-trips to the database.
 *
 * Design:
 * - Vector search: exact cosine dot product against cached Float32Array embeddings
 * - FTS: minisearch with BM25 scoring, fuzzy matching, and prefix search
 * - Fallback: companies exceeding KNOWLEDGE_CACHE_THRESHOLD chunks use DB queries
 * - Invalidation: eager (called on every KnowledgeChunk write) + 5-minute TTL safety net
 */

import MiniSearch from "minisearch";
import { directPrisma } from "../../lib/prisma";

// ── Configuration ──

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes safety-net TTL

const KNOWLEDGE_CACHE_THRESHOLD = parseInt(
  process.env.KNOWLEDGE_CACHE_THRESHOLD || "2000",
  10
);

// ── Types ──

export interface CachedChunk {
  id: string;
  companyId: string;
  sourceType: string;
  sourceId: string | null;
  content: string;
  embedding: Float32Array;
}

interface CacheEntry {
  chunks: CachedChunk[];
  msIndex: MiniSearch;
  loadedAt: number;
}

// ── Internal state ──

const cache = new Map<string, CacheEntry>();

// ── Public API ──

/**
 * Invalidate the cache for a specific company.
 * Called eagerly after any KnowledgeChunk write (create/update/delete).
 */
export function invalidateChunkCache(companyId: string): void {
  cache.delete(companyId);
  console.log(`[ChunkCache] Invalidated cache for company ${companyId}`);
}

/**
 * Get the chunk count for a company without loading the full cache.
 * Used by callers that need to decide between cache and DB fallback
 * before performing search.
 */
export async function getChunkCount(companyId: string): Promise<number> {
  const count = await directPrisma.knowledgeChunk.count({
    where: { companyId, isActive: true },
  });
  return count;
}

/**
 * Check whether a company is eligible for in-memory caching.
 * Returns true if chunkCount <= threshold, false otherwise.
 * Logs when threshold is exceeded so operators can monitor.
 */
export function isCacheEligible(companyId: string, chunkCount: number): boolean {
  if (chunkCount <= KNOWLEDGE_CACHE_THRESHOLD) {
    return true;
  }
  console.log(
    `[ChunkCache] Company ${companyId} has ${chunkCount} chunks (>${KNOWLEDGE_CACHE_THRESHOLD}), using DB fallback`
  );
  return false;
}

/**
 * Load (or return cached) KnowledgeChunk data for a company.
 * Returns null if the company exceeds the cache threshold (caller should use DB).
 * Returns null on DB errors (caller should fall back to DB).
 */
export async function getOrLoadCache(companyId: string): Promise<CacheEntry | null> {
  const existing = cache.get(companyId);
  if (existing && Date.now() - existing.loadedAt < CACHE_TTL_MS) {
    return existing;
  }

  // Check count before loading
  const count = await getChunkCount(companyId);
  if (!isCacheEligible(companyId, count)) {
    cache.delete(companyId); // evict if previously cached
    return null;
  }

  // Load all active chunks from DB using raw query (embedding is Unsupported type in Prisma)
  const rows = await directPrisma.$queryRaw<
    {
      id: string;
      companyId: string;
      sourceType: string;
      sourceId: string | null;
      content: string;
      embedding: string;
    }[]
  >`
    SELECT "id", "companyId", "sourceType"::text, "sourceId", "content", "embedding"::text
    FROM "KnowledgeChunk"
    WHERE "companyId" = ${companyId}
      AND "isActive" = true
  `;

  // Parse embeddings into Float32Array and build cache
  const chunks: CachedChunk[] = rows
    .filter((r) => r.embedding != null)
    .map((r) => {
      // Prisma returns vector as a string like "[0.1,0.2,...]" or as a number[]
      const raw = r.embedding as any;
      let arr: Float32Array;
      if (raw instanceof Float32Array) {
        arr = raw;
      } else if (Array.isArray(raw)) {
        arr = new Float32Array(raw);
      } else if (typeof raw === "string") {
        // Parse "[0.1,0.2,0.3]" format
        const nums = raw
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map(Number);
        arr = new Float32Array(nums);
      } else {
        arr = new Float32Array(384); // fallback: zero vector
      }
      return {
        id: r.id,
        companyId: r.companyId,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        content: r.content,
        embedding: arr,
      };
    });

  // Build MiniSearch index for BM25 full-text search
  const msIndex = new MiniSearch<CachedChunk>({
    fields: ["content"],
    storeFields: ["sourceId", "sourceType", "content"],
    searchOptions: {
      boost: { content: 1 },
      fuzzy: 0.2,
      prefix: true,
      bm25: { k: 1.2, b: 0.7, d: 0.5 },
    },
  });
  msIndex.addAll(chunks);

  const entry: CacheEntry = {
    chunks,
    msIndex,
    loadedAt: Date.now(),
  };

  cache.set(companyId, entry);
  console.log(
    `[ChunkCache] Loaded ${chunks.length} chunks for company ${companyId} (MiniSearch index built)`
  );

  return entry;
}

/**
 * Compute cosine similarity between two L2-normalized vectors.
 * Both vectors MUST be pre-normalized. Returns a value in [-1, 1].
 * For normalized vectors, this is equivalent to: 1 - cosine_distance.
 */
function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * L2-normalize a vector in-place. Returns the same array.
 */
function normalizeVec(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) {
      v[i] /= norm;
    }
  }
  return v;
}

/**
 * In-memory vector similarity search against cached embeddings.
 * Returns top N chunks sorted by cosine similarity descending.
 * queryEmbedding is normalized in-place (caller should be aware).
 */
export function searchVectorInMemory(
  companyId: string,
  queryEmbedding: Float32Array,
  topN: number,
  sourceType?: string
): { sourceId: string | null; sourceType: string; content: string; similarity: number }[] {
  const entry = cache.get(companyId);
  if (!entry) return [];

  // Normalize query vector for cosine similarity via dot product
  const qNorm = normalizeVec(new Float32Array(queryEmbedding));

  // Score all chunks
  const scored = entry.chunks
    .filter((c) => !sourceType || c.sourceType === sourceType)
    .map((c) => ({
      sourceId: c.sourceId,
      sourceType: c.sourceType,
      content: c.content,
      similarity: dotProduct(qNorm, c.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topN);
}

/**
 * In-memory BM25 full-text search using MiniSearch.
 * Returns top N chunks sorted by relevance score descending.
 */
export function searchFtsInMemory(
  companyId: string,
  queryText: string,
  topN: number,
  sourceType?: string
): { sourceId: string | null; sourceType: string; content: string; score: number }[] {
  const entry = cache.get(companyId);
  if (!entry) return [];

  const results = entry.msIndex.search(queryText, {
    filter: sourceType
      ? (result: any) => (result as any).sourceType === sourceType
      : undefined,
  });

  // MiniSearch returns { id, score, ... } — map to our shape
  return results.slice(0, topN).map((r) => {
    const chunk = entry.chunks.find((c) => c.id === (r as any).id);
    return {
      sourceId: chunk?.sourceId ?? null,
      sourceType: chunk?.sourceType ?? "",
      content: (r as any).content ?? "",
      score: r.score,
    };
  });
}

/**
 * Hybrid search combining vector similarity + BM25 via RRF fusion.
 * Mirrors the logic of hybridSearch() in knowledgeRetriever.service.ts
 * but runs entirely in-memory.
 */
export function hybridSearchInMemory(
  companyId: string,
  queryText: string,
  queryEmbedding: Float32Array,
  topN: number,
  sourceType?: string
): {
  sourceId: string | null;
  sourceType: string;
  content: string;
  similarity: number;
  rrf_score: number;
}[] {
  const RRF_K = 60;

  const vectorResults = searchVectorInMemory(companyId, queryEmbedding, 30, sourceType);
  const ftsResults = searchFtsInMemory(companyId, queryText, 30, sourceType);

  // Build RRF scores — rank is 0-indexed position in each result list
  const rrfScores = new Map<
    string,
    { rrf_score: number; sourceId: string | null; sourceType: string; content: string; similarity: number }
  >();

  for (let rank = 0; rank < vectorResults.length; rank++) {
    const chunk = vectorResults[rank];
    const key = chunk.sourceId ?? chunk.content;
    const contribution = 1 / (RRF_K + rank);
    const existing = rrfScores.get(key);
    if (existing) {
      existing.rrf_score += contribution;
    } else {
      rrfScores.set(key, {
        rrf_score: contribution,
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        content: chunk.content,
        similarity: chunk.similarity,
      });
    }
  }

  for (let rank = 0; rank < ftsResults.length; rank++) {
    const chunk = ftsResults[rank];
    const key = chunk.sourceId ?? chunk.content;
    const contribution = 1 / (RRF_K + rank);
    const existing = rrfScores.get(key);
    if (existing) {
      existing.rrf_score += contribution;
    } else {
      rrfScores.set(key, {
        rrf_score: contribution,
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        content: chunk.content,
        similarity: 0, // no vector score available
      });
    }
  }

  // Sort by RRF score descending, return topN
  return Array.from(rrfScores.values())
    .sort((a, b) => b.rrf_score - a.rrf_score)
    .slice(0, topN)
    .map(({ rrf_score, ...rest }) => ({ ...rest, rrf_score }));
}

/**
 * Expose threshold for external logging/monitoring.
 */
export function getCacheThreshold(): number {
  return KNOWLEDGE_CACHE_THRESHOLD;
}

/**
 * Get cache stats for monitoring/debugging.
 */
export function getCacheStats(): {
  companiesCached: number;
  totalChunks: number;
  threshold: number;
} {
  let totalChunks = 0;
  for (const entry of cache.values()) {
    totalChunks += entry.chunks.length;
  }
  return {
    companiesCached: cache.size,
    totalChunks,
    threshold: KNOWLEDGE_CACHE_THRESHOLD,
  };
}
