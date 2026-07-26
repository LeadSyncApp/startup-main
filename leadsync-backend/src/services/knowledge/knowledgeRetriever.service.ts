/**
 * Knowledge Retriever Service
 *
 * Standalone similarity-search function for retrieving relevant knowledge chunks.
 * Uses in-memory cache with vector similarity + BM25 FTS when the company's
 * chunk count is within threshold, falling back to direct DB queries otherwise.
 * Never throws - logs errors and returns empty array to protect live message flows.
 */

import { embedText } from "../../utils/embedding";
import { directPrisma } from "../../lib/prisma";
import { stepProfiler } from "../../utils/stepProfiler";
import {
  getOrLoadCache,
  searchVectorInMemory,
  searchFtsInMemory,
  hybridSearchInMemory,
} from "./chunkCache";

export interface RetrievedChunk {
  sourceId: string | null;
  sourceType: string;
  content: string;
  similarity: number;
}

/**
 * Retrieve the top N most similar knowledge chunks for a given message.
 *
 * @param companyId - The company UUID to filter knowledge chunks by
 * @param messageText - The message text to find similar chunks for
 * @param topN - Number of results to return (default: 5)
 * @returns Array of retrieved chunks sorted by similarity descending
 */
export async function retrieveSimilarChunks(
  companyId: string,
  messageText: string,
  topN: number = 5,
  sourceType?: string
): Promise<RetrievedChunk[]> {
  try {
    const embedding = await stepProfiler.time(
      "embedText (Xenova/multilingual-e5-small)",
      "knowledgeRetriever.service.ts:36",
      "In-process compute",
      "ONNX feature-extraction model inference",
      false,
      () => embedText("query: " + messageText)
    );

    // Try in-memory cache first
    const cacheEntry = await getOrLoadCache(companyId);
    if (cacheEntry) {
      const results = searchVectorInMemory(
        companyId,
        new Float32Array(embedding),
        topN,
        sourceType
      );
      return results.map((r) => ({
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        content: r.content,
        similarity: r.similarity,
      }));
    }

    // Fallback: direct DB query
    const embeddingLiteral = `[${embedding.join(",")}]`;

    const rows = await stepProfiler.time(
      "pgvector cosine distance query",
      "knowledgeRetriever.service.ts:46",
      "DB query",
      `SELECT FROM KnowledgeChunk WHERE companyId=${companyId} AND isActive=true ORDER BY embedding <=> vector`,
      false,
      async () => {
        if (sourceType) {
          return await directPrisma.$queryRaw<
            { sourceId: string | null; sourceType: string; content: string; distance: number }[]
          >`
            SELECT
              "sourceId",
              "sourceType",
              "content",
              ("embedding" <=> ${embeddingLiteral}::vector(384)) as distance
            FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId}
              AND "isActive" = true
              AND "sourceType" = ${sourceType}::"KnowledgeSourceType"
            ORDER BY distance ASC
            LIMIT ${topN}
          `;
        } else {
          return await directPrisma.$queryRaw<
            { sourceId: string | null; sourceType: string; content: string; distance: number }[]
          >`
            SELECT
              "sourceId",
              "sourceType",
              "content",
              ("embedding" <=> ${embeddingLiteral}::vector(384)) as distance
            FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId}
              AND "isActive" = true
            ORDER BY distance ASC
            LIMIT ${topN}
          `;
        }
      }
    );

    const results: RetrievedChunk[] = rows
      .map((row) => ({
        sourceId: row.sourceId,
        sourceType: row.sourceType,
        content: row.content,
        similarity: 1 - row.distance,
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  } catch (err: any) {
    console.error("[knowledgeRetriever] Failed to retrieve similar chunks:", err.message);
    return [];
  }
}

/**
 * Retrieve only PRODUCT-type knowledge chunks for a given message.
 * Used for product-only RAG fallback when no conversational rules match.
 * Returns all matching chunks (up to topN) without early filtering - useful for
 * broad queries like "what brands do you have" where multiple products are relevant.
 */
export async function retrieveProductChunks(
  companyId: string,
  messageText: string,
  topN: number = 10
): Promise<RetrievedChunk[]> {
  return retrieveSimilarChunks(companyId, messageText, topN, "PRODUCT");
}

/**
 * Retrieve the top N knowledge chunks matching a full-text search query.
 *
 * Uses in-memory MiniSearch BM25 when the company's chunk count is within
 * threshold, falling back to Postgres tsvector/tsquery otherwise.
 * Same companyId + isActive scoping and optional sourceType filter as vector search.
 * Never throws — logs errors and returns empty array.
 *
 * @param companyId - The company UUID to filter knowledge chunks by
 * @param queryText - The natural-language search query
 * @param sourceType - Optional sourceType filter (e.g. "PRODUCT", "RULE")
 * @param topN - Maximum results to return (default: 20 — FTS is cheap, wider net is fine)
 */
export async function searchByFullText(
  companyId: string,
  queryText: string,
  sourceType?: string,
  topN: number = 20
): Promise<RetrievedChunk[]> {
  try {
    // Try in-memory cache first
    const cacheEntry = await getOrLoadCache(companyId);
    if (cacheEntry) {
      const results = searchFtsInMemory(companyId, queryText, topN, sourceType);
      return results.map((r) => ({
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        content: r.content,
        similarity: r.score,
      }));
    }

    // Fallback: direct DB query
    const rows = await stepProfiler.time(
      "Postgres tsvector FTS query",
      "knowledgeRetriever.service.ts:133",
      "DB query",
      `SELECT FROM KnowledgeChunk WHERE companyId=${companyId} AND contentTsv @@ websearch_to_tsquery`,
      false,
      async () => {
        if (sourceType) {
          return await directPrisma.$queryRaw<
            { sourceId: string | null; sourceType: string; content: string; rank: number }[]
          >`
            SELECT
              "id",
              "sourceId",
              "sourceType",
              "content",
              ts_rank("contentTsv", websearch_to_tsquery('english', ${queryText})) AS rank
            FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId}
              AND "isActive" = true
              AND "contentTsv" @@ websearch_to_tsquery('english', ${queryText})
              AND "sourceType" = ${sourceType}::"KnowledgeSourceType"
            ORDER BY rank DESC
            LIMIT ${topN}
          `;
        } else {
          return await directPrisma.$queryRaw<
            { sourceId: string | null; sourceType: string; content: string; rank: number }[]
          >`
            SELECT
              "id",
              "sourceId",
              "sourceType",
              "content",
              ts_rank("contentTsv", websearch_to_tsquery('english', ${queryText})) AS rank
            FROM "KnowledgeChunk"
            WHERE "companyId" = ${companyId}
              AND "isActive" = true
              AND "contentTsv" @@ websearch_to_tsquery('english', ${queryText})
            ORDER BY rank DESC
            LIMIT ${topN}
          `;
        }
      }
    );

    const results: RetrievedChunk[] = rows
      .map((row) => ({
        sourceId: row.sourceId,
        sourceType: row.sourceType,
        content: row.content,
        similarity: row.rank,
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  } catch (err: any) {
    console.error("[knowledgeRetriever] Full-text search failed:", err.message);
    return [];
  }
}

/**
 * Hybrid search: merge vector similarity and full-text search via Reciprocal Rank
 * Fusion (RRF). Uses in-memory cache when available, falls back to DB otherwise.
 *
 * RRF formula: for each chunk id appearing in either list,
 *   rrf_score = (1 / (k + vector_rank)) + (1 / (k + fts_rank))
 * where k=60 (standard constant) and rank is 0-indexed position.
 * A chunk absent from one list simply gets no contribution from that term.
 *
 * Returns the same RetrievedChunk[] shape as sibling functions, with an
 * additional `rrf_score` field for debugging/observability.
 *
 * @param companyId - The company UUID to filter knowledge chunks by
 * @param queryText - The natural-language search query
 * @param sourceType - Optional sourceType filter (e.g. "PRODUCT", "RULE")
 * @param topN - Final number of results to return after merging (default: 10)
 */
export async function hybridSearch(
  companyId: string,
  queryText: string,
  sourceType?: string,
  topN: number = 10
): Promise<(RetrievedChunk & { rrf_score: number })[]> {
  const RRF_K = 60;

  try {
    // Try in-memory hybrid search first
    const cacheEntry = await getOrLoadCache(companyId);
    if (cacheEntry) {
      // Need the query embedding for vector search
      const embedding = await stepProfiler.time(
        "embedText (Xenova/multilingual-e5-small) for hybrid",
        "knowledgeRetriever.service.ts:hybrid-cache",
        "In-process compute",
        "ONNX feature-extraction model inference for hybrid search",
        false,
        () => embedText("query: " + queryText)
      );

      const inMemoryResults = hybridSearchInMemory(
        companyId,
        queryText,
        new Float32Array(embedding),
        topN,
        sourceType
      );

      return inMemoryResults.map((r) => ({
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        content: r.content,
        similarity: r.similarity,
        rrf_score: r.rrf_score,
      }));
    }

    // Fallback: DB-based hybrid search
    const [vectorResults, ftsResults] = await Promise.all([
      retrieveSimilarChunks(companyId, queryText, 30, sourceType),
      searchByFullText(companyId, queryText, sourceType, 30),
    ]);

    // Build RRF scores — rank is 0-indexed position in each result list
    const rrfScores = new Map<string, { rrf_score: number; chunk: RetrievedChunk }>();

    for (let rank = 0; rank < vectorResults.length; rank++) {
      const chunk = vectorResults[rank];
      const key = chunk.sourceId ?? chunk.content;
      const existing = rrfScores.get(key);
      const contribution = 1 / (RRF_K + rank);
      if (existing) {
        existing.rrf_score += contribution;
      } else {
        rrfScores.set(key, { rrf_score: contribution, chunk });
      }
    }

    for (let rank = 0; rank < ftsResults.length; rank++) {
      const chunk = ftsResults[rank];
      const key = chunk.sourceId ?? chunk.content;
      const existing = rrfScores.get(key);
      const contribution = 1 / (RRF_K + rank);
      if (existing) {
        existing.rrf_score += contribution;
      } else {
        rrfScores.set(key, { rrf_score: contribution, chunk });
      }
    }

    // Sort by RRF score descending, return topN
    const merged = Array.from(rrfScores.values())
      .sort((a, b) => b.rrf_score - a.rrf_score)
      .slice(0, topN)
      .map(({ rrf_score, chunk }) => ({ ...chunk, rrf_score }));

    return merged;
  } catch (err: any) {
    console.error("[knowledgeRetriever] Hybrid search failed:", err.message);
    return [];
  }
}
