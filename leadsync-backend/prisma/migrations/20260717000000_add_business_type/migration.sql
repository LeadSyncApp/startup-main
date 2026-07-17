-- Migration: Add BusinessType enum + businessType on Company, isAvailable on InventoryProduct
-- Also backfills existing companies from the legacy botBusinessType string field.

-- 1. Create the enum type
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'RESTAURANT', 'SERVICES');

-- 2. Add the new typed column (nullable so backfill can run first)
ALTER TABLE "Company" ADD COLUMN "businessType" "BusinessType";

-- 3. Backfill: map legacy botBusinessType string -> enum.
--    Mapping:
--      "Fashion & Retail"      -> RETAIL
--      "Bakery & Food"         -> RESTAURANT
--      "Café & Food Outlet"     -> RESTAURANT
--      "F&B Outlet"            -> RESTAURANT
--      "Client Agency"         -> SERVICES
--      "Service / Clinic"      -> SERVICES
--      "Retail"                -> RETAIL (legacy OnboardingForm value)
--    Everything else / null    -> RETAIL (safest default for the existing free-text field)
UPDATE "Company"
SET "businessType" = CASE "botBusinessType"
  WHEN 'Fashion & Retail' THEN 'RETAIL'::"BusinessType"
  WHEN 'Bakery & Food'    THEN 'RESTAURANT'::"BusinessType"
  WHEN 'Café & Food Outlet' THEN 'RESTAURANT'::"BusinessType"
  WHEN 'F&B Outlet'       THEN 'RESTAURANT'::"BusinessType"
  WHEN 'Client Agency'    THEN 'SERVICES'::"BusinessType"
  WHEN 'Service / Clinic' THEN 'SERVICES'::"BusinessType"
  WHEN 'Retail'           THEN 'RETAIL'::"BusinessType"
  ELSE 'RETAIL'::"BusinessType"
END
WHERE "botBusinessType" IS NOT NULL;

-- 4. Drop the legacy column now that data is remapped
ALTER TABLE "Company" DROP COLUMN "botBusinessType";

-- 5. Add isAvailable to InventoryProduct (restaurant Available/Sold Out toggle)
ALTER TABLE "InventoryProduct" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;
