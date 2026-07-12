/**
 * Rule Embedding Service
 *
 * Handles embedding ConversationalRules into KnowledgeChunk for RAG similarity search.
 * Uses the existing embedText utility with Xenova/multilingual-e5-small.
 */

import { embedText } from "../../utils/embedding";
import { prisma } from "../../lib/prisma";
import { randomUUID } from "crypto";

interface RuleForEmbedding {
  id: string;
  companyId: string;
  name: string;
  triggerKeywords: string[];
  templateBody: string;
}

/**
 * Embed a ConversationalRule into a KnowledgeChunk row.
 * Uses upsert to create or update the KnowledgeChunk.
 * Never throws - logs errors and continues silently.
 */
export async function embedRuleToKnowledgeChunk(rule: RuleForEmbedding): Promise<void> {
  try {
    // Build the text content from rule fields
    const content = `${rule.name} ${rule.triggerKeywords.join(" ")} ${rule.templateBody}`.trim();

    // Generate the embedding
    const embedding = await embedText(content);

    // Convert embedding array to PostgreSQL vector literal format
    const embeddingLiteral = `[${embedding.join(",")}]`;
    const now = new Date();

    // Upsert KnowledgeChunk via raw SQL (Prisma Unsupported type requires it)
    // Generate a UUID for the KnowledgeChunk id
    const kcId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" ("id", "companyId", "sourceType", "sourceId", "content", "embedding", "isActive", "createdAt", "updatedAt")
      VALUES (${kcId}, ${rule.companyId}, 'RULE'::"KnowledgeSourceType", ${rule.id}, ${content}, ${embeddingLiteral}::vector(384), true, ${now}, ${now})
      ON CONFLICT ("companyId", "sourceType", "sourceId")
      DO UPDATE SET
        "content" = ${content},
        "embedding" = ${embeddingLiteral}::vector(384),
        "isActive" = true,
        "updatedAt" = ${now}
    `;
  } catch (err: any) {
    console.error(`[ruleEmbedding] Failed to embed rule ${rule.id}:`, err.message);
    // Do not throw - this must never break rule creation/update
  }
}