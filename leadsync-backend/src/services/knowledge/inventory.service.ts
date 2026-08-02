/**
 * Inventory Parsing Service
 * 
 * POST /companies/:id/inventory/parse - Groq-based product parsing, no persistence
 * POST /companies/:id/inventory/confirm - Persist confirmed products to InventoryProduct + KnowledgeChunk
 */

import Groq from "groq-sdk";
import { prisma, directPrisma } from "../../lib/prisma";
import { embedText } from "../../utils/embedding";
import { invalidateChunkCache } from "./chunkCache";
import {
  PRODUCT_PARSING_PROMPT,
  buildBusinessTypeRules,
  buildFieldExtractionInstructions,
} from "../ai/modelComparison.service";
import { normalizeProductsArray, ProductData, ProductVariantData, ParsedData } from "../ai/numeralConverter";
import { randomUUID } from "crypto";
import { validateVariantDimensions } from "../../utils/variantValidation";
import { businessNotificationService } from "../infrastructure/businessNotification.service";

export const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(stock: number | null): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | null {
  if (stock === null) return null;
  if (stock === 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

function enrichWithStockStatus(product: any) {
  const variants = (product.variants || []).map((v: any) => ({
    ...v,
    stockStatus: getStockStatus(v.stock),
  }));

  const hasOutOfStock = variants.some((v: any) => v.stockStatus === "OUT_OF_STOCK");
  const hasLowStock = variants.some((v: any) => v.stockStatus === "LOW_STOCK");
  const hasAnyTracked = variants.some((v: any) => v.stockStatus !== null);

  let stockStatus = null;
  if (hasAnyTracked) {
    if (hasOutOfStock) stockStatus = "OUT_OF_STOCK";
    else if (hasLowStock) stockStatus = "LOW_STOCK";
    else stockStatus = "IN_STOCK";
  }

  return { ...product, stockStatus, variants };
}

// Re-export for use in routes
export { PRODUCT_PARSING_PROMPT };
export type { ProductData, ProductVariantData, ParsedData };

/**
 * Parse inventory text into structured products using Groq
 * Does NOT persist - returns structured data only
 */
export async function parseInventoryText(
  companyId: string,
  ownerText: string,
  language: string = "English"
): Promise<ParsedData> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const groq = new Groq({ apiKey: groqApiKey });

  // Load the company's business type so the AI only extracts relevant fields.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { businessType: true },
  });
  const businessType = company?.businessType || "RETAIL";

  // Load product field definitions for dynamic rule building
  const productFieldModel = (prisma as any).productFieldDefinition;
  let productFieldDefs: Array<{
    fieldName: string;
    fieldType: string;
    appliesTo: string;
    options: string[];
  }> = [];
  
  if (productFieldModel) {
    try {
      productFieldDefs = await productFieldModel.findMany({
        where: { companyId },
        select: {
          fieldName: true,
          fieldType: true,
          appliesTo: true,
          options: true,
        },
      });
    } catch (err) {
      // If model doesn't exist yet or query fails, use empty array (will trigger fallback rules)
      productFieldDefs = [];
    }
  }

  // Build dynamic business type rules
  const businessTypeRules = buildBusinessTypeRules(businessType, productFieldDefs);

  // Build field extraction instructions for dynamic custom fields
  const fieldExtractionInstructions = buildFieldExtractionInstructions(productFieldDefs);

  try {
    const userPrompt = PRODUCT_PARSING_PROMPT
      .replace("{{BUSINESS_TYPE}}", businessType)
      .replace("{{BUSINESS_TYPE_RULES}}", businessTypeRules)
      .replace("{{FIELD_EXTRACTION_INSTRUCTIONS}}", fieldExtractionInstructions)
      .replace("{{LANGUAGE}}", language)
      .replace("{{OWNER_TEXT}}", ownerText);

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
 * Build a display name from brand + product_type
 */
function buildProductName(product: ProductData): string {
  return product.product_type || "Unknown Product";
}

/**
 * Sanitize a string for use in a SKU (uppercase alphanumeric + hyphens)
 */
function sanitizeForSku(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 10);
}

