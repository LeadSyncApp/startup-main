-- Migration: 20260725000000_add_multi_dimensional_variants
-- Multi-Dimensional Variant Schema Upgrade & Backfill
-- Wrap entire migration in a single atomic transaction block

BEGIN;

-- 1. Add variantAttributeNames column to InventoryProduct
ALTER TABLE "InventoryProduct" ADD COLUMN IF NOT EXISTS "variantAttributeNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Add check constraint enforcing hard cap of max 3 variant dimensions
ALTER TABLE "InventoryProduct" DROP CONSTRAINT IF EXISTS "check_max_3_variant_dimensions";
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "check_max_3_variant_dimensions" 
CHECK (cardinality("variantAttributeNames") <= 3);

-- 3. Non-destructive backfill for InventoryProduct:
-- Populate variantAttributeNames from single-dimension variantAttributeName if array is empty
UPDATE "InventoryProduct"
SET "variantAttributeNames" = ARRAY["variantAttributeName"]
WHERE "variantAttributeName" IS NOT NULL 
  AND "variantAttributeName" != '' 
  AND (cardinality("variantAttributeNames") IS NULL OR cardinality("variantAttributeNames") = 0);

-- 4. Non-destructive backfill for InventoryVariant:
-- Populate attributes JSON column from existing variantAttributeName + attributeValue if attributes is NULL or empty
UPDATE "InventoryVariant" v
SET "attributes" = jsonb_build_object(
  COALESCE(NULLIF(p."variantAttributeName", ''), 'Option'),
  v."attributeValue"
)
FROM "InventoryProduct" p
WHERE v."productId" = p."id" 
  AND (v."attributes" IS NULL OR v."attributes" = '{}'::jsonb)
  AND v."attributeValue" IS NOT NULL;

-- 5. Deterministic JSONB-key-order-safe unique index
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryVariant_productId_attributes_md5_key"
ON "InventoryVariant" ("productId", md5((COALESCE("attributes", '{}'::jsonb))::text));

COMMIT;
