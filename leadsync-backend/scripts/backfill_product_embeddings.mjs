/**
 * Product Embedding Backfill Worker
 *
 * Scans all active InventoryProduct records per company and ensures a
 * corresponding KnowledgeChunk (sourceType: 'PRODUCT') exists and is up to date.
 *
 * For any product missing an embedding or with a stale one (product.updatedAt >
 * chunk.updatedAt), re-runs the same embedding logic used in confirmInventoryProducts:
 *   formatProductForKnowledgeChunk + embedText + upsert into KnowledgeChunk.
 *
 * Usage:
 *   node scripts/backfill_product_embeddings.mjs                    # all companies
 *   node scripts/backfill_product_embeddings.mjs <companyId>         # single company
 *   node scripts/backfill_product_embeddings.mjs --dry-run           # dry run, no writes
 *   node scripts/backfill_product_embeddings.mjs <companyId> --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { pipeline, env } from "@xenova/transformers";

// Disable local model cache warning in script context
env.allowLocalModels = false;

const prisma = new PrismaClient();
const COMPANY_ID = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const DRY_RUN = process.argv.includes("--dry-run");

let extractor = null;

async function getEmbeddingPipeline() {
  if (!extractor) {
    console.log("[backfill] Loading embedding model (Xenova/multilingual-e5-small)...");
    extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
      quantized: true,
    });
    console.log("[backfill] Model loaded.");
  }
  return extractor;
}

/**
 * Generate embedding with E5 "passage: " prefix for indexed content.
 * NOTE: This is a standalone copy — keep in sync with src/utils/embedding.ts.
 * If the shared utility changes, this must be updated to match.
 */
async function embedText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Input must be a non-empty string");
  }
  const pipe = await getEmbeddingPipeline();
  const result = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

/**
 * Build a KnowledgeChunk content string from an InventoryProduct record
 * (mirrors formatProductForKnowledgeChunk in inventory.service.ts but works
 *  with a live DB record instead of a parsed ProductData object).
 */
function formatProductFromRecord(product) {
  const parts = [];

  if (product.sku) parts.push(`SKU: ${product.sku}`);
  if (product.description) parts.push(`Description: ${product.description}`);
  parts.push(`Product: ${product.name}`);
  if (product.categories && product.categories.length > 0) {
    parts.push(`Categories: ${product.categories.join(", ")}`);
  }
  if (product.customFieldValues && typeof product.customFieldValues === "object") {
    for (const [key, val] of Object.entries(product.customFieldValues)) {
      if (val != null && val !== "") parts.push(`${key}: ${val}`);
    }
  }
  if (product.variantAttributeName && product.variants && product.variants.length > 0) {
    const variantValues = product.variants.map(v => v.attributeValue).join(", ");
    parts.push(`${product.variantAttributeName}: ${variantValues}`);
  }
  parts.push(`Price: ₹${product.basePrice}`);

  // Natural language enrichment — mirrors formatProductForKnowledgeChunk
  const fieldEntries = product.customFieldValues && typeof product.customFieldValues === "object"
    ? Object.entries(product.customFieldValues).filter(([_, v]) => v != null && v !== "")
    : [];

  if (fieldEntries.length > 0) {
    const phrases = fieldEntries.map(([key, val]) => {
      const v = String(val);
      const k = key.toLowerCase();
      if (k.includes("fabric")) return `made of ${v} fabric`;
      if (k.includes("color") || k.includes("colour")) return `${v} in color`;
      if (k.includes("size")) return `size ${v}`;
      if (k.includes("brand")) return `by ${v}`;
      if (k.includes("material")) return `made from ${v}`;
      if (k.includes("style")) return `${v} style`;
      if (k.includes("type")) return `${v} type`;
      return v;
    });
    parts.push(`This product is ${phrases.join(", ")}`);
  }

  return parts.join(", ");
}

async function main() {
  console.log("=== Product Embedding Backfill Worker ===");
  if (DRY_RUN) console.log("[dry-run] No writes will be performed.");
  if (COMPANY_ID) console.log(`Scoped to companyId: ${COMPANY_ID}`);

  // Determine which companies to process
  const companyFilter = COMPANY_ID ? { id: COMPANY_ID } : {};
  const companies = await prisma.company.findMany({
    where: { ...companyFilter, isArchived: false },
    select: { id: true, name: true },
  });

  if (companies.length === 0) {
    console.log("No companies found to process.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Processing ${companies.length} company/companies...`);

  let totalProducts = 0;
  let totalMissing = 0;
  let totalStale = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const company of companies) {
    console.log(`\n--- Company: ${company.name} (${company.id}) ---`);

    const products = await prisma.inventoryProduct.findMany({
      where: { companyId: company.id, isActive: true },
      include: {
        variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (products.length === 0) {
      console.log("  No active products found.");
      continue;
    }

    console.log(`  Found ${products.length} active product(s).`);

    for (const product of products) {
      totalProducts++;
      const skuDisplay = product.sku ? ` (SKU: ${product.sku})` : "";
      const label = `  [${product.id.slice(0, 8)}…] ${product.name}${skuDisplay}`;

      // Check existing KnowledgeChunk
      const existingChunk = await prisma.knowledgeChunk.findFirst({
        where: {
          companyId: company.id,
          sourceType: "PRODUCT",
          sourceId: product.id,
        },
        select: { id: true, updatedAt: true, content: true },
      });

      const needsBackfill = !existingChunk || (product.updatedAt > existingChunk.updatedAt);

      if (!needsBackfill) {
        totalSkipped++;
        continue;
      }

      if (!existingChunk) {
        totalMissing++;
        console.log(`${label} — MISSING chunk`);
      } else {
        totalStale++;
        console.log(`${label} — STALE chunk (product: ${product.updatedAt.toISOString()} > chunk: ${existingChunk.updatedAt.toISOString()})`);
      }

      // Build content and embedding with E5 passage prefix
      const content = formatProductFromRecord(product);
      let embedding;
      try {
        embedding = await embedText("passage: " + content);
      } catch (err) {
        totalErrors++;
        console.error(`${label} — EMBEDDING FAILED: ${err.message}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] Would upsert KnowledgeChunk for product ${product.id}`);
        continue;
      }

      // Upsert KnowledgeChunk — same SQL pattern as inventory.service.ts
      const embeddingLiteral = `[${embedding.join(",")}]`;
      const now = new Date();
      const { randomUUID } = await import("crypto");
      const kcId = existingChunk ? existingChunk.id : randomUUID();

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "KnowledgeChunk" ("id", "companyId", "sourceType", "sourceId", "content", "embedding", "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, 'PRODUCT'::"KnowledgeSourceType", $3, $4, $5::vector(384), true, $6, $6)
          ON CONFLICT ("companyId", "sourceType", "sourceId")
          DO UPDATE SET
            "content" = $4,
            "embedding" = $5::vector(384),
            "isActive" = true,
            "updatedAt" = $6
        `, kcId, company.id, product.id, content, embeddingLiteral, now);
        console.log(`  ✔ Chunk upserted (id: ${kcId.slice(0, 8)}…)`);
      } catch (err) {
        totalErrors++;
        console.error(`  ✘ UPSERT FAILED: ${err.message}`);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Total products scanned:  ${totalProducts}`);
  console.log(`  Missing chunks:          ${totalMissing}`);
  console.log(`  Stale chunks:            ${totalStale}`);
  console.log(`  Skipped (up to date):    ${totalSkipped}`);
  console.log(`  Errors:                  ${totalErrors}`);
  if (DRY_RUN) console.log("  (dry-run — no data was written)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  prisma.$disconnect().then(() => process.exit(1));
});
