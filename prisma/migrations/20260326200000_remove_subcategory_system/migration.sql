-- Remove subcategory system from raw materials domain.

-- Drop foreign key from raw_materials to subcategories (if present).
ALTER TABLE "raw_materials" DROP CONSTRAINT IF EXISTS "raw_materials_subcategory_id_fkey";

-- Drop index and column from raw_materials.
DROP INDEX IF EXISTS "raw_materials_subcategory_id_idx";
ALTER TABLE "raw_materials" DROP COLUMN IF EXISTS "subcategory_id";

-- Drop subcategories table.
DROP TABLE IF EXISTS "subcategories";
