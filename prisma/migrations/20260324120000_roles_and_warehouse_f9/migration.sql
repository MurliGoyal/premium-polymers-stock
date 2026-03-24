-- Map legacy roles to the new 3-role model
UPDATE "users" SET "role" = 'MANAGER'::"Role" WHERE "role" = 'ADMIN'::"Role";

-- Replace enum with only MANAGER, STOCK_MANAGEMENT, VIEWER
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "Role_new" AS ENUM ('MANAGER', 'STOCK_MANAGEMENT', 'VIEWER');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text = 'OPERATOR' THEN 'STOCK_MANAGEMENT'
      ELSE "role"::text
    END
  )::"Role_new";

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"Role";

-- Rename warehouse code/slug/name from F-12 to F-11
UPDATE "warehouses"
SET "code" = 'F-11',
    "slug" = 'f-11',
    "name" = REPLACE("name", 'F-12', 'F-11')
WHERE "code" = 'F-12';
