ALTER TABLE "finished_goods"
ADD COLUMN IF NOT EXISTS "is_container" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "parent_id" TEXT;

DO $$
BEGIN
  ALTER TABLE "finished_goods"
    ADD CONSTRAINT "finished_goods_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "finished_goods"("id")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "finished_goods_parent_id_idx"
  ON "finished_goods"("parent_id");

CREATE INDEX IF NOT EXISTS "finished_goods_is_container_idx"
  ON "finished_goods"("is_container");
