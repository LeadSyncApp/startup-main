/**
 * Inventory Routes
 * 
 * GET /companies/:id/inventory - List saved inventory products
 * POST /companies/:id/inventory/parse - Parse free-text inventory, returns structured products
 * POST /companies/:id/inventory/confirm - Persist confirmed products to KnowledgeChunk
 */

import { Router } from "express";
import { parseInventoryText, confirmInventoryProducts, ProductData } from "../../services/knowledge/inventory.service";
import { prisma } from "../../lib/prisma";

const router = Router();

/**
 * GET /companies/:id/inventory
 * 
 * Returns all saved PRODUCT-type KnowledgeChunks for a company.
 * Parses content field back into ProductData structure for consistency.
 */
router.get("/:id/inventory", async (req, res) => {
  const { id: companyId } = req.params;

  try {
    // Fetch all PRODUCT KnowledgeChunks for this company
    const knowledgeChunks = await prisma.$queryRaw<Array<{ id: string; content: string; sourceId: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }>>`
      SELECT "id", "content", "sourceId", "isActive", "createdAt", "updatedAt"
      FROM "KnowledgeChunk"
      WHERE "companyId" = ${companyId}
        AND "sourceType" = 'PRODUCT'::"KnowledgeSourceType"
        AND "isActive" = true
      ORDER BY "createdAt" DESC
    `;

    // Parse content back to product data for frontend consistency
    const savedProducts = knowledgeChunks.map((kc) => {
      const content = kc.content;
      
      // Parse "Brand: X, Product: Y, Colors: A, B, Sizes: A, B, Price: ₹Z" format
      const parts = content.split(", ");
      let brand: string | null = null;
      let product_type = "";
      let colors: string[] = [];
      let sizes: string[] = [];
      let price_inr: number | null = null;

      for (const part of parts) {
        if (part.startsWith("Brand: ")) {
          brand = part.substring(7);
        } else if (part.startsWith("Product: ")) {
          product_type = part.substring(9);
        } else if (part.startsWith("Colors: ")) {
          colors = part.substring(8).split(",").map((c: string) => c.trim());
        } else if (part.startsWith("Sizes: ")) {
          sizes = part.substring(7).split(",").map((s: string) => s.trim());
        } else if (part.startsWith("Price: ₹")) {
          const priceStr = part.substring(8);
          const match = priceStr.match(/(\d+)/);
          if (match) price_inr = parseInt(match[1], 10);
        }
      }

      return {
        id: kc.id,
        sourceId: kc.sourceId,
        brand,
        product_type,
        colors,
        sizes,
        price_inr,
        isActive: kc.isActive,
        createdAt: kc.createdAt,
        updatedAt: kc.updatedAt
      };
    });

    res.json({ 
      products: savedProducts,
      count: savedProducts.length 
    });
  } catch (error: any) {
    console.error("[InventoryRoutes] List error:", error);
    res.status(500).json({
      error: "Failed to fetch inventory products",
      details: error.message
    });
  }
});

/**
 * POST /companies/:id/inventory/parse
 * 
 * Groq-based parsing of free-text inventory descriptions.
 * Returns structured products array without persisting.
 */
router.post("/:id/inventory/parse", async (req, res) => {
  const { id: companyId } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      error: "Invalid request: 'text' field is required and must be a string"
    });
  }

  try {
    const result = await parseInventoryText(companyId, text);
    res.json(result);
  } catch (error: any) {
    console.error("[InventoryRoutes] Parse error:", error);
    res.status(500).json({
      error: "Failed to parse inventory text",
      details: error.message
    });
  }
});

/**
 * POST /companies/:id/inventory/confirm
 * 
 * Persist confirmed/edited products to KnowledgeChunk.
 * Uses replace-and-regenerate per product.
 */
router.post("/:id/inventory/confirm", async (req, res) => {
  const { id: companyId } = req.params;
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({
      error: "Invalid request: 'products' field must be an array"
    });
  }

  try {
    const result = await confirmInventoryProducts(companyId, products as ProductData[]);
    res.json({
      message: `Successfully confirmed ${result.count} products`,
      ids: result.ids
    });
  } catch (error: any) {
    console.error("[InventoryRoutes] Confirm error:", error);
    res.status(500).json({
      error: "Failed to confirm products",
      details: error.message
    });
  }
});

export default router;