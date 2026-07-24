-- AlterTable: Add nullable SKU columns (additive, zero-downtime)
ALTER TABLE "InventoryProduct" ADD COLUMN "sku" TEXT;
ALTER TABLE "InventoryVariant" ADD COLUMN "sku" TEXT;

-- CreateIndex: Unique SKU per company (NULLs are distinct in PostgreSQL, so existing rows are safe)
CREATE UNIQUE INDEX "InventoryProduct_companyId_sku_key" ON "InventoryProduct"("companyId", "sku");