/**
 * Generate a base SKU from a product name (e.g. "Premium Cotton T-Shirt" → "PREMIUM-COTTON-TSHIRT")
 */
function generateBaseSku(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
}

/**
 * Ensure a SKU is unique within a company. Appends -1, -2, etc. on conflict.
 */
async function ensureSkuUnique(companyId: string, baseSku: string, db: any = prisma): Promise<string> {
  let sku = baseSku;
  let counter = 1;
  while (true) {
    const exists = await db.inventoryProduct.findFirst({
      where: { companyId, sku },
      select: { id: true },
    });
    if (!exists) return sku;
    sku = `${baseSku}-${counter}`;
    counter++;
  }
}

/**
 * Upsert variants for a product, removing stale ones
 */
async function upsertVariants(
  productId: string, 
  variants: ProductVariantData[], 
  parentSku: string | null,
  historyPromises: Promise<any>[],
  db: any = prisma
) {
  const existing = await db.inventoryVariant.findMany({ where: { productId } });
  const existingValues = new Set(existing.map((v: any) => v.attributeValue));
  const incomingValues = new Set(variants.map(v => v.attribute_value));

  // Remove variants no longer present
  for (const v of existing) {
    if (!incomingValues.has(v.attributeValue)) {
      await db.inventoryVariant.delete({ where: { id: v.id } });
    }
  }

  // Upsert each variant
  for (const v of variants) {
    const variantSku = v.sku || (parentSku && v.attribute_value
      ? `${parentSku}-${sanitizeForSku(v.attribute_value)}`
      : null);
    
    const existingVar = existing.find((ev: any) => ev.attributeValue === v.attribute_value);
    if (existingVar) {
      const newPrice = v.price_override ?? 0;
      if (existingVar.price !== newPrice) {
        historyPromises.push(
          db.priceHistory.create({
            data: {
              productId,
              variantId: existingVar.id,
              oldPrice: existingVar.price,
              newPrice: newPrice,
              actorName: "System Ingestion"
            }
          })
        );
      }

      const newStock = v.stock;
      if (v.stock !== undefined && existingVar.stock !== newStock) {
        historyPromises.push(
          db.stockHistory.create({
            data: {
              productId,
              variantId: existingVar.id,
              oldStock: existingVar.stock,
              newStock: newStock,
              actorName: "System Ingestion"
            }
          })
        );
      }
    }

    const attributesMap = v.attributes || null;
    const variantPriceSubunits = v.price_override !== null && v.price_override !== undefined 
      ? BigInt(Math.round(v.price_override * 100)) 
      : null;

    await db.inventoryVariant.upsert({
      where: { productId_attributeValue: { productId, attributeValue: v.attribute_value } },
      update: { 
        price: v.price_override ?? 0, 
        priceInSubunits: variantPriceSubunits,
        stock: v.stock, 
        ...(attributesMap ? { attributes: attributesMap } : {}),
        ...(variantSku ? { sku: variantSku } : {}) 
      },
      create: { 
        productId, 
        attributeValue: v.attribute_value, 
        attributes: attributesMap,
        price: v.price_override ?? 0, 
        priceInSubunits: variantPriceSubunits,
        stock: v.stock, 
        sku: variantSku 
      }
    });
  }
}

/**
 * Persist confirmed products to InventoryProduct + InventoryVariant
 * Also maintains KnowledgeChunk for RAG backward compatibility
 */
