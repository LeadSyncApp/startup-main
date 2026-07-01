import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { authMiddleware, injectTenantContext, AuthRequest } from "../../middleware/auth.middleware";

const router = Router();

// GET /api/products - List all catalog products
router.get("/", authMiddleware, injectTenantContext, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ message: "No company context" });
        console.log(`[Products GET] Fetching for company: ${companyId}`);

        const products = await req.tenantDb!.product.findMany({
            where: { companyId, isActive: true },
            orderBy: { createdAt: "desc" },
        });

        console.log(`[Products GET] Found ${products.length} products for company ${companyId}`);
        res.json(products);
    } catch (error: any) {
        console.error("[Products GET] Error:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// GET /api/products/categories - Get unique list of product categories
router.get("/categories", authMiddleware, injectTenantContext, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ message: "No company context" });

        const products = await req.tenantDb!.product.findMany({
            where: { companyId, isActive: true },
            select: { category: true },
            distinct: ["category"],
        });
        const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))].sort();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

// POST /api/products/seed - Seed demo products
router.post("/seed", authMiddleware, injectTenantContext, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ message: "No company context" });
        
        console.log(`[Products SEED] Starting for company: ${companyId}`);

        // Scoped check by companyId so we don't accidentally check global products count
        const existingCount = await req.tenantDb!.product.count({
            where: { companyId }
        });
        console.log(`[Products SEED] Existing count for company ${companyId}: ${existingCount}`);

        if (existingCount > 0) {
        const existing = await req.tenantDb!.product.findMany({
                where: { companyId, isActive: true },
                orderBy: { name: "asc" }
            });
            return res.json({ message: "Catalog already present", count: existingCount, products: existing });
        }

        const demoProducts = [
            { name: "Saree - Banarasi Silk", price: 12500, sku: "BSR-001", stockQuantity: 10, trackInventory: true, category: "Sari", isActive: true, companyId },
            { name: "Kurti - Chanderi Silk", price: 3200, sku: "CSK-002", stockQuantity: 25, trackInventory: true, category: "Kurti", isActive: true, companyId },
            { name: "Scarf - Handcrafted Silk", price: 850, sku: "HSS-003", stockQuantity: 50, trackInventory: true, category: "Accessories", isActive: true, companyId },
            { name: "Saree - Kanchipuram Pattu", price: 21000, sku: "KPP-004", stockQuantity: 5, trackInventory: true, category: "Sari", isActive: true, companyId },
        ];

        console.log(`[Products SEED] Creating ${demoProducts.length} items...`);
        
        await req.tenantDb!.product.createMany({
            data: demoProducts,
            skipDuplicates: true
        });

        console.log(`[Products SEED] Success`);
        const allProducts = await req.tenantDb!.product.findMany({
            where: { companyId, isActive: true },
            orderBy: { createdAt: "desc" }
        });
        res.json({ message: "Seeded", products: allProducts });
    } catch (error: any) {
        console.error("[Products SEED] Error:", error);
        res.status(500).json({ message: "Seed failed", error: error.message });
    }
});

// DELETE /api/products/clear - Wipe all products
router.delete("/clear", authMiddleware, injectTenantContext, async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ message: "No company context" });

        console.log(`[Products CLEAR] Wiping for company: ${companyId}`);
        await req.tenantDb!.product.deleteMany({
            where: { companyId }
        });

        res.json({ message: "Catalog cleared successfully" });
    } catch (error: any) {
        console.error("[Products CLEAR] Error:", error);
        res.status(500).json({ error: "Failed to clear catalog" });
    }
});

export default router;
