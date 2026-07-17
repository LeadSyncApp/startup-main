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
 * Upsert variants for a product, removing stale ones
 */
async function upsertVariants(productId: string, variants: ProductVariantData[]) {
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
    await prisma.inventoryVariant.upsert({
      where: { productId_attributeValue: { productId, attributeValue: v.attribute_value } },
      update: { price: v.price_override ?? 0, stock: v.stock },
      create: { productId, attributeValue: v.attribute_value, price: v.price_override ?? 0, stock: v.stock }
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
    const productName = buildProductName(product);
    const hasVariants = product.variants && product.variants.length > 0;
    // Availability toggle only meaningful for restaurants; default true otherwise.
    const isAvailable = isRestaurant ? (product.isAvailable ?? true) : true;

    // Dedup check: find existing product by company + name
    const existing = await prisma.inventoryProduct.findUnique({
      where: { companyId_name: { companyId, name: productName } }
    });

    let productId: string;

    if (existing) {
      // Update existing product
      await prisma.inventoryProduct.update({
        where: { id: existing.id },
        data: {
          basePrice: product.price_inr ?? existing.basePrice,
          hasVariants,
          variantAttributeName: product.attribute_name,
          description: product.description ?? existing.description,
          isAvailable,
        }
      });
      productId = existing.id;
    } else {
      // Create new product
      const newProduct = await prisma.inventoryProduct.create({
        data: {
          companyId,
          name: productName,
          description: product.description,
          basePrice: product.price_inr ?? 0,
          hasVariants,
          variantAttributeName: product.attribute_name,
          isAvailable,
        }
      });
      productId = newProduct.id;
    }

    // Upsert variants
    if (hasVariants) {
      await upsertVariants(productId, product.variants);
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

  if (product.brand) parts.push(`Brand: ${product.brand}`);
  if (product.description) parts.push(`Description: ${product.description}`);
  parts.push(`Product: ${product.product_type}`);
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
        { category: { contains: searchTerm, mode: "insensitive" } },
      ]
    },
    include: { variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return products;
}

/**
 * Get all active inventory products for a company
 */
export async function getInventoryProducts(companyId: string) {
  return prisma.inventoryProduct.findMany({
    where: { companyId, isActive: true },
    include: { variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
}
