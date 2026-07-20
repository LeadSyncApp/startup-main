/**
 * Inventory Parsing Service
 * 
 * POST /companies/:id/inventory/parse - Groq-based product parsing, no persistence
 * POST /companies/:id/inventory/confirm - Persist confirmed products to InventoryProduct + KnowledgeChunk
 */

import Groq from "groq-sdk";
import { prisma } from "../../lib/prisma";
import { embedText } from "../../utils/embedding";
import { PRODUCT_PARSING_PROMPT } from "../ai/modelComparison.service";
import { normalizeProductsArray, ProductData, ProductVariantData, ParsedData } from "../ai/numeralConverter";
import { randomUUID } from "crypto";

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
  ownerText: string
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

  try {
    const userPrompt = PRODUCT_PARSING_PROMPT
      .replace("{{BUSINESS_TYPE}}", businessType)
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
  const parts: string[] = [];
  if (product.brand) parts.push(product.brand);
  parts.push(product.product_type);
  return parts.join(" ").trim();
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
async function ensureSkuUnique(companyId: string, baseSku: string): Promise<string> {
  let sku = baseSku;
  let counter = 1;
  while (true) {
    const exists = await prisma.inventoryProduct.findFirst({
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
  historyPromises: Promise<any>[]
) {
  const existing = await prisma.inventoryVariant.findMany({ where: { productId } });
  const existingValues = new Set(existing.map(v => v.attributeValue));
  const incomingValues = new Set(variants.map(v => v.attribute_value));

  // Remove variants no longer present
  for (const v of existing) {
    if (!incomingValues.has(v.attributeValue)) {
      await prisma.inventoryVariant.delete({ where: { id: v.id } });
    }
  }

  // Upsert each variant
  for (const v of variants) {
    const variantSku = v.sku || (parentSku && v.attribute_value
      ? `${parentSku}-${sanitizeForSku(v.attribute_value)}`
      : null);
    
    const existingVar = existing.find(ev => ev.attributeValue === v.attribute_value);
    if (existingVar) {
      const newPrice = v.price_override ?? 0;
      if (existingVar.price !== newPrice) {
        historyPromises.push(
          prisma.priceHistory.create({
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
          prisma.stockHistory.create({
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

    await prisma.inventoryVariant.upsert({
      where: { productId_attributeValue: { productId, attributeValue: v.attribute_value } },
      update: { price: v.price_override ?? 0, stock: v.stock, ...(variantSku ? { sku: variantSku } : {}) },
      create: { productId, attributeValue: v.attribute_value, price: v.price_override ?? 0, stock: v.stock, sku: variantSku }
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
  const historyPromises: Promise<any>[] = [];

  // Load business type once to know whether the availability toggle applies.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { businessType: true },
  });
  const isRestaurant = company?.businessType === "RESTAURANT";

  for (const product of products) {
    const productName = buildProductName(product);
    const hasVariants = product.variants && product.variants.length > 0;
    // Availability toggle only meaningful for restaurants; default true otherwise.
    const isAvailable = isRestaurant ? (product.isAvailable ?? true) : true;

    // Dedup check: find existing product by company + name
    const existing = await prisma.inventoryProduct.findUnique({
      where: { companyId_name: { companyId, name: productName } }
    });

    let productId: string;
    let productSku: string | null = null;

    if (existing) {
      // Update existing product — only update SKU if explicitly provided
      productSku = product.sku ?? existing.sku;
      const newPrice = product.price_inr ?? existing.basePrice;
      
      if (existing.basePrice !== newPrice) {
        historyPromises.push(
          prisma.priceHistory.create({
            data: {
              productId: existing.id,
              oldPrice: existing.basePrice,
              newPrice: newPrice,
              actorName: "System Ingestion"
            }
          })
        );
      }

      await prisma.inventoryProduct.update({
        where: { id: existing.id },
        data: {
          basePrice: newPrice,
          hasVariants,
          variantAttributeName: product.attribute_name,
          description: product.description ?? existing.description,
          isAvailable,
          ...(product.sku !== undefined ? { sku: product.sku } : {}),
          ...(product.categories !== undefined ? { categories: product.categories } : {}),
        }
      });
      productId = existing.id;
    } else {
      // Create new product — auto-generate SKU if not provided
      const baseSku = product.sku || generateBaseSku(productName);
      productSku = await ensureSkuUnique(companyId, baseSku);
      const newProduct = await prisma.inventoryProduct.create({
        data: {
          companyId,
          name: productName,
          description: product.description,
          basePrice: product.price_inr ?? 0,
          hasVariants,
          variantAttributeName: product.attribute_name,
          isAvailable,
          sku: productSku,
          categories: product.categories || [],
        }
      });
      productId = newProduct.id;
    }

    // Upsert variants
    if (hasVariants) {
      await upsertVariants(productId, product.variants, productSku, historyPromises);
    }

    // Also maintain KnowledgeChunk for RAG retrieval backward compatibility
    const content = formatProductForKnowledgeChunk(product);
    const embedding = await embedText(content);
    const embeddingLiteral = `[${embedding.join(",")}]`;
    // Use the InventoryProduct UUID as sourceId so PRODUCT knowledge chunks
    // can be resolved back to the live InventoryProduct + variant stock.
    const sourceId = productId;
    const now = new Date();
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

    createdIds.push(productId);
  }

  // Execute history log writes asynchronously and non-blocking
  if (historyPromises.length > 0) {
    Promise.allSettled(historyPromises).then((results) => {
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.error(`❌ [InventoryHistory] Failed to write history row at index ${i}:`, res.reason);
        }
      });
    }).catch(err => {
      console.error("❌ [InventoryHistory] Promise.allSettled critical error:", err);
    });
  }

  return { count: createdIds.length, ids: createdIds };
}

/**
 * Generate deterministic signature for sourceId when no SKU exists.
 * Used for deduplication via ON CONFLICT on KnowledgeChunk.
 */
function generateProductSignature(product: ProductData): string {
  const brand = (product.brand || "").toLowerCase().trim();
  
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
  if (product.brand) parts.push(`Brand: ${product.brand}`);
  if (product.description) parts.push(`Description: ${product.description}`);
  parts.push(`Product: ${product.product_type}`);
  if (product.categories && product.categories.length > 0) {
    parts.push(`Categories: ${product.categories.join(", ")}`);
  }
  if (product.attribute_name && product.variants && product.variants.length > 0) {
    const variantValues = product.variants.map(v => v.attribute_value).join(", ");
    parts.push(`${product.attribute_name}: ${variantValues}`);
  }
  if (product.price_inr !== null) parts.push(`Price: ₹${product.price_inr}`);

  return parts.join(", ");
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
export async function decrementStockForOrder(orderId: string, companyId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true }
  });
  if (!order || !order.orderItems.length) return;

  for (const item of order.orderItems) {
    let product = item.sku
      ? await (prisma.inventoryProduct as any).findFirst({
          where: { companyId, sku: item.sku, isActive: true }
        })
      : null;

    if (!product) {
      product = await (prisma.inventoryProduct as any).findFirst({
        where: { companyId, name: { equals: item.name, mode: "insensitive" }, isActive: true }
      });
    }

    if (!product || !product.hasVariants) continue;

    const allVariants: any[] = await (prisma.inventoryVariant as any).findMany({
      where: { productId: product.id, isActive: true }
    });
    if (!allVariants.length) continue;

    let targetVariant: any = null;

    // 1. Direct variant ID match (payment-request stores variant.id in item.sku)
    if (item.sku) {
      targetVariant = allVariants.find((v: any) => v.id === item.sku);
    }

    // 2. Attribute value as whole word in item name (word-boundary, avoids false positives)
    if (!targetVariant) {
      targetVariant = allVariants.find((v: any) => {
        const escaped = v.attributeValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(item.name);
      });
    }

    // 3. Fallback: pick variant with same price as OrderItem (if unique)
    if (!targetVariant) {
      const samePrice = allVariants.filter((v: any) => v.price === item.price);
      if (samePrice.length === 1) {
        targetVariant = samePrice[0];
      }
    }

    // 4. Last resort: most-stocked variant (triggers only when all above fail)
    if (!targetVariant) {
      targetVariant = allVariants.sort((a: any, b: any) => (b.stock ?? -1) - (a.stock ?? -1))[0];
      console.warn(`⚠️ [StockDecrement] FALLBACK: No variant match for order ${orderId}, item "${item.name}" (qty ${item.quantity}). Using most-stocked variant "${targetVariant?.attributeValue}" (id: ${targetVariant?.id}). Product "${product.name}" has ${allVariants.length} variants: [${allVariants.map((v: any) => v.attributeValue).join(", ")}].`);
    }

    if (!targetVariant || targetVariant.stock === null || targetVariant.stock === undefined) continue;

    const newStock = Math.max(0, targetVariant.stock - item.quantity);
    await (prisma.inventoryVariant as any).update({
      where: { id: targetVariant.id },
      data: { stock: newStock }
    });

    // Write to StockHistory table
    try {
      await prisma.stockHistory.create({
        data: {
          productId: product.id,
          variantId: targetVariant.id,
          oldStock: targetVariant.stock,
          newStock: newStock,
          actorName: `Order ${order.id}`
        }
      });
    } catch (historyErr) {
      console.error("❌ [StockDecrement] Failed to write StockHistory row:", historyErr);
    }

    console.log(`📦 [StockDecrement] Variant ${targetVariant.id} ("${targetVariant.attributeValue}"): ${targetVariant.stock} → ${newStock} (ordered ${item.quantity})`);
  }
}
