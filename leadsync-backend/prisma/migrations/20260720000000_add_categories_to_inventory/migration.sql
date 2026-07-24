-- AlterTable: Replace single category String? with categories String[]
-- Step 1: Add new array column with default empty array
ALTER TABLE "InventoryProduct" ADD COLUMN "categories" TEXT[] DEFAULT '{}' NOT NULL;

-- Step 2: Migrate existing data — wrap non-null single values into arrays
UPDATE "InventoryProduct" SET "categories" = ARRAY["category"] WHERE "category" IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE "InventoryProduct" DROP COLUMN "category";
