-- Migration: Add deliveryError column to Message table
-- This persists the transport error message for FAILED deliveries
ALTER TABLE "Message" ADD COLUMN "deliveryError" TEXT;