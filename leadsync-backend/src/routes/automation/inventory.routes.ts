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
import { z } from "zod";
import {
  parseInventoryText,
  confirmInventoryProducts,
  searchInventoryProducts,
  getInventoryProducts,
  ProductData
} from "../../services/knowledge/inventory.service";
import { prisma } from "../../lib/prisma";
import { authMiddleware, AuthRequest, requireTenantAccess } from "../../middleware/auth.middleware";
import { can } from "../../services/auth/permissions.service";
import multer from "multer";
import { supabase } from "../../lib/supabase";
import { invalidateChunkCache } from "../../services/knowledge/chunkCache";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  }
});

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const confirmVariantSchema = z.object({
  price_override: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().nullable(),
}).passthrough();

const confirmProductSchema = z.object({
  product_type: z.string().trim().min(1, "Product type is required"),
  price_inr: z.number().nonnegative("Price must not be negative").nullable(),
  variants: z.array(confirmVariantSchema).default([]),
  categories: z.array(z.string().min(1, "Category cannot be empty")).optional(),
}).passthrough();

/**
 * GET /companies/:id/inventory
 * 
 * Returns all active InventoryProduct records with nested variants.
 * Optional query param: ?categories=X,Y — filter by any of the given categories (AND logic for array overlap).
 */
router.get("/:id/inventory", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId } = req.params;
  const { categories } = req.query;

  try {
    const products = await getInventoryProducts(companyId, categories as string | undefined);
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
router.get("/:id/inventory/search", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
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
router.post("/:id/inventory/check-duplicates", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId } = req.params;
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "'products' must be an array" });
  }

  try {
    // Batch-fetch all potential duplicates in one query instead of N individual findUnique calls
    const names = products.map((p: any) => p.product_type).filter(Boolean);
    const existing = await prisma.inventoryProduct.findMany({
      where: { companyId, name: { in: names } },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existing.map(e => [e.name, e.id]));
    const duplicates = products
      .filter((p: any) => existingByName.has(p.product_type))
      .map((p: any) => ({ name: p.product_type, existingId: existingByName.get(p.product_type)! }));

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
router.post("/:id/inventory/parse", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId } = req.params;
  const { text, language } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      error: "Invalid request: 'text' field is required and must be a string"
    });
  }

  try {
    const result = await parseInventoryText(companyId, text, language || "English");
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
router.post("/:id/inventory/confirm", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId } = req.params;
  if (!can(req.user, "inventory.manage")) return res.status(403).json({ error: "Access denied: Requires inventory.manage permission" });
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({
      error: "Invalid request: 'products' field must be an array"
    });
  }

  for (const [index, product] of products.entries()) {
    const parsed = confirmProductSchema.safeParse(product);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Product validation failed",
        details: parsed.error.issues.map(issue => ({
          productIndex: index,
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }
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

/**
 * DELETE /companies/:id/inventory/:productId
 * 
 * Soft-deletes a product by setting isActive = false, and also deactivates 
 * the corresponding KnowledgeChunk (sourceType = 'PRODUCT') so it's removed from RAG search.
 */
router.delete("/:id/inventory/:productId", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId, productId } = req.params;
  if (!can(req.user, "inventory.manage")) return res.status(403).json({ error: "Access denied: Requires inventory.manage permission" });

  try {
    // 1. Verify product belongs to the requested company (tenant check)
    const existingProduct = await prisma.inventoryProduct.findFirst({
      where: { id: productId, companyId }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found or access denied" });
    }

    // 2. Soft-delete the product
    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { isActive: false }
    });

    // 3. Deactivate associated KnowledgeChunks
    await prisma.knowledgeChunk.updateMany({
      where: {
        companyId,
        sourceType: "PRODUCT",
        sourceId: productId
      },
      data: { isActive: false }
    });

    // 4. Invalidate in-memory knowledge chunk cache
    invalidateChunkCache(companyId);

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("[InventoryRoutes] Delete error:", error);
    res.status(500).json({
      error: "Failed to delete product",
      details: error.message
    });
  }
});

/**
 * POST /companies/:id/inventory/:productId/images
 * Upload an image for a product
 */
