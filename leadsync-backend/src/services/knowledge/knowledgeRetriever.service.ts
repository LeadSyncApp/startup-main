/**
 * Knowledge Retriever Service
 *
 * Standalone similarity-search function for retrieving relevant knowledge chunks.
 * Uses pgvector's cosine distance operator (<=>) with normalized embeddings.
 * Never throws - logs errors and returns empty array to protect live message flows.
 */

import { embedText } from "../../utils/embedding";
import { prisma } from "../../lib/prisma";

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
    // Step 1: Embed the message text to get its 384-dim vector
    const embedding = await embedText(messageText);

    // Convert embedding array to PostgreSQL vector literal format
    const embeddingLiteral = `[${embedding.join(",")}]`;

    // Step 2: Query KnowledgeChunk using pgvector's cosine distance operator
    // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite for normalized vectors)
    // We compute similarity as (1 - distance) so scores read intuitively (1.0 = perfect match, 0 = unrelated)
    let rows;
    if (sourceType) {
      rows = await prisma.$queryRaw<
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
      rows = await prisma.$queryRaw<
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

    // Step 3: Convert distance to similarity and sort descending
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
