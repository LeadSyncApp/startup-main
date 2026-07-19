/**
 * Product Match Service
 *
 * Reuses the existing RAG retrieval pipeline (knowledgeRetriever.service.ts)
 * to match an incoming customer message against the company's product catalog.
 *
 * Confidence is decided by the TOP-vs-RUNNER-UP similarity gap (exactly like the
 * conversational auto-reply rule matching), NOT by an absolute similarity
 * threshold. A match is only returned when the gap is large enough to be a
 * genuine, unambiguous match — otherwise we return null (no forced guess).
 *
 * The matched product is resolved to the live InventoryProduct + variant stock
 * so the displayed stock count is always fresh from the Inventory table.
 */

import { prisma } from "../../lib/prisma";
import { retrieveProductChunks } from "../knowledge/knowledgeRetriever.service";
import { LOW_STOCK_THRESHOLD } from "./inventory.service";

export interface ProductMatchResult {
  /** InventoryProduct UUID */
  productId: string;
  /** Display product name */
  name: string;
  /** Resolved variant/attribute value if the product has variants, else "" */
  variant: string;
  /** Live stock count (sum across variants, or 0 if none) */
  stock: number;
  /** Computed stock status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | null */
  stockStatus: string | null;
  /** Product image URL if available */
  thumbnailUrl: string;
  /** Similarity score of the top match (0..1) */
  score: number;
  /** Gap between top and runner-up product similarity — drives confidence */
  gap: number;
}

// Mirror the established auto-reply gap threshold.
const CONFIDENCE_GAP_THRESHOLD = parseFloat(
  process.env.CONFIDENCE_GAP_THRESHOLD || "0.04"
);

// Minimum top-similarity required before a product is even considered a match.
// The gap heuristic alone can be fooled by a very small catalog (any message
// retrieves a "closest" product with a large gap). This floor ensures the
// message is actually semantically about a product, preventing vague chit-chat
// ("hi", "what's the weather") from matching.
const MIN_PRODUCT_SCORE = parseFloat(
  process.env.PRODUCT_MATCH_MIN_SCORE || "0.80"
);

/**
 * Run product matching against a customer message.
 * Returns null when no confident match exists (low gap / low relevance / no products / error).
 */
export async function matchProductForMessage(
  companyId: string,
  messageText: string
): Promise<ProductMatchResult | null> {
  try {
    if (!messageText || !messageText.trim()) return null;

    const productChunks = await retrieveProductChunks(companyId, messageText, 10);
    if (productChunks.length === 0) {
      console.log("[productMatch] No PRODUCT chunks found in top 10 similar chunks.", { messageText, companyId });
      return null;
    }

    // ── Debug: log all retrieved product chunks with similarity scores ──
    console.log("[productMatch] Retrieved product chunks:", JSON.stringify({
      messageText,
      chunkCount: productChunks.length,
      chunks: productChunks.map(c => ({
        sourceId: c.sourceId,
        content: c.content?.slice(0, 120),
        similarity: c.similarity,
      })),
    }, null, 2));

    const top = productChunks[0];
    const runnerUp = productChunks.length >= 2 ? productChunks[1] : null;
    const gap = runnerUp ? top.similarity - runnerUp.similarity : 1;

    console.log("[productMatch] Similarity check:", JSON.stringify({
      topContent: top.content?.slice(0, 120),
      topSimilarity: top.similarity,
      runnerUpContent: runnerUp?.content?.slice(0, 120),
      runnerUpSimilarity: runnerUp?.similarity,
      gap,
      minScore: MIN_PRODUCT_SCORE,
      minGap: CONFIDENCE_GAP_THRESHOLD,
      passesScore: top.similarity >= MIN_PRODUCT_SCORE,
      passesGap: gap >= CONFIDENCE_GAP_THRESHOLD,
    }, null, 2));

    // Confidence requires BOTH a genuine relevance floor AND a clear gap over
    // the runner-up (so we never force a low-confidence guess).
    if (top.similarity < MIN_PRODUCT_SCORE) {
      console.log("[productMatch] FAILED — top similarity below MIN_PRODUCT_SCORE", { topSimilarity: top.similarity, minScore: MIN_PRODUCT_SCORE });
      return null;
    }
    if (gap < CONFIDENCE_GAP_THRESHOLD) {
      console.log("[productMatch] FAILED — gap below CONFIDENCE_GAP_THRESHOLD", { gap, threshold: CONFIDENCE_GAP_THRESHOLD, topSimilarity: top.similarity, runnerUpSimilarity: runnerUp?.similarity });
      return null;
    }

    // Resolve the matched chunk to a live InventoryProduct. The sourceId is
    // normally the InventoryProduct UUID; fall back to a name match for
    // older PRODUCT chunks indexed before that convention was adopted.
    const productId = top.sourceId;
    if (!productId) {
      console.log("[productMatch] FAILED — top chunk has no sourceId", { topContent: top.content?.slice(0, 120) });
      return null;
    }

    let product = await prisma.inventoryProduct.findFirst({
      where: { id: productId, companyId, isActive: true },
      include: {
        variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
      },
    });

    if (!product) {
      const nameFromContent = parseProductNameFromContent(top.content);
      if (nameFromContent) {
        product = await prisma.inventoryProduct.findFirst({
          where: { name: nameFromContent, companyId, isActive: true },
          include: {
            variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
          },
        });
      }
      if (!product) {
        console.log("[productMatch] FAILED — could not resolve product by sourceId or name", { sourceId: productId, nameFromContent });
      }
    }

    if (!product) return null;

    // Determine the most relevant variant implied by the message, if any.
    const variant = resolveMentionedVariant(messageText, product.variants);

    // Live stock: sum of in-stock variants, or 0 if product has none tracked.
    const stock = product.variants.reduce(
      (sum, v) => sum + (v.stock ?? 0),
      0
    );

    const result: ProductMatchResult = {
      productId: product.id,
      name: product.name,
      variant,
      stock,
      stockStatus: stock === 0 ? "OUT_OF_STOCK" : stock > 0 && stock <= LOW_STOCK_THRESHOLD ? "LOW_STOCK" : "IN_STOCK",
      thumbnailUrl: product.imageUrl || "",
      score: top.similarity,
      gap,
    };

    console.log("[productMatch] SUCCESS — product matched:", JSON.stringify(result, null, 2));

    return result;
  } catch (err: any) {
    console.error("[productMatch] Failed to match product:", err?.message, err?.stack);
    return null;
  }
}

/**
 * Given the customer message, try to pick the variant whose attribute value
 * is mentioned (e.g. "blue", "size M", "large"). Falls back to "" when the
 * product is variant-less or no variant is referenced.
 */
function resolveMentionedVariant(
  messageText: string,
  variants: { attributeValue: string; stock: number | null }[]
): string {
  if (!variants || variants.length === 0) return "";

  const lower = messageText.toLowerCase();
  for (const v of variants) {
    const token = v.attributeValue.toLowerCase().trim();
    if (token && lower.includes(token)) {
      return v.attributeValue;
    }
  }
  return "";
}

/**
 * Extract the product name from a PRODUCT knowledge-chunk content string.
 * Content format (see formatProductForKnowledgeChunk): "Brand: X, Product: Y, ...".
 * Used as a fallback to resolve legacy chunks whose sourceId is not a UUID.
 */
function parseProductNameFromContent(content: string): string | null {
  if (!content) return null;
  const match = content.match(/Product:\s*([^,]+)/i);
  return match ? match[1].trim() : null;
}
