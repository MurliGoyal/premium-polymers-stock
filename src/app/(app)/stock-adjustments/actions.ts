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
import { buildRawMaterialNormalizedKey } from "@/lib/raw-materials";
import { rawMaterialSpecificationUpdateSchema, stockAdjustmentFormSchema } from "@/lib/validation";

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
        thicknessValue: true,
        thicknessUnit: true,
        sizeValue: true,
        sizeUnit: true,
        gsm: true,
        micron: true,
        notes: true,
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
      thicknessValue: m.thicknessValue,
      thicknessUnit: m.thicknessUnit,
      sizeValue: m.sizeValue,
      sizeUnit: m.sizeUnit,
      gsm: m.gsm,
      micron: m.micron,
      notes: m.notes,
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
    micron: material.micron,
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

export type UpdateRawMaterialSpecificationsResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateRawMaterialSpecifications(payload: unknown): Promise<UpdateRawMaterialSpecificationsResult> {
  const user = await assertServerPermission("raw_materials:edit");
  const data = rawMaterialSpecificationUpdateSchema.parse(payload);

  const material = await prisma.rawMaterial.findUnique({
    where: { id: data.rawMaterialId },
    include: {
      category: { select: { id: true, name: true } },
      warehouse: { select: { code: true, name: true, slug: true } },
    },
  });

  if (!material || material.warehouseId !== data.warehouseId) {
    return { ok: false, message: "Raw material not found in the selected warehouse." };
  }

  const beforeSnapshot = createMaterialSnapshot({
    id: material.id,
    name: material.name,
    warehouse: material.warehouse,
    category: material.category,
    baseUnit: material.baseUnit,
    currentStock: material.currentStock,
    minimumStock: material.minimumStock,
    thicknessValue: material.thicknessValue,
    thicknessUnit: material.thicknessUnit,
    sizeValue: material.sizeValue,
    sizeUnit: material.sizeUnit,
    gsm: material.gsm,
    micron: material.micron,
    notes: material.notes,
    status: material.status,
  });

  const nextThicknessValue = data.thicknessValue ?? null;
  const nextThicknessUnit = data.thicknessUnit ?? null;
  const nextSizeValue = data.sizeValue ?? null;
  const nextSizeUnit = data.sizeUnit ?? null;
  const nextGsm = data.gsm ?? null;
  const nextMicron = data.micron ?? null;
  const nextNotes = data.notes ?? null;
  const nextNormalizedName = buildRawMaterialNormalizedKey({
    name: material.name,
    thicknessValue: nextThicknessValue,
    thicknessUnit: nextThicknessUnit,
    sizeValue: nextSizeValue,
    sizeUnit: nextSizeUnit,
    gsm: nextGsm,
    micron: nextMicron,
  });

  const hasChanges =
    material.thicknessValue !== nextThicknessValue ||
    material.thicknessUnit !== nextThicknessUnit ||
    material.sizeValue !== nextSizeValue ||
    material.sizeUnit !== nextSizeUnit ||
    material.gsm !== nextGsm ||
    material.micron !== nextMicron ||
    material.notes !== nextNotes;

  if (!hasChanges) {
    return { ok: true };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const conflictingMaterial = await tx.rawMaterial.findFirst({
          where: {
            warehouseId: material.warehouseId,
            normalizedName: nextNormalizedName,
            NOT: { id: material.id },
          },
          select: { id: true },
        });

        if (conflictingMaterial) {
          throw new Error("These specifications would duplicate another raw material with the same name in this warehouse.");
        }

        await tx.rawMaterial.update({
          where: { id: material.id },
          data: {
            normalizedName: nextNormalizedName,
            thicknessValue: nextThicknessValue,
            thicknessUnit: nextThicknessUnit,
            sizeValue: nextSizeValue,
            sizeUnit: nextSizeUnit,
            gsm: nextGsm,
            micron: nextMicron,
            notes: nextNotes,
          },
        });

        await tx.rawMaterialActivityLog.create({
          data: {
            rawMaterialId: material.id,
            warehouseId: material.warehouseId,
            activityType: ActivityType.METADATA_CHANGED,
            beforeSnapshot,
            afterSnapshot: {
              ...beforeSnapshot,
              thicknessValue: nextThicknessValue,
              thicknessUnit: nextThicknessUnit,
              sizeValue: nextSizeValue,
              sizeUnit: nextSizeUnit,
              gsm: nextGsm,
              micron: nextMicron,
              notes: nextNotes,
            },
            sourceType: "MANUAL_EDIT",
            performedById: user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "These specifications would duplicate another raw material with the same name in this warehouse." };
    }

    if (error instanceof Error) {
      return { ok: false, message: error.message };
    }

    throw error;
  }

  revalidateViews(material.warehouse.slug);
  return { ok: true };
}
