/**
 * Product Match Service
 *
 * Reuses the existing RAG retrieval pipeline (knowledgeRetriever.service.ts)
 * to match an incoming customer message against the company's product catalog.
 *
 * Confidence is decided by the reranker absolute score, using four tiers:
 *   HIGH   (≥ 0.90) — confident match, returned normally.
 *   MEDIUM (≥ 0.80) — passable match, returned with tier tag.
 *   LOW    (≥ 0.10) — weak match, returned so the orchestrator can ask a
 *                      clarifying question instead of staying silent.
 *   NONE   (< 0.10) — true no-match, returns null.
 *
 * The matched product is resolved to the live InventoryProduct + variant stock
 * so the displayed stock count is always fresh from the Inventory table.
 */

import { prisma } from "../../lib/prisma";
import { hybridSearch } from "../knowledge/knowledgeRetriever.service";
import { LOW_STOCK_THRESHOLD } from "./inventory.service";
import { getGroq } from "../ai/ai.service";

export interface ProductMatchCandidate {
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
  /** Similarity score of the candidate match (0..1) */
  score: number;
  /** Confidence tier from the reranker score band */
  confidenceTier: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  /** Human-readable explanation of why the product matched */
  matchReason: string;
}

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
  /** Confidence tier from the reranker score band */
  confidenceTier: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  /** Human-readable explanation of why the product matched, extracted from the
      enriched chunk content (e.g. "This product is made of polyester fabric") */
  matchReason: string;
  /** Flag indicating whether this result contains multiple close candidates */
  isMultiCandidate?: boolean;
  /** Array of close candidate products when 2 or more candidates score within threshold */
  candidates?: ProductMatchCandidate[];
}

// Multi-candidate close score ratio threshold (runner-up score >= 60-70% of top candidate score).
// Easy to tune via environment variable or constant.
const CLOSE_CANDIDATE_RATIO = parseFloat(
  process.env.PRODUCT_MATCH_CLOSE_RATIO || "0.60"
);

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
// MEDIUM confidence boundary (≥ 0.80 = MEDIUM or HIGH, < 0.80 = LOW or NONE).
// BGE-v2-m3 produces 0-1 scores; direct queries score 0.97-0.99,
// vague/informal queries score ~0.007. 0.80 is a conservative starting point.
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

// ── Confidence tier thresholds ──
//   HIGH   ≥ HIGH_CONFIDENCE_SCORE (0.90) — confident match, return normally.
//   MEDIUM ≥ MIN_RERANK_SCORE       (0.80) — passable match, return with tier tag.
//   LOW    ≥ MIN_CONFIDENCE_THRESHOLD (0.05) — return best product so orchestrator
//          can ask a clarifying question instead of staying silent.
//   NONE   <  MIN_CONFIDENCE_THRESHOLD (0.05) — true no-match, return null.
//
// ⚠ PROVISIONAL: MIN_CONFIDENCE_THRESHOLD is a starting value, not a final
//    tuned number. It was set low enough (0.05) to separate "somewhat related"
//    scores (~0.08, e.g. polyester-as-attribute) from "completely unrelated"
//    scores (~0.0001, e.g. silk sarees on a catalog that doesn't sell them),
//    based on a single 5-query test on one company's 2-product catalog.
//    Re-tune from real cross-company usage data once available — the
//    BORDERLINE log and the per-query tier+score in the Reranker candidates
//    log provide the observability needed to find the right floor empirically.
const HIGH_CONFIDENCE_SCORE = parseFloat(
  process.env.HIGH_CONFIDENCE_SCORE || "0.90"
);
const MIN_CONFIDENCE_THRESHOLD = parseFloat(
  process.env.MIN_CONFIDENCE_THRESHOLD || "0.05"
);

// Minimum hybrid search similarity to rescue a NONE-tier candidate via LLM judge.
// When BGE completely fails (< 0.05) but vector/FTS still found a similar product
// (similarity ≥ 0.80), fire the LLM judge to decide if it's a genuine match.
// Empirically validated: failures sit at 0.809-0.833, correct NULLs at 0.769-0.796.
const NONE_RESCUE_SIMILARITY_THRESHOLD = 0.80;

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

// ═══════════════════════════════════════════════════════════════════════════════
// LLM-Based Product Match Judgment
// ═══════════════════════════════════════════════════════════════════════════════
// Instead of regex-based attribute matching (comma-splitting, singularization,
// n-gram matching), we ask the LLM directly whether a candidate product matches
// the customer's stated intent. This is simpler, more accurate (96.9% vs untested
// regex), and handles natural language edge cases (synonyms, Hinglish, ambiguity)
// that regex can't.

