DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'FinishedGoodActivityType'
  ) THEN
    CREATE TYPE "FinishedGoodActivityType" AS ENUM ('PRODUCTION', 'DISPATCH', 'STOCK_ADJUSTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "finished_goods" (
  "id" TEXT NOT NULL,
  "warehouse_code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT,
  "base_unit" TEXT NOT NULL,
  "current_stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "status" "MaterialStatus" NOT NULL DEFAULT 'IN_STOCK',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "finished_goods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finished_good_activity_logs" (
  "id" TEXT NOT NULL,
  "finished_good_id" TEXT NOT NULL,
  "warehouse_code" TEXT NOT NULL,
  "activity_type" "FinishedGoodActivityType" NOT NULL,
  "quantity_change" DECIMAL(18,3) NOT NULL,
  "previous_stock" DECIMAL(18,3) NOT NULL,
  "new_stock" DECIMAL(18,3) NOT NULL,
  "notes" TEXT,
  "performed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "finished_good_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finished_goods_normalized_name_key" ON "finished_goods"("normalized_name");
CREATE INDEX IF NOT EXISTS "finished_goods_warehouse_code_idx" ON "finished_goods"("warehouse_code");
CREATE INDEX IF NOT EXISTS "finished_goods_status_idx" ON "finished_goods"("status");

CREATE INDEX IF NOT EXISTS "finished_good_activity_logs_finished_good_id_idx" ON "finished_good_activity_logs"("finished_good_id");
CREATE INDEX IF NOT EXISTS "finished_good_activity_logs_warehouse_code_idx" ON "finished_good_activity_logs"("warehouse_code");
CREATE INDEX IF NOT EXISTS "finished_good_activity_logs_activity_type_idx" ON "finished_good_activity_logs"("activity_type");
CREATE INDEX IF NOT EXISTS "finished_good_activity_logs_created_at_idx" ON "finished_good_activity_logs"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finished_good_activity_logs_finished_good_id_fkey'
  ) THEN
    ALTER TABLE "finished_good_activity_logs"
    ADD CONSTRAINT "finished_good_activity_logs_finished_good_id_fkey"
    FOREIGN KEY ("finished_good_id") REFERENCES "finished_goods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finished_good_activity_logs_performed_by_fkey'
  ) THEN
    ALTER TABLE "finished_good_activity_logs"
    ADD CONSTRAINT "finished_good_activity_logs_performed_by_fkey"
    FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "finished_goods"
ADD COLUMN IF NOT EXISTS "diameter_value" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "diameter_unit" TEXT;
