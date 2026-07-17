/**
 * Inventory Routes
 * 
 * GET /companies/:id/inventory - List saved inventory products
 * GET /companies/:id/inventory/search - Search products for in-chat picker
 * POST /companies/:id/inventory/parse - Parse free-text inventory, returns structured products
 * POST /companies/:id/inventory/confirm - Persist confirmed products to InventoryProduct + KnowledgeChunk
 * POST /companies/:id/inventory/check-duplicates - Check for duplicate products before save
 * GET /inventory/search - Auth-protected search (uses JWT companyId)
 */

import { Router } from "express";
import {
  parseInventoryText,
  confirmInventoryProducts,
  searchInventoryProducts,
  getInventoryProducts,
  ProductData
} from "../../services/knowledge/inventory.service";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

/**
 * GET /companies/:id/inventory
 * 
 * Returns all active InventoryProduct records with nested variants.
 */
router.get("/:id/inventory", async (req, res) => {
  const { id: companyId } = req.params;

  try {
    const products = await getInventoryProducts(companyId);
    res.json({ products, count: products.length });
  } catch (error: any) {
    console.error("[InventoryRoutes] List error:", error);
    res.status(500).json({
      error: "Failed to fetch inventory products",
      details: error.message
    });
  }
});

/**
 * GET /companies/:id/inventory/search
 * 
 * Search products by name or category for the in-chat product picker.
 */
router.get("/:id/inventory/search", async (req, res) => {
  const { id: companyId } = req.params;
  const { q } = req.query;
  const searchTerm = (q as string || "").trim();

  if (!searchTerm) {
    return res.json({ products: [] });
  }

  try {
    const products = await searchInventoryProducts(companyId, searchTerm);
    res.json({ products });
  } catch (error: any) {
    console.error("[InventoryRoutes] Search error:", error);
    res.status(500).json({
      error: "Failed to search inventory products",
      details: error.message
    });
  }
});

/**
 * POST /companies/:id/inventory/check-duplicates
 * 
 * Check if any of the submitted products already exist (by name).
 */
router.post("/:id/inventory/check-duplicates", async (req, res) => {
  const { id: companyId } = req.params;
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "'products' must be an array" });
  }

  try {
    const duplicates: Array<{ name: string; existingId: string }> = [];

    for (const product of products) {
      const brand = (product.brand || "").trim();
      const name = brand ? `${brand} ${product.product_type}`.trim() : product.product_type;

      const existing = await prisma.inventoryProduct.findUnique({
        where: { companyId_name: { companyId, name } },
        select: { id: true, name: true }
      });

      if (existing) {
        duplicates.push({ name: existing.name, existingId: existing.id });
      }
    }

    res.json({ duplicates });
  } catch (error: any) {
    console.error("[InventoryRoutes] Check duplicates error:", error);
    res.status(500).json({ error: "Failed to check duplicates" });
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
 * Persist confirmed/edited products to InventoryProduct + InventoryVariant.
 * Also maintains KnowledgeChunk for RAG backward compatibility.
 * Deduplicates by product name.
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

/**
 * GET /inventory/search (auth-protected)
 * 
 * Search products by name or category for the in-chat product picker.
 * Uses JWT companyId instead of URL param.
 */
router.get("/search", authMiddleware, async (req: AuthRequest, res) => {
  const companyId = req.user?.companyId;
  const { q } = req.query;
  const searchTerm = (q as string || "").trim();

  if (!companyId) {
    return res.status(401).json({ error: "No company context" });
  }

  if (!searchTerm) {
    try {
      const products = await prisma.inventoryProduct.findMany({
        where: { companyId, isActive: true },
        include: { variants: { where: { isActive: true }, orderBy: { attributeValue: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 20
      });
      return res.json({ products });
    } catch (error: any) {
      console.error("[InventoryRoutes] Default load error:", error);
      return res.status(500).json({ error: "Failed to load default products" });
    }
  }

  try {
    const products = await searchInventoryProducts(companyId, searchTerm);
    res.json({ products });
  } catch (error: any) {
    console.error("[InventoryRoutes] Search error:", error);
    res.status(500).json({
      error: "Failed to search inventory products",
      details: error.message
    });
  }
});

export default router;