const JUDGE_MODEL = "llama-3.1-8b-instant";

const JUDGE_SYSTEM_PROMPT = `You are a product match classifier for an ecommerce assistant.

Given a CUSTOMER MESSAGE and a PRODUCT DESCRIPTION, determine if the product matches what the customer is asking about.

Consider:
- Does the customer mention an attribute (fabric, color, size, category) that exists in this product?
- Does the customer ask for this type of product by name or category?
- Would showing this product to the customer be a reasonable response?

Return ONLY a JSON object:
{
  "isMatch": true/false,
  "reason": "one sentence explanation",
  "confidence": "high" | "medium" | "low"
}`;

interface JudgeResult {
  isMatch: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Ask the LLM whether a candidate product genuinely matches the customer's query.
 * Used only for LOW-tier candidates where the reranker isn't sure.
 *
 * Timeout: 3s. On failure, returns { isMatch: false } — safe fallback to
 * existing reranker-only tier logic. Never crashes, never blocks.
 */
async function judgeProductMatch(
  customerMessage: string,
  productContent: string
): Promise<JudgeResult> {
  const start = Date.now();
  try {
    const groq = getGroq();
    const truncated = productContent.length > 400
      ? productContent.slice(0, 400) + "..."
      : productContent;

    const result = await Promise.race([
      groq.chat.completions.create({
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: `CUSTOMER MESSAGE: "${customerMessage}"\n\nPRODUCT DESCRIPTION:\n${truncated}` },
        ],
        model: JUDGE_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.0,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("judge timeout")), 3000)
      ),
    ]);

    const text = result.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(text) as JudgeResult;
    console.log(`[productMatch] JUDGE: ${Date.now() - start}ms — isMatch=${parsed.isMatch} conf=${parsed.confidence} — ${parsed.reason}`);
    return parsed;
  } catch (err: any) {
    console.warn(`[productMatch] JUDGE failed (${err.message}), falling back to isMatch=false`);
    return { isMatch: false, reason: `Judge unavailable: ${err.message}`, confidence: "low" };
  }
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║ OLD FLOOR FILTER (preserved for rollback)                          ║
    // ║ Replaced by confidence tiering below — the 0.80 MIN_RERANK_SCORE   ║
    // ║ is now the MEDIUM boundary, not the absolute floor. The new LOW    ║
    // ║ band (0.10–0.80) returns the best product with a low-confidence    ║
    // ║ tag instead of null, enabling clarifying questions downstream.     ║
    // ╚══════════════════════════════════════════════════════════════════════╝
    //
    // const candidates = scored.filter(c => c.rerank_score >= MIN_RERANK_SCORE);
    // if (candidates.length === 0) {
    //   console.log("[productMatch] FAILED — no chunks pass MIN_RERANK_SCORE floor", {
    //     minScore: MIN_RERANK_SCORE,
    //     bestRerankScore: Math.max(...scored.map(c => c.rerank_score)),
    //     bestContent: scored[0]?.content?.slice(0, 120),
    //   });
    //   return null;
    // }
    // candidates.sort((a, b) => b.rerank_score - a.rerank_score);
    // const top = candidates[0];
    // const runnerUp = candidates.length >= 2 ? candidates[1] : null;
    // const gap = runnerUp ? top.rerank_score - runnerUp.rerank_score : 1;
    // console.log("[productMatch] RERANKER_TOP_VS_RUNNERUP", { ... });
    // if (top.rerank_score < MIN_RERANK_SCORE + 0.05) { ... borderline log ... }
    // console.log("[productMatch] Reranker candidates:", JSON.stringify({ ... }));

    // Step 2: Sort all scored chunks by reranker score (highest first)
    scored.sort((a, b) => b.rerank_score - a.rerank_score);

    // Step 3: Resolve scored chunks to distinct candidate products
    const candidateProducts: ProductMatchCandidate[] = [];
    const seenProductIds = new Set<string>();

    for (const chunk of scored) {
      const sourceId = chunk.sourceId;
      let product: any = null;

      if (sourceId && !seenProductIds.has(sourceId)) {
        product = await prisma.inventoryProduct.findFirst({
          where: { id: sourceId, companyId, isActive: true },
          include: {
            variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
          },
        });
      }

      if (!product) {
        const nameFromContent = parseProductNameFromContent(chunk.content);
        if (nameFromContent) {
          product = await prisma.inventoryProduct.findFirst({
            where: { name: nameFromContent, companyId, isActive: true },
            include: {
              variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
            },
          });
        }
      }

      if (product && !seenProductIds.has(product.id)) {
        seenProductIds.add(product.id);

        const variant = resolveMentionedVariant(messageText, product.variants);
        const stock = product.variants.reduce(
          (sum: number, v: any) => sum + (v.stock ?? 0),
          0
        );
        const chunkScore = chunk.rerank_score;

        let candidateTier: "HIGH" | "MEDIUM" | "LOW" | "NONE";
        if (chunkScore >= HIGH_CONFIDENCE_SCORE) candidateTier = "HIGH";
        else if (chunkScore >= MIN_RERANK_SCORE) candidateTier = "MEDIUM";
        else if (chunkScore >= MIN_CONFIDENCE_THRESHOLD) candidateTier = "LOW";
        else candidateTier = "NONE";

        candidateProducts.push({
          productId: product.id,
          name: product.name,
          variant,
          stock,
          stockStatus: stock === 0 ? "OUT_OF_STOCK" : stock > 0 && stock <= LOW_STOCK_THRESHOLD ? "LOW_STOCK" : "IN_STOCK",
          thumbnailUrl: product.imageUrl || "",
          score: chunkScore,
          confidenceTier: candidateTier,
          matchReason: extractMatchReason(chunk.content, messageText),
        });
      }
    }

    if (candidateProducts.length === 0) {
      console.log("[productMatch] FAILED — could not resolve any candidate products from scored chunks");
      return null;
    }

    const topCandidate = candidateProducts[0];
    const runnerUpCandidate = candidateProducts.length >= 2 ? candidateProducts[1] : null;
    const gap = runnerUpCandidate ? topCandidate.score - runnerUpCandidate.score : 1;
    const bestScore = topCandidate.score;
    const topChunk = scored[0];

    // Step 4: Assign confidence tier for top match
    let confidenceTier = topCandidate.confidenceTier;

    // Step 5: LLM judgment for uncertain candidates
    const shouldJudge =
      confidenceTier === "LOW" ||
      (confidenceTier === "NONE" && topChunk?.similarity >= NONE_RESCUE_SIMILARITY_THRESHOLD);

    if (shouldJudge) {
      const judge = await judgeProductMatch(messageText, topChunk?.content || "");
      if (judge.isMatch) {
        const from = confidenceTier;
        confidenceTier = confidenceTier === "NONE" ? "LOW" : "MEDIUM";
        topCandidate.confidenceTier = confidenceTier;
        console.log("[productMatch] JUDGE_BOOST:", { from, to: confidenceTier, reason: judge.reason, confidence: judge.confidence });
      } else {
        console.log("[productMatch] JUDGE_CONFIRM:", { tier: confidenceTier, reason: judge.reason });
      }
    }

    if (confidenceTier === "NONE") {
      console.log("[productMatch] FAILED — top candidate score below MIN_CONFIDENCE_THRESHOLD", {
        minScore: MIN_CONFIDENCE_THRESHOLD,
        bestRerankScore: bestScore,
        bestContent: topChunk?.content?.slice(0, 120),
      });
      return null;
    }

    // Step 6: Multi-candidate evaluation
    // Filter close candidates: score >= CLOSE_CANDIDATE_RATIO * topCandidate.score
    const closeCandidates = candidateProducts.filter(
      cand => cand.score >= CLOSE_CANDIDATE_RATIO * topCandidate.score
    );
    const isMultiCandidate = closeCandidates.length >= 2;

    // Log reranker top-vs-runnerup delta for threshold tuning
    console.log("[productMatch] RERANKER_TOP_VS_RUNNERUP", {
      gap,
      threshold: RERANKER_GAP_THRESHOLD,
      topScore: bestScore,
      runnerUpScore: runnerUpCandidate?.score,
      belowThreshold: gap < RERANKER_GAP_THRESHOLD,
      isMultiCandidate,
      closeCandidatesCount: closeCandidates.length,
      closeRatioThreshold: CLOSE_CANDIDATE_RATIO,
    });

    if (bestScore < MIN_RERANK_SCORE + 0.05) {
      console.log("[productMatch] BORDERLINE — top reranker score near confidence floor:", {
        messageText,
        topRerankScore: bestScore,
        confidenceTier,
        mediumFloor: MIN_RERANK_SCORE,
        margin: bestScore - MIN_RERANK_SCORE,
      });
    }

    console.log("[productMatch] Reranker candidates:", JSON.stringify({
      totalScored: scored.length,
      totalCandidates: candidateProducts.length,
      closeCandidatesCount: closeCandidates.length,
      isMultiCandidate,
      confidenceTier,
      candidates: closeCandidates.map(c => ({
        name: c.name,
        score: c.score,
        tier: c.confidenceTier,
        stock: c.stockStatus,
      })),
      gap,
    }, null, 2));

    const result: ProductMatchResult = {
      productId: topCandidate.productId,
      name: topCandidate.name,
      variant: topCandidate.variant,
      stock: topCandidate.stock,
      stockStatus: topCandidate.stockStatus,
      thumbnailUrl: topCandidate.thumbnailUrl,
      score: topCandidate.score,
      gap,
      confidenceTier,
      matchReason: topCandidate.matchReason,
      isMultiCandidate,
      candidates: isMultiCandidate ? closeCandidates : undefined,
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

/**
 * Extract a human-readable match explanation from the chunk content.
 * The natural-language enrichment sentence ("This product is made of X, Y...")
 * is always at the end of the content string when custom fields exist.
 * Falls back to the description or product type if no enrichment is present.
 *
 * When a query is provided, selects the field most relevant to what the customer
 * asked about (e.g. size info for a size query, fabric info for a fabric query)
 * instead of always returning the first enrichment sentence.
 */
function extractMatchReason(content: string, query?: string): string {
  if (!content) return "";

  // Parse all key-value fields from chunk
  const fields: Record<string, string> = {};
  const fieldMatches = content.matchAll(/(\w[\w\s]*?):\s*([^,\.]+)/gi);
  for (const match of fieldMatches) {
    const key = match[1].trim().toLowerCase();
    const val = match[2].trim();
    fields[key] = val;
  }

  // Parse enrichment sentence for attribute-specific phrases
  const enrichmentMatch = content.match(/This product is ([^.]+)\.?/i);
  if (enrichmentMatch) {
    const phrases = enrichmentMatch[1].split(/,\s*/);
    for (const phrase of phrases) {
      const lp = phrase.toLowerCase();
      if (lp.includes("fabric") || lp.includes("made of")) fields["_enrich_fabric"] = phrase.trim();
      if (lp.includes("color") || lp.includes("colour")) fields["_enrich_color"] = phrase.trim();
      if (lp.includes("size")) fields["_enrich_size"] = phrase.trim();
    }
    fields["_enrich_full"] = enrichmentMatch[0].trim();
  }

  // Query-aware selection: pick the field most relevant to what the customer asked
  if (query) {
    const lq = query.toLowerCase();
    const isFabric = /\b(polyester|cotton|silk|linen|nylon|wool|rayon|chiffon|georgette|velvet|fabric)\b/i.test(lq);
    const isColor = /\b(red|blue|green|yellow|black|white|pink|orange|purple|gold|silver|color|colour)\b/i.test(lq);
    const isSize = /\b(size|fit|small|medium|large|xl|xxl|\d{2,3})\b/i.test(lq) && !/\b(silk|polka|cotton)\b/i.test(lq);
    const isCategory = /\b(shirts?|pants?|sarees?|kurtas?|jackets?|shoes?|dresses?|skirts?|tops?|blouses?|tees?|t-shirts?)\b/i.test(lq);

    if (isFabric) {
      if (fields["_enrich_fabric"]) return fields["_enrich_fabric"];
      if (fields["fabrictype"]) return `made of ${fields["fabrictype"]} fabric`;
      if (fields["fabric"]) return `made of ${fields["fabric"]} fabric`;
      if (fields["material"]) return `made from ${fields["material"]}`;
    }
    if (isColor) {
      if (fields["_enrich_color"]) return fields["_enrich_color"];
      if (fields["color"]) return fields["color"];
      if (fields["colour"]) return fields["colour"];
      if (fields["description"]) return fields["description"];
    }
    if (isSize) {
      if (fields["_enrich_size"]) return fields["_enrich_size"];
      if (fields["size"]) return `available in size ${fields["size"]}`;
    }
    if (isCategory) {
      if (fields["product"]) return fields["product"];
      if (fields["categories"]) return fields["categories"];
      if (fields["category"]) return fields["category"];
    }
  }

  // Fallback: original behavior (first enrichment, then description, then product name)
  if (fields["_enrich_full"]) return fields["_enrich_full"];
  if (fields["description"]) return fields["description"];
  if (fields["product"]) return fields["product"];
  return content.slice(0, 100);
}
