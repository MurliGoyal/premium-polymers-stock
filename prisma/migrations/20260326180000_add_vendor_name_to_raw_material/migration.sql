-- Add optional vendor name for reusable vendor selection in raw material creation.
ALTER TABLE "raw_materials"
ADD COLUMN "vendor_name" TEXT;
