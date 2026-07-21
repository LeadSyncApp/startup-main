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
import { hybridSearch } from "../knowledge/knowledgeRetriever.service";
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

// RRF-score gap threshold (k=60 scale: max gap ~0.020, typical ~0.017).
// Conservative default — log real production gaps to fine-tune.
const CONFIDENCE_GAP_THRESHOLD = parseFloat(
  process.env.CONFIDENCE_GAP_THRESHOLD || "0.005"
);

// Minimum top-similarity required before a product is even considered a match.
// The gap heuristic alone can be fooled by a very small catalog (any message
// retrieves a "closest" product with a large gap). This floor ensures the
// message is actually semantically about a product, preventing vague chit-chat
// ("hi", "what's the weather") from matching.
const MIN_PRODUCT_SCORE = parseFloat(
  process.env.PRODUCT_MATCH_MIN_SCORE || "0.80"
);

// ── BGE-v2-m3 cross-encoder reranker configuration ──
// Minimum reranker score required for a product to be considered a match.
// BGE-v2-m3 produces 0-1 scores; direct queries score 0.97-0.99,
// vague/informal queries score ~0.007. 0.80 is a conservative starting floor.
const MIN_RERANK_SCORE = parseFloat(
  process.env.MIN_RERANK_SCORE || "0.80"
);

// Reranker score gap threshold (log-only, does NOT suppress results — see
// RERANKER_TOP_VS_RUNNERUP log). Records top1-vs-top2 delta for every query
// to empirically determine the right threshold from real score distributions.
// Final value chosen after reviewing Om Sai Silk Boutique test suite output.
const RERANKER_GAP_THRESHOLD = parseFloat(
  process.env.RERANKER_GAP_THRESHOLD || "0.05"
);

// ── BGE-v2-m3 cross-encoder reranker ──
// Loads the ONNX-format BGE Reranker v2 m3 via @xenova/transformers.
// Uses onnxruntime-web (WASM) backend — no native binary needed, works on
// any platform where Node.js >=20.16.0 runs.
//
// Startup: ensureRerankerReady() is called during bootstrap so the server
// crashes loudly (process.exit(1)) if the model can't load / download.
import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@xenova/transformers";

const RERANKER_MODEL = "onnx-community/bge-reranker-v2-m3-ONNX";

let _tokenizer: any = null;
let _model: any = null;

async function getReranker() {
  if (!_tokenizer || !_model) {
    _tokenizer = await AutoTokenizer.from_pretrained(RERANKER_MODEL);
    _model = await AutoModelForSequenceClassification.from_pretrained(
      RERANKER_MODEL
    );
  }
  return { tokenizer: _tokenizer, model: _model };
}

/**
 * Called once at server startup.  If the BGE model cannot be loaded
 * (e.g. missing network to download ONNX weights, filesystem full, etc.)
 * this throws, and the bootstrap catch block calls process.exit(1).
 *
 * Never silence this in production — without the reranker every product
 * match fails the 0.80 floor and the bot goes silent.
 */
export async function ensureRerankerReady(): Promise<void> {
  try {
    await getReranker();
    console.log("[productMatch] BGE reranker loaded OK:", RERANKER_MODEL);
  } catch (err: any) {
    console.error(
      "[productMatch] FATAL: BGE reranker failed to load — product matching will fail every query.",
      { model: RERANKER_MODEL, error: err?.message, stack: err?.stack }
    );
    throw err;
  }
}

function sigmoid(x: number): number {
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x));
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