router.post(
  "/:id/inventory/:productId/images",
  authMiddleware,
  requireTenantAccess,
  upload.single("image"),
  async (req: AuthRequest, res) => {
    const { id: companyId, productId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    try {
      const product = await prisma.inventoryProduct.findFirst({
        where: { id: productId, companyId }
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found or access denied" });
      }

      const existingCount = await prisma.productImage.count({
        where: { productId }
      });
      if (existingCount >= 10) {
        return res.status(400).json({ error: "Maximum limit of 10 images reached" });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Storage client not initialized" });
      }

      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const exists = buckets?.some(b => b.name === "product-images");
        if (!exists) {
          await supabase.storage.createBucket("product-images", { public: true });
        }
      } catch (err) {
        console.error("Failed to check/create bucket:", err);
      }

      const fileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `products/${companyId}/${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const nextOrder = existingCount;
      const newImage = await prisma.productImage.create({
        data: {
          productId,
          url: publicUrl,
          order: nextOrder
        }
      });

      if (nextOrder === 0) {
        await prisma.inventoryProduct.update({
          where: { id: productId },
          data: { imageUrl: publicUrl }
        });
      }

      res.status(201).json({ image: newImage });
    } catch (error: any) {
      console.error("[InventoryRoutes] Image upload error:", error);
      res.status(500).json({ error: "Failed to upload image", details: error.message });
    }
  }
);

/**
 * DELETE /companies/:id/inventory/:productId/images/:imageId
 * Delete an image
 */
router.delete("/:id/inventory/:productId/images/:imageId", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId, productId, imageId } = req.params;

  try {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { companyId } }
    });
    if (!image) {
      return res.status(404).json({ error: "Image not found or access denied" });
    }

    if (supabase) {
      const urlParts = image.url.split("/product-images/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("product-images").remove([filePath]);
      }
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    const remainingImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { order: "asc" }
    });

    let newImageUrl: string | null = null;
    if (remainingImages.length > 0) {
      newImageUrl = remainingImages[0].url;
      // Batch reindex: use a single transaction with independent updates
      await prisma.$transaction(
        remainingImages.map((img, i) =>
          prisma.productImage.update({
            where: { id: img.id },
            data: { order: i }
          })
        )
      );
    }

    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { imageUrl: newImageUrl }
    });

    res.json({ success: true, message: "Image deleted successfully" });
  } catch (error: any) {
    console.error("[InventoryRoutes] Image delete error:", error);
    res.status(500).json({ error: "Failed to delete image", details: error.message });
  }
});

/**
 * POST /companies/:id/inventory/:productId/images/reorder
 * Reorder image gallery
 */
router.post("/:id/inventory/:productId/images/reorder", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId, productId } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds)) {
    return res.status(400).json({ error: "imageIds must be an array of strings" });
  }

  try {
    const product = await prisma.inventoryProduct.findFirst({
      where: { id: productId, companyId }
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found or access denied" });
    }

    await prisma.$transaction(
      imageIds.map((id, index) =>
        prisma.productImage.update({
          where: { id, productId },
          data: { order: index }
        })
      )
    );

    const primaryImage = await prisma.productImage.findFirst({
      where: { productId, order: 0 },
      select: { url: true }
    });
    await prisma.inventoryProduct.update({
      where: { id: productId },
      data: { imageUrl: primaryImage?.url || null }
    });

    res.json({ success: true, message: "Images reordered successfully" });
  } catch (error: any) {
    console.error("[InventoryRoutes] Image reorder error:", error);
    res.status(500).json({ error: "Failed to reorder images", details: error.message });
  }
});

/**
 * GET /companies/:id/inventory/:productId/history
 * Fetch price and stock history logs for a product
 */
router.get("/:id/inventory/:productId/history", authMiddleware, requireTenantAccess, async (req: AuthRequest, res) => {
  const { id: companyId, productId } = req.params;

  try {
    const product = await prisma.inventoryProduct.findFirst({
      where: { id: productId, companyId }
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found or access denied" });
    }

    const priceHistory = await prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { changedAt: "desc" }
    });

    const stockHistory = await prisma.stockHistory.findMany({
      where: { productId },
      orderBy: { changedAt: "desc" }
    });

    res.json({ priceHistory, stockHistory });
  } catch (error: any) {
    console.error("[InventoryRoutes] Get history error:", error);
    res.status(500).json({ error: "Failed to fetch history", details: error.message });
  }
});

export default router;

