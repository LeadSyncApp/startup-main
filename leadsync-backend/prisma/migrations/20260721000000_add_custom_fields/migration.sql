-- Migration: add_custom_fields
-- Adds CompanyFieldDefinition model, and customFieldValues/attributes JSON columns
-- to InventoryProduct and InventoryVariant respectively.

-- 1. Create CompanyFieldDefinition table
CREATE TABLE "CompanyFieldDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanyFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- 2. Create indexes for CompanyFieldDefinition
CREATE INDEX "CompanyFieldDefinition_companyId_idx" ON "CompanyFieldDefinition"("companyId");
CREATE INDEX "CompanyFieldDefinition_companyId_appliesTo_idx" ON "CompanyFieldDefinition"("companyId", "appliesTo");

-- 3. Add foreign key from CompanyFieldDefinition to Company
ALTER TABLE "CompanyFieldDefinition" ADD CONSTRAINT "CompanyFieldDefinition_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Add customFieldValues JSON column to InventoryProduct
ALTER TABLE "InventoryProduct" ADD COLUMN "customFieldValues" JSONB;

-- 5. Add attributes JSON column to InventoryVariant
ALTER TABLE "InventoryVariant" ADD COLUMN "attributes" JSONB;