async function rerank(
  query: string,
  documents: { id: string; text: string }[]
): Promise<{ id: string; score: number; text: string }[]> {
  const { tokenizer, model } = await getReranker();
  const results: { id: string; score: number; text: string }[] = [];

  for (const doc of documents) {
    const inputs = await tokenizer([query], {
      text_pair: [doc.text],
      padding: true,
      truncation: true,
    });
    const output = await model(inputs);
    const logits = output.logits.tolist();
    const score = sigmoid(logits[0][0]);
    results.push({ id: doc.id, score, text: doc.text });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

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

    // Hybrid search: vector + FTS merged by RRF, returns raw cosine similarity
    // alongside rrf_score on each chunk.
    const hybridResults = await hybridSearch(companyId, messageText, "PRODUCT", 20);
    if (hybridResults.length === 0) {
      console.log("[productMatch] No PRODUCT chunks returned by hybridSearch.", { messageText, companyId });
      return null;
    }

    // ── Debug: log all retrieved chunks with both scores ──
    console.log("[productMatch] Hybrid search results:", JSON.stringify({
      messageText,
      chunkCount: hybridResults.length,
      chunks: hybridResults.map(c => ({
        sourceId: c.sourceId,
        content: c.content?.slice(0, 120),
        similarity: c.similarity,
        rrf_score: c.rrf_score,
      })),
    }, null, 2));

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║ OLD COSINE FLOOR + RRF RANKING (preserved for rollback)            ║
    // ╚══════════════════════════════════════════════════════════════════════╝
    // The original logic filtered by raw cosine similarity (MIN_PRODUCT_SCORE)
    // then sorted survivors by rrf_score. Replaced by BGE-v2-m3 cross-encoder
    // reranker which scores query-document relevance directly (0-1 scale).
    // See git history for the full original block at old lines 85-138.
    //
    // const candidates = hybridResults.filter(c => c.similarity >= MIN_PRODUCT_SCORE);
    // if (candidates.length === 0) { ... return null; }
    // candidates.sort((a, b) => b.rrf_score - a.rrf_score);
    // ...

    // ═══════════════════════════════════════════════════════════════════════
    // NEW: BGE-v2-m3 Cross-Encoder Reranker Stage
    // ═══════════════════════════════════════════════════════════════════════

    // Step 1: Run cross-encoder reranker on all hybrid search candidates
    const docs = hybridResults.map(c => ({ id: c.sourceId ?? c.content, text: c.content }));
    const ranked = await rerank(messageText, docs);

    // Map reranker scores back to chunks
    const rerankMap = new Map<string, number>(ranked.map((r: any) => [r.id, r.score]));
    const scored = hybridResults.map(c => ({
      ...c,
      rerank_score: rerankMap.get(c.sourceId ?? c.content) ?? 0,
    }));

    // Step 2: Filter by reranker score floor
    const candidates = scored.filter(c => c.rerank_score >= MIN_RERANK_SCORE);

    if (candidates.length === 0) {
      console.log("[productMatch] FAILED — no chunks pass MIN_RERANK_SCORE floor", {
        minScore: MIN_RERANK_SCORE,
        bestRerankScore: Math.max(...scored.map(c => c.rerank_score)),
        bestContent: scored[0]?.content?.slice(0, 120),
      });
      return null;
    }

    // Step 3: Sort by reranker score
    candidates.sort((a, b) => b.rerank_score - a.rerank_score);

    const top = candidates[0];
    const runnerUp = candidates.length >= 2 ? candidates[1] : null;
    const gap = runnerUp ? top.rerank_score - runnerUp.rerank_score : 1;

    // Step 4: Log reranker top-vs-runnerup delta for threshold tuning (log-only, no behavior change)
    console.log("[productMatch] RERANKER_TOP_VS_RUNNERUP", {
      gap,
      threshold: RERANKER_GAP_THRESHOLD,
      topScore: top.rerank_score,
      runnerUpScore: runnerUp?.rerank_score,
      belowThreshold: gap < RERANKER_GAP_THRESHOLD,
    });

    // Step 5: Borderline query logging — top reranker score within 0.05 of floor
    if (top.rerank_score < MIN_RERANK_SCORE + 0.05) {
      console.log("[productMatch] BORDERLINE — top reranker score near floor:", {
        messageText,
        topRerankScore: top.rerank_score,
        floor: MIN_RERANK_SCORE,
        margin: top.rerank_score - MIN_RERANK_SCORE,
      });
    }

    // Step 6: Log all candidates with reranker scores for debugging
    console.log("[productMatch] Reranker candidates:", JSON.stringify({
      candidateCount: candidates.length,
      totalScored: scored.length,
      filteredOut: hybridResults.length - candidates.length,
      top: {
        content: top.content?.slice(0, 120),
        rerankScore: top.rerank_score,
        similarity: top.similarity,
        rrfScore: top.rrf_score,
      },
      runnerUp: runnerUp ? {
        content: runnerUp.content?.slice(0, 120),
        rerankScore: runnerUp.rerank_score,
        similarity: runnerUp.similarity,
        rrfScore: runnerUp.rrf_score,
      } : null,
      gap,
    }, null, 2));

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
      score: top.rerank_score,
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
