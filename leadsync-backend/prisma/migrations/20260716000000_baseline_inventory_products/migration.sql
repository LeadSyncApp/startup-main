-- Baseline InventoryProduct and InventoryVariant tables
-- Created to document their structure prior to July 17, 2026, allowing shadow database to replay migrations cleanly.

CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "variantAttributeName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeValue" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryProduct_companyId_name_key" ON "InventoryProduct"("companyId", "name");
CREATE INDEX "InventoryProduct_companyId_idx" ON "InventoryProduct"("companyId");
CREATE INDEX "InventoryProduct_companyId_isActive_idx" ON "InventoryProduct"("companyId", "isActive");

CREATE UNIQUE INDEX "InventoryVariant_productId_attributeValue_key" ON "InventoryVariant"("productId", "attributeValue");
CREATE INDEX "InventoryVariant_productId_idx" ON "InventoryVariant"("productId");

ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryVariant" ADD CONSTRAINT "InventoryVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
