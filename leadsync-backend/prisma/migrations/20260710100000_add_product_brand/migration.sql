-- Migration: Add brand column to Product table
-- This column stores the product brand/manufacturer name

ALTER TABLE "Product" ADD COLUMN "brand" TEXT;