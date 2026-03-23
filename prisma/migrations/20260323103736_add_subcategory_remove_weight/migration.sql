-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'UPDATED', 'STOCK_ADJUSTED', 'TRANSFER_DEDUCTION', 'MINIMUM_STOCK_CHANGED', 'CATEGORY_CHANGED', 'UNIT_CHANGED', 'METADATA_CHANGED', 'DELETED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ADDITION', 'DEDUCTION', 'ADJUSTMENT', 'TRANSFER', 'INITIAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'TRANSFER_COMPLETED', 'STOCK_ADJUSTED', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "slug" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "base_unit" TEXT NOT NULL,
    "current_stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "minimum_stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "thickness_value" DOUBLE PRECISION,
    "thickness_unit" TEXT,
    "size_value" TEXT,
    "size_unit" TEXT,
    "gsm" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'IN_STOCK',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "notes" TEXT,
    "reference_number" TEXT,
    "material_snapshot" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_activity_logs" (
    "id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "quantity_change" DECIMAL(18,3),
    "source_type" TEXT,
    "source_id" TEXT,
    "performed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "previous_stock" DECIMAL(18,3) NOT NULL,
    "new_stock" DECIMAL(18,3) NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "warehouse_id" TEXT,
    "raw_material_id" TEXT,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_slug_key" ON "warehouses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_normalized_name_key" ON "categories"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_normalized_name_key" ON "subcategories"("category_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_slug_key" ON "subcategories"("category_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_normalized_name_key" ON "recipients"("normalized_name");

-- CreateIndex
CREATE INDEX "raw_materials_warehouse_id_idx" ON "raw_materials"("warehouse_id");

-- CreateIndex
CREATE INDEX "raw_materials_category_id_idx" ON "raw_materials"("category_id");

-- CreateIndex
CREATE INDEX "raw_materials_subcategory_id_idx" ON "raw_materials"("subcategory_id");

-- CreateIndex
CREATE INDEX "raw_materials_status_idx" ON "raw_materials"("status");

-- CreateIndex
CREATE INDEX "raw_materials_warehouse_id_status_idx" ON "raw_materials"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "raw_materials_warehouse_id_updated_at_idx" ON "raw_materials"("warehouse_id", "updated_at");

-- CreateIndex
CREATE INDEX "raw_materials_warehouse_id_category_id_idx" ON "raw_materials"("warehouse_id", "category_id");

-- CreateIndex
CREATE INDEX "raw_materials_warehouse_id_normalized_name_idx" ON "raw_materials"("warehouse_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_warehouse_id_normalized_name_key" ON "raw_materials"("warehouse_id", "normalized_name");

-- CreateIndex
CREATE INDEX "transfers_warehouse_id_idx" ON "transfers"("warehouse_id");

-- CreateIndex
CREATE INDEX "transfers_raw_material_id_idx" ON "transfers"("raw_material_id");

-- CreateIndex
CREATE INDEX "transfers_recipient_id_idx" ON "transfers"("recipient_id");

-- CreateIndex
CREATE INDEX "transfers_created_at_idx" ON "transfers"("created_at");

-- CreateIndex
CREATE INDEX "transfers_warehouse_id_created_at_idx" ON "transfers"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "raw_material_activity_logs_raw_material_id_idx" ON "raw_material_activity_logs"("raw_material_id");

-- CreateIndex
CREATE INDEX "raw_material_activity_logs_warehouse_id_idx" ON "raw_material_activity_logs"("warehouse_id");

-- CreateIndex
CREATE INDEX "raw_material_activity_logs_activity_type_idx" ON "raw_material_activity_logs"("activity_type");

-- CreateIndex
CREATE INDEX "raw_material_activity_logs_created_at_idx" ON "raw_material_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_warehouse_id_idx" ON "stock_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_transactions_raw_material_id_idx" ON "stock_transactions"("raw_material_id");

-- CreateIndex
CREATE INDEX "stock_transactions_created_at_idx" ON "stock_transactions"("created_at");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_activity_logs" ADD CONSTRAINT "raw_material_activity_logs_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_activity_logs" ADD CONSTRAINT "raw_material_activity_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_activity_logs" ADD CONSTRAINT "raw_material_activity_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
