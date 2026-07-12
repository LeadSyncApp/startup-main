/**
 * Inventory Parsing Service
 * 
 * POST /companies/:id/inventory/parse - Groq-based product parsing, no persistence
 * POST /companies/:id/inventory/confirm - Persist confirmed products to KnowledgeChunk
 */

import Groq from "groq-sdk";
import { prisma } from "../../lib/prisma";
import { embedText } from "../../utils/embedding";
import { PRODUCT_PARSING_PROMPT } from "../ai/modelComparison.service";
import { normalizeProductsArray, ProductData, ParsedData } from "../ai/numeralConverter";
import { randomUUID } from "crypto";

// Re-export for use in routes
export { PRODUCT_PARSING_PROMPT };
export type { ProductData, ParsedData };

/**
 * Parse inventory text into structured products using Groq
 * Does NOT persist - returns structured data only
 */
export async function parseInventoryText(
  companyId: string,
  ownerText: string
): Promise<ParsedData> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const groq = new Groq({ apiKey: groqApiKey });

  try {
    const userPrompt = PRODUCT_PARSING_PROMPT.replace("{{OWNER_TEXT}}", ownerText);

    const result = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Return ONLY valid JSON matching the schema. No explanations, no markdown." },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawOutput = result.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawOutput) as ParsedData;

    // Apply post-processing normalization
    const normalizedParsed: ParsedData = {
      ...parsed,
      products: normalizeProductsArray(parsed.products)
    };

    return normalizedParsed;
  } catch (error: any) {
    console.error("[InventoryService] Parse failed:", error.message);
    throw error;
  }
}

/**
 * Persist confirmed products to KnowledgeChunk
 * Uses replace-and-regenerate per product
 * Uses raw SQL for embedding column (Prisma Unsupported type requires it)
 */
export async function confirmInventoryProducts(
  companyId: string,
  products: ProductData[]
): Promise<{ count: number; ids: string[] }> {
  const createdIds: string[] = [];

  for (const product of products) {
    const content = formatProductForKnowledgeChunk(product);

    // Generate embedding
    const embedding = await embedText(content);

    // Convert embedding array to PostgreSQL vector literal format
    const embeddingLiteral = `[${embedding.join(",")}]`;
    const now = new Date();

    // Generate sourceId: use SKU if provided, otherwise create deterministic signature
    const sourceId = product.sku || generateProductSignature(product);

    // Upsert KnowledgeChunk via raw SQL (Prisma Unsupported type requires it)
    // Generate a UUID for the KnowledgeChunk id
    const kcId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" ("id", "companyId", "sourceType", "sourceId", "content", "embedding", "isActive", "createdAt", "updatedAt")
      VALUES (${kcId}, ${companyId}, 'PRODUCT'::"KnowledgeSourceType", ${sourceId}, ${content}, ${embeddingLiteral}::vector(384), true, ${now}, ${now})
      ON CONFLICT ("companyId", "sourceType", "sourceId")
      DO UPDATE SET
        "content" = ${content},
        "embedding" = ${embeddingLiteral}::vector(384),
        "isActive" = true,
        "updatedAt" = ${now}
    `;

    createdIds.push(kcId);
  }

  return { count: createdIds.length, ids: createdIds };
}

/**
 * Generate deterministic signature for sourceId when no SKU exists.
 * Used for deduplication via ON CONFLICT - excludes price so price changes
 * trigger updates rather than creating new rows.
 * 
 * Note: If brand is empty, we return a random UUID to avoid collision between
 * two different brandless products with the same type/colors/sizes.
 */
function generateProductSignature(product: ProductData): string {
  const brand = (product.brand || "").toLowerCase().trim();
  
  // No brand = no reliable identity signal. Don't risk collision-based
  // overwrite between two different brandless products — use a random ID
  // so each confirmation is treated as its own row.
  if (!brand) {
    return randomUUID();
  }
  
  const productType = product.product_type.toLowerCase().trim();
  const colors = [...product.colors].sort().map(c => c.toLowerCase().trim()).join(",");
  const sizes = [...product.sizes].sort().join(",");
  return `${brand}|${productType}|${colors}|${sizes}`;
}

/**
 * Format product data as searchable knowledge chunk content
 */
function formatProductForKnowledgeChunk(product: ProductData): string {
  const parts = [];

  if (product.brand) parts.push(`Brand: ${product.brand}`);
  parts.push(`Product: ${product.product_type}`);  // Changed to match test format
  if (product.colors.length > 0) parts.push(`Colors: ${product.colors.join(", ")}`);
  if (product.sizes.length > 0) parts.push(`Sizes: ${product.sizes.join(", ")}`);
  if (product.price_inr !== null) parts.push(`Price: ₹${product.price_inr}`);

  return parts.join(", ");
}
