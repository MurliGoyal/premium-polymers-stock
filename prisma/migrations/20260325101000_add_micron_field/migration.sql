ALTER TABLE "raw_materials"
ADD COLUMN "micron" DOUBLE PRECISION;

UPDATE "raw_materials"
SET "micron" = "thickness_value"
WHERE "micron" IS NULL
  AND "thickness_value" IS NOT NULL;