export async function confirmInventoryProducts(
  companyId: string,
  products: ProductData[]
): Promise<{ count: number; ids: string[] }> {
  const createdIds: string[] = [];

  // Load business type once to know whether the availability toggle applies.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { businessType: true },
  });
  const isRestaurant = company?.businessType === "RESTAURANT";

  for (const product of products) {
    await prisma.$transaction(async (tx) => {
      const historyPromises: Promise<any>[] = [];
      const productName = buildProductName(product);
      const hasVariants = product.variants && product.variants.length > 0;
      // Availability toggle only meaningful for restaurants; default true otherwise.
      const isAvailable = isRestaurant ? (product.isAvailable ?? true) : true;

      // Compute multi-dimensional variant attribute names (max 3)
      const dimensionNames: string[] = product.variantAttributeNames
        || (product.variant_dimensions ? product.variant_dimensions.map(d => d.name) : [])
        || (product.attribute_name ? [product.attribute_name] : []);

      validateVariantDimensions(dimensionNames);

      // Dedup check: find existing product by company + name
      const existing = await tx.inventoryProduct.findUnique({
        where: { companyId_name: { companyId, name: productName } }
      });

      let productId: string;
      let productSku: string | null = null;

      if (existing) {
        // Update existing product — only update SKU if explicitly provided
        productSku = product.sku ?? existing.sku;
        const existingBasePriceFloat = Number(existing.basePriceInSubunits) / 100;
        const newPrice = product.price_inr ?? existingBasePriceFloat;
        
        if (existingBasePriceFloat !== newPrice) {
          historyPromises.push(
            tx.priceHistory.create({
              data: {
                productId: existing.id,
                oldPrice: existingBasePriceFloat,
                newPrice: newPrice,
                actorName: "System Ingestion"
              }
            })
          );
        }

        await tx.inventoryProduct.update({
          where: { id: existing.id },
          data: {
            basePrice: newPrice,
            basePriceInSubunits: BigInt(Math.round((newPrice || 0) * 100)),
            hasVariants,
            variantAttributeName: product.attribute_name,
            variantAttributeNames: dimensionNames,
            description: product.description ?? existing.description,
            isAvailable,
            customFieldValues: product.customFieldValues ? JSON.parse(JSON.stringify(product.customFieldValues)) : existing.customFieldValues,
            ...(product.sku !== undefined ? { sku: product.sku } : {}),
            ...(product.categories !== undefined ? { categories: product.categories } : {}),
          }
        });
        productId = existing.id;
      } else {
        // Create new product — auto-generate SKU if not provided
        const baseSku = product.sku || generateBaseSku(productName);
        productSku = await ensureSkuUnique(companyId, baseSku, tx);
        const basePriceVal = product.price_inr ?? 0;
        const newProduct = await tx.inventoryProduct.create({
          data: {
            companyId,
            name: productName,
            description: product.description,
            basePrice: basePriceVal,
            basePriceInSubunits: BigInt(Math.round(basePriceVal * 100)),
            hasVariants,
            variantAttributeName: product.attribute_name,
            variantAttributeNames: dimensionNames,
            isAvailable,
            sku: productSku,
            categories: product.categories || [],
            customFieldValues: product.customFieldValues ? JSON.parse(JSON.stringify(product.customFieldValues)) : undefined,
          }
        });
        productId = newProduct.id;
      }

      // Upsert variants
      if (hasVariants) {
        await upsertVariants(productId, product.variants, productSku, historyPromises, tx);
      }

      // Also maintain KnowledgeChunk for RAG retrieval backward compatibility
      const content = formatProductForKnowledgeChunk(product);
      // E5 models require "passage: " prefix for indexed content to align with query embeddings
      const embedding = await embedText("passage: " + content);
      const embeddingLiteral = `[${embedding.join(",")}]`;
      // Use the InventoryProduct UUID as sourceId so PRODUCT knowledge chunks
      // can be resolved back to the live InventoryProduct + variant stock.
      const sourceId = productId;
      const now = new Date();
      const kcId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk" ("id", "companyId", "sourceType", "sourceId", "content", "embedding", "isActive", "createdAt", "updatedAt")
        VALUES (${kcId}, ${companyId}, 'PRODUCT'::"KnowledgeSourceType", ${sourceId}, ${content}, ${embeddingLiteral}::vector(384), true, ${now}, ${now})
        ON CONFLICT ("companyId", "sourceType", "sourceId")
        DO UPDATE SET
          "content" = ${content},
          "embedding" = ${embeddingLiteral}::vector(384),
          "isActive" = true,
          "updatedAt" = ${now}
      `;

      // Invalidate in-memory knowledge chunk cache after product upsert
      invalidateChunkCache(companyId);

      if (historyPromises.length > 0) {
        await Promise.all(historyPromises);
      }

      createdIds.push(productId);
    });
  }

  return { count: createdIds.length, ids: createdIds };
}

/**
 * Generate deterministic signature for sourceId when no SKU exists.
 * Used for deduplication via ON CONFLICT on KnowledgeChunk.
 */
function generateProductSignature(product: ProductData): string {
  const brand = (String(product.customFieldValues?.Brand ?? "") || product.brand || "").toLowerCase().trim();
  
  if (!brand) {
    return randomUUID();
  }
  
  const productType = product.product_type.toLowerCase().trim();
  const variantValues = (product.variants || [])
    .map(v => v.attribute_value.toLowerCase().trim())
    .sort()
    .join(",");
  return `${brand}|${productType}|${variantValues}`;
}

/**
 * Format product data as searchable knowledge chunk content
 */
function formatProductForKnowledgeChunk(product: ProductData): string {
  const parts: string[] = [];

  if (product.sku) parts.push(`SKU: ${product.sku}`);
  parts.push(`Product: ${product.product_type}`);
  if (product.categories && product.categories.length > 0) {
    parts.push(`Categories: ${product.categories.join(", ")}`);
  }
  if (product.description) parts.push(`Description: ${product.description}`);
  if (product.customFieldValues && typeof product.customFieldValues === "object") {
    for (const [key, val] of Object.entries(product.customFieldValues)) {
      if (val != null && val !== "") parts.push(`${key}: ${val}`);
    }
  }
  if (product.variants && product.variants.length > 0) {
    const variantLines = product.variants.map(v => {
      const label = v.attribute_name || "Variant";
      return `${label}: ${v.attribute_value}`;
    });
    parts.push(variantLines.join(", "));
  }
  if (product.price_inr !== null) parts.push(`Price: ₹${product.price_inr}`);

  // Natural language enrichment: repeat field values in context for better
  // FTS matching and embedding surface area
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

  return parts.join(". ");
}

/**
 * Search inventory products for the in-chat product picker
 */
export async function searchInventoryProducts(
  companyId: string,
  searchTerm: string
) {
  const products = await prisma.inventoryProduct.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { categories: { has: searchTerm } },
        { sku: { contains: searchTerm, mode: "insensitive" } },
      ]
    },
    include: { 
      variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
      images: { orderBy: { order: "asc" } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return products.map(enrichWithStockStatus);
}

/**
 * Get all active inventory products for a company, optionally filtered by categories
 */
export async function getInventoryProducts(companyId: string, categoriesFilter?: string) {
  const where: any = { companyId, isActive: true };

  if (categoriesFilter) {
    const cats = categoriesFilter.split(",").map(c => c.trim()).filter(Boolean);
    if (cats.length > 0) {
      where.categories = { hasSome: cats };
    }
  }

  const products = await prisma.inventoryProduct.findMany({
    where,
    include: { 
      variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } },
      images: { orderBy: { order: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });
  return products.map(enrichWithStockStatus);
}

/**
 * Decrement InventoryVariant.stock for each item in an order.
 * Matches OrderItem → InventoryProduct by name (case-insensitive),
 * then resolves the variant by SKU, attribute value in item name, or
 * falls back to the most-stocked variant. Floors at 0 to prevent negatives.
 * Skips variant-less products (no `stock` field on the product itself).
 */
export async function decrementStockForOrder(orderId: string, companyId: string, txClient?: any): Promise<void> {
  const runner = async (tx: any) => {
    // 1. Atomic Idempotency Check: set stockDecremented = true only if it is currently false
    const updated = await tx.order.updateMany({
      where: { id: orderId, stockDecremented: false },
      data: { stockDecremented: true }
    });

    if (updated.count === 0) {
      console.log(`ℹ️ [StockDecrement] Order ${orderId} stock was already decremented. Skipping.`);
      return;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true }
    });
    if (!order || !order.orderItems.length) return;

    for (const item of order.orderItems) {
      let product: any = null;

      // 1. Direct match by item.productId (if populated)
      if (item.productId) {
        product = await (tx.inventoryProduct as any).findFirst({
          where: { id: item.productId, companyId, isActive: true }
        });
      }

      // 2. Lookup product by item.sku (if item.sku matches InventoryProduct SKU)
      if (!product && item.sku) {
        product = await (tx.inventoryProduct as any).findFirst({
          where: { companyId, sku: item.sku, isActive: true }
        });
      }

      // 3. Lookup product by variant ID stored in item.sku
      if (!product && item.sku) {
        const variant = await (tx.inventoryVariant as any).findFirst({
          where: { id: item.sku, isActive: true },
          include: { product: true }
        });
        if (variant && variant.product && variant.product.companyId === companyId && variant.product.isActive) {
          product = variant.product;
        }
      }

      // 4. Fallback: Exact name match or prefix match (e.g. item.name = "wss shirts - 42 / M", product.name = "wss shirts")
      if (!product) {
        const baseName = item.name.split(" - ")[0].trim();
        product = await (tx.inventoryProduct as any).findFirst({
          where: {
            companyId,
            isActive: true,
            OR: [
              { name: { equals: item.name, mode: "insensitive" } },
              { name: { equals: baseName, mode: "insensitive" } }
            ]
          }
        });
      }

      if (!product) {
        console.warn(`⚠️ [StockDecrement] Product/Variant not found for order item: "${item.name}" (sku: ${item.sku})`);
        continue;
      }

      // Decrement logic per product variant
      try {
        let targetVariant: any = null;

        if (item.sku) {
          targetVariant = await (tx.inventoryVariant as any).findFirst({
            where: { id: item.sku, productId: product.id, isActive: true }
          });
        }

        if (!targetVariant && item.name.includes(" - ")) {
          const attrVal = item.name.split(" - ").slice(1).join(" - ").trim();
          targetVariant = await (tx.inventoryVariant as any).findFirst({
            where: { productId: product.id, attributeValue: { equals: attrVal, mode: "insensitive" }, isActive: true }
          });
        }

        if (!targetVariant) {
          const variants = await (tx.inventoryVariant as any).findMany({
            where: { productId: product.id, isActive: true }
          });
          if (variants.length === 1) targetVariant = variants[0];
        }

        if (!targetVariant) {
          console.warn(`⚠️ [StockDecrement] Could not uniquely identify variant for item "${item.name}" (Product ID: ${product.id}).`);
          continue;
        }

        if (targetVariant.stock === null) {
          console.log(`ℹ️ [StockDecrement] Variant ${targetVariant.id} has no stock tracking (stock=null). Skipping.`);
          continue;
        }

        let actualOldStock = targetVariant.stock;
        let actualNewStock = 0;

        const result: any = await tx.$queryRaw`
          UPDATE "InventoryVariant"
          SET "stock" = GREATEST(0, "stock" - ${item.quantity}), "updatedAt" = NOW()
          WHERE "id" = ${targetVariant.id} AND "stock" >= ${item.quantity}
          RETURNING "stock"
        `;
        if (!result.length) continue;

        actualNewStock = result[0].stock;

        await tx.stockHistory.create({
          data: {
            productId: product.id,
            variantId: targetVariant.id,
            oldStock: actualOldStock,
            newStock: actualNewStock,
            actorName: `Order ${order.id}`
          }
        });

        businessNotificationService.notifyStockLevelChange({
          companyId,
          productName: `${product.name} (${targetVariant.attributeValue})`,
          sku: targetVariant.sku || product.sku,
          currentStock: actualOldStock,
          newStock: actualNewStock,
        }).catch((e: any) => console.error("❌ Low stock notification error:", e));

        console.log(`📦 [StockDecrement] Variant ${targetVariant.id} ("${targetVariant.attributeValue}"): ${actualOldStock} → ${actualNewStock} (ordered ${item.quantity})`);
      } catch (historyErr) {
        console.error("❌ [StockDecrement] Failed to write StockHistory row:", historyErr);
        continue;
      }
    }
  };

  if (txClient) {
    await runner(txClient);
  } else {
    await (directPrisma || prisma).$transaction(runner, { maxWait: 10000, timeout: 20000 });
  }
}
