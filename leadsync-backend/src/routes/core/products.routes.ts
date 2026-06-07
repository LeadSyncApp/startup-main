import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// GET /api/v1/products - List all catalog products
router.get("/", authMiddleware, async (req: any, res: any) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        let products = await prisma.product.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
        });

        // 🚨 Migration for previous items that were stored in botStructuredMenu
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { botConfiguration: true }
        });

        const structuredMenu = company?.botConfiguration?.botStructuredMenu as any;
        if (structuredMenu && structuredMenu.categories && Array.isArray(structuredMenu.categories)) {
            console.log(`[Products GET] Found legacy structured menu for company ${companyId}. Categories: ${structuredMenu.categories.length}`);
            
            const productsToCreate = structuredMenu.categories.flatMap((cat: any) => 
                (cat.items || []).map((item: any) => ({
                    companyId,
                    name: item.name || "Unknown Item",
                    price: parseFloat(item.price) || 0,
                    category: cat.name || "Uncategorized",
                    stockQuantity: 999,
                    trackInventory: true,
                    isActive: true,
                }))
            );

            if (productsToCreate.length > 0) {
                try {
                    console.log(`[Products GET] Migrating ${productsToCreate.length} legacy items to Product table...`);
                    
                    // Transactional migration
                    await prisma.$transaction(async (tx) => {
                        // 1. Create the products, skipping duplicates (based on sku/companyId unique index)
                        // Note: Our migration items have sku: null, so skipDuplicates will work 
                        // if the DB handles multiple nulls correctly, OR we can avoid adding if matching name exists.
                        const existingNames = new Set(products.map(p => p.name.toLowerCase()));
                        const uniqueNewProducts = productsToCreate.filter((p: any) => !existingNames.has(p.name.toLowerCase()));

                        if (uniqueNewProducts.length > 0) {
                            await tx.product.createMany({
                                data: uniqueNewProducts,
                                skipDuplicates: true
                            });
                        }

                        // 2. Clear the legacy menu so we never migrate it again
                        if (company?.botConfiguration?.id) {
                            await tx.botConfiguration.update({
                                where: { id: company.botConfiguration.id },
                                data: { botStructuredMenu: Prisma.DbNull }
                            });
                        }
                    });

                    console.log(`[Products GET] Migration successful for company ${companyId}`);
                    
                    // Refetch products after migration
                    const finalProducts = await prisma.product.findMany({
                        where: { companyId },
                        orderBy: { createdAt: "desc" },
                    });
                    return res.json(finalProducts);
                } catch (migrationError: any) {
                    console.error("[Products GET] Migration failed:", migrationError);
                    // Return what we have already instead of 500
                    return res.json(products);
                }
            }
        }

        res.json(products);
    } catch (error: any) {
        console.error("[Products GET] Error details:", {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });
        res.status(500).json({ 
            error: "Failed to fetch products",
            details: error.message,
            code: error.code
        });
    }
});

// POST /api/v1/products - Create a new product in the catalog
router.post("/", authMiddleware, async (req: any, res: any) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: "Unauthorized" });

        const { name, description, price, category, stockQuantity, trackInventory } = req.body;

        const product = await prisma.product.create({
            data: {
                companyId,
                name: name || "Unnamed Product",
                description: description || "",
                price: Number(price) || 0,
                category: category || "Uncategorized",
                stockQuantity: Number(stockQuantity) || 0,
                trackInventory: Boolean(trackInventory),
            },
        });

        res.status(201).json(product);
    } catch (error: any) {
        console.error("[Products POST] Error details:", {
            message: error.message,
            code: error.code,
            meta: error.meta,
        });
        res.status(500).json({ 
            error: "Failed to create product", 
            details: error.message,
            code: error.code 
        });
    }
});

// PUT /api/v1/products/:id - Update product
router.put("/:id", authMiddleware, async (req: any, res: any) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        if (!companyId) return res.status(401).json({ error: "Unauthorized" });

        const { name, description, price, category, stockQuantity, trackInventory } = req.body;

        const product = await prisma.product.updateMany({
            where: { id, companyId },
            data: {
                name,
                description,
                price: Number(price) || 0,
                category,
                stockQuantity: Number(stockQuantity) || 0,
                trackInventory: Boolean(trackInventory),
            },
        });

        res.json(product);
    } catch (error) {
        console.error("[Products PUT] Error:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// DELETE /api/v1/products/:id - Delete product
router.delete("/:id", authMiddleware, async (req: any, res: any) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        if (!companyId) return res.status(401).json({ error: "Unauthorized" });

        await prisma.product.deleteMany({
            where: { id, companyId },
        });

        res.json({ message: "Product deleted" });
    } catch (error) {
        console.error("[Products DELETE] Error:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

export default router;
