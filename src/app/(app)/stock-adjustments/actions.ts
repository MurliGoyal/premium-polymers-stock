"use server";

import {
  ActivityType,
  MaterialStatus,
  NotificationType,
  Prisma,
  TransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertServerPermission } from "@/lib/auth";
import { createMaterialSnapshot, resolveMaterialStatus } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, quantityToString, toDecimal } from "@/lib/quantities";
import { stockAdjustmentFormSchema } from "@/lib/validation";

function revalidateViews(warehouseSlug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${warehouseSlug}`);
  revalidatePath("/raw-materials-history");
  revalidatePath("/stock-adjustments");
}

export async function getStockAdjustmentData() {
  await assertServerPermission("stock_adjustments:view");

  const [warehouses, materials] = await Promise.all([
    prisma.warehouse.findMany({
      select: { id: true, code: true, name: true, slug: true },
      orderBy: { code: "asc" },
    }),
    prisma.rawMaterial.findMany({
      select: {
        id: true,
        name: true,
        warehouseId: true,
        currentStock: true,
        minimumStock: true,
        baseUnit: true,
        status: true,
        category: { select: { name: true } },
        warehouse: { select: { code: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    warehouses,
    materials: materials.map((m) => ({
      id: m.id,
      name: m.name,
      warehouseId: m.warehouseId,
      warehouseCode: m.warehouse.code,
      currentStock: quantityToNumber(m.currentStock),
      minimumStock: quantityToNumber(m.minimumStock),
      baseUnit: m.baseUnit,
      status: m.status,
      category: m.category.name,
    })),
  };
}

export type AdjustStockResult =
  | { ok: true }
  | { ok: false; message: string };

export async function adjustStock(payload: unknown): Promise<AdjustStockResult> {
  const user = await assertServerPermission("stock_adjustments:manage");
  const data = stockAdjustmentFormSchema.parse(payload);

  const material = await prisma.rawMaterial.findUnique({
    where: { id: data.rawMaterialId },
    include: {
      category: { select: { id: true, name: true } },
      warehouse: { select: { code: true, name: true, slug: true } },
    },
  });

  if (!material || material.warehouseId !== data.warehouseId) {
    throw new Error("Raw material not found in the selected warehouse.");
  }

  const oldStock = material.currentStock;
  const quantity = toDecimal(data.quantity);
  let newStock: Prisma.Decimal;

  switch (data.adjustmentType) {
    case "set":
      newStock = quantity;
      break;
    case "add":
      newStock = oldStock.plus(quantity);
      break;
    case "subtract":
      if (oldStock.lt(quantity)) {
        return {
          ok: false,
          message: `Cannot subtract ${data.quantity} — only ${quantityToNumber(oldStock)} ${material.baseUnit} available.`,
        };
      }
      newStock = oldStock.minus(quantity);
      break;
  }

  const newStatus = resolveMaterialStatus(newStock, material.minimumStock);
  const quantityChange = newStock.minus(oldStock);

  const beforeSnapshot = createMaterialSnapshot({
    id: material.id,
    name: material.name,
    warehouse: material.warehouse,
    category: material.category,
    baseUnit: material.baseUnit,
    currentStock: oldStock,
    minimumStock: material.minimumStock,
    thicknessValue: material.thicknessValue,
    thicknessUnit: material.thicknessUnit,
    sizeValue: material.sizeValue,
    sizeUnit: material.sizeUnit,
    gsm: material.gsm,
    notes: material.notes,
    status: material.status,
  });

  const afterSnapshot = {
    ...beforeSnapshot,
    currentStock: quantityToString(newStock),
    status: newStatus,
  };

  await prisma.$transaction(
    async (tx) => {
      await tx.rawMaterial.update({
        where: { id: material.id },
        data: { currentStock: newStock, status: newStatus },
      });

      await tx.rawMaterialActivityLog.create({
        data: {
          rawMaterialId: material.id,
          warehouseId: material.warehouseId,
          activityType: ActivityType.STOCK_ADJUSTED,
          beforeSnapshot,
          afterSnapshot: { ...afterSnapshot, adjustmentReason: data.reason },
          quantityChange,
          sourceType: "MANUAL_ADJUSTMENT",
          performedById: user.id,
        },
      });

      await tx.stockTransaction.create({
        data: {
          warehouseId: material.warehouseId,
          rawMaterialId: material.id,
          transactionType: TransactionType.ADJUSTMENT,
          quantity: quantityChange.abs(),
          previousStock: oldStock,
          newStock,
          sourceType: "MANUAL_ADJUSTMENT",
          createdById: user.id,
        },
      });

      if (
        newStatus !== material.status &&
        (newStatus === MaterialStatus.LOW_STOCK || newStatus === MaterialStatus.OUT_OF_STOCK)
      ) {
        await tx.notification.create({
          data: {
            type: newStatus === MaterialStatus.OUT_OF_STOCK ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK,
            warehouseId: material.warehouseId,
            rawMaterialId: material.id,
            message: `${material.name} is ${newStatus === MaterialStatus.OUT_OF_STOCK ? "out of stock" : "running low"} after manual adjustment (${quantityToNumber(newStock)} ${material.baseUnit} remaining).`,
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  revalidateViews(material.warehouse.slug);
  return { ok: true };
}
