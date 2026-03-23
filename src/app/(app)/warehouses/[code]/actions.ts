"use server";

import {
  ActivityType,
  MaterialStatus,
  NotificationType,
  Prisma,
  TransactionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertAnyServerPermission, assertServerPermission } from "@/lib/auth";
import { createMaterialSnapshot, daysAgo, resolveMaterialStatus } from "@/lib/inventory";
import { normalizeRecordName } from "@/lib/naming";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, quantityToString, serializeQuantity, sumQuantities, toDecimal } from "@/lib/quantities";
import {
  categoryNameSchema,
  rawMaterialFormSchema,
  recipientNameSchema,
  transferFormSchema,
} from "@/lib/validation";
import { slugify } from "@/lib/utils";

type CreatedEntityResult<T> = {
  created: boolean;
  entity: T;
};

export type CategoryActionResult = CreatedEntityResult<{ id: string; name: string; slug: string }>;

export type RecipientActionResult = CreatedEntityResult<{ id: string; name: string }>;

export type TransferActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: "INSUFFICIENT_STOCK" | "STALE_STOCK";
      message: string;
      availableStock: number;
      baseUnit: string;
    };

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function getWarehouseData(warehouseRef: string) {
  await assertServerPermission("raw_materials:view");

  const warehouse = await prisma.warehouse.findFirst({
    where: {
      OR: [{ slug: warehouseRef }, { code: { equals: warehouseRef, mode: "insensitive" } }],
    },
  });

  if (!warehouse) return null;

  const sevenDaysAgo = daysAgo(6);
  const [materials, categories, totalCount, lowStockCount, outOfStockCount, recentTransfers, recentActivities] =
    await Promise.all([
      prisma.rawMaterial.findMany({
        where: { warehouseId: warehouse.id },
        include: {
          category: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.rawMaterial.count({ where: { warehouseId: warehouse.id } }),
      prisma.rawMaterial.count({ where: { warehouseId: warehouse.id, status: MaterialStatus.LOW_STOCK } }),
      prisma.rawMaterial.count({ where: { warehouseId: warehouse.id, status: MaterialStatus.OUT_OF_STOCK } }),
      prisma.transfer.count({ where: { warehouseId: warehouse.id, createdAt: { gte: sevenDaysAgo } } }),
      prisma.rawMaterialActivityLog.count({
        where: { warehouseId: warehouse.id, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

  const totalStock = sumQuantities(materials.map((material) => material.currentStock));

  return {
    warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, slug: warehouse.slug },
    materials: materials.map((material) => ({
      id: material.id,
      name: material.name,
      category: material.category.name,
      baseUnit: material.baseUnit,
      currentStock: quantityToNumber(material.currentStock),
      minimumStock: quantityToNumber(material.minimumStock),
      thicknessValue: material.thicknessValue,
      thicknessUnit: material.thicknessUnit,
      sizeValue: material.sizeValue,
      sizeUnit: material.sizeUnit,
      gsm: material.gsm,
      notes: material.notes,
      status: material.status,
      createdBy: material.createdBy?.name || "System",
      updatedAt: material.updatedAt.toISOString(),
    })),
    categories: categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
    stats: {
      totalCount,
      lowStockCount,
      outOfStockCount,
      totalStock: quantityToNumber(totalStock),
      recentTransfers,
      recentActivities,
    },
  };
}

function revalidateWarehouseViews(warehouseSlug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${warehouseSlug}`);
  revalidatePath(`/warehouses/${warehouseSlug}/raw-materials/add`);
  revalidatePath(`/warehouses/${warehouseSlug}/transfer`);
  revalidatePath("/transfer-history");
  revalidatePath("/raw-materials-history");
}

export async function createRawMaterial(payload: unknown) {
  const user = await assertServerPermission("raw_materials:create");
  const data = rawMaterialFormSchema.parse(payload);
  const normalizedName = normalizeRecordName(data.name);

  const [warehouse, category] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: data.warehouseId } }),
    prisma.category.findUnique({ where: { id: data.categoryId } }),
  ]);

  if (!warehouse) {
    throw new Error("Warehouse not found.");
  }

  if (!category) {
    throw new Error("Category not found.");
  }

  const status = resolveMaterialStatus(data.currentStock, data.minimumStock);

  try {
    const material = await prisma.$transaction(
      async (tx) => {
        const existingMaterial = await tx.rawMaterial.findFirst({
          where: {
            warehouseId: warehouse.id,
            OR: [
              { normalizedName },
              { name: { equals: data.name, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        if (existingMaterial) {
          throw new Error("A raw material with this name already exists in the selected warehouse.");
        }

        const createdMaterial = await tx.rawMaterial.create({
          data: {
            warehouseId: warehouse.id,
            name: data.name,
            normalizedName,
            categoryId: category.id,
            subcategoryId: data.subcategoryId || null,
            baseUnit: data.baseUnit,
            currentStock: data.currentStock,
            minimumStock: data.minimumStock,
            thicknessValue: data.thicknessValue ?? null,
            thicknessUnit: data.thicknessUnit ?? null,
            sizeValue: data.sizeValue ?? null,
            sizeUnit: data.sizeUnit ?? null,
            gsm: data.gsm ?? null,
            notes: data.notes ?? null,
            status,
            createdById: user.id,
          },
        });

        const snapshot = createMaterialSnapshot({
          id: createdMaterial.id,
          name: data.name,
          warehouse: { code: warehouse.code, name: warehouse.name },
          category: { id: category.id, name: category.name },
          baseUnit: data.baseUnit,
          currentStock: data.currentStock,
          minimumStock: data.minimumStock,
          thicknessValue: data.thicknessValue ?? null,
          thicknessUnit: data.thicknessUnit ?? null,
          sizeValue: data.sizeValue,
          sizeUnit: data.sizeUnit ?? null,
          gsm: data.gsm ?? null,
          notes: data.notes,
          status,
        });

        await tx.rawMaterialActivityLog.create({
          data: {
            rawMaterialId: createdMaterial.id,
            warehouseId: warehouse.id,
            activityType: ActivityType.CREATED,
            afterSnapshot: snapshot,
            performedById: user.id,
          },
        });

        await tx.stockTransaction.create({
          data: {
            warehouseId: warehouse.id,
            rawMaterialId: createdMaterial.id,
            transactionType: TransactionType.INITIAL,
            quantity: data.currentStock,
            previousStock: 0,
            newStock: data.currentStock,
            sourceType: "CREATION",
            createdById: user.id,
          },
        });

        if (status !== MaterialStatus.IN_STOCK) {
          await tx.notification.create({
            data: {
              type: status === MaterialStatus.OUT_OF_STOCK ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK,
              warehouseId: warehouse.id,
              rawMaterialId: createdMaterial.id,
              message: `${data.name} is ${status === MaterialStatus.OUT_OF_STOCK ? "out of stock" : "at low stock"} on creation.`,
            },
          });
        }

        return createdMaterial;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidateWarehouseViews(warehouse.slug);
    return { success: true, id: material.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("A raw material with this name already exists in the selected warehouse.");
    }

    throw error;
  }
}

export async function createCategory(name: string): Promise<CategoryActionResult> {
  await assertAnyServerPermission(["categories:manage", "raw_materials:create"]);
  const parsedName = categoryNameSchema.parse(name);
  const normalizedName = normalizeRecordName(parsedName);
  const slug = slugify(parsedName);

  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ normalizedName }, { slug }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });

  if (existing) {
    return {
      created: false,
      entity: { id: existing.id, name: existing.name, slug: existing.slug },
    };
  }

  try {
    const category = await prisma.category.create({ data: { name: parsedName, normalizedName, slug } });
    revalidatePath("/settings/categories");
    revalidatePath("/warehouses");
    return {
      created: true,
      entity: { id: category.id, name: category.name, slug: category.slug },
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentCategory = await prisma.category.findFirst({
      where: {
        OR: [{ normalizedName }, { slug }],
      },
    });

    if (!concurrentCategory) {
      throw error;
    }

    return {
      created: false,
      entity: { id: concurrentCategory.id, name: concurrentCategory.name, slug: concurrentCategory.slug },
    };
  }
}

export async function performTransfer(payload: unknown): Promise<TransferActionResult> {
  const user = await assertServerPermission("transfers:create");
  const data = transferFormSchema.parse(payload);
  const requestedQuantity = toDecimal(data.quantity);

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: data.warehouseId },
  });

  if (!warehouse) {
    throw new Error("Warehouse not found.");
  }

  const runTransferTransaction = async (): Promise<TransferActionResult> =>
    prisma.$transaction(
      async (tx) => {
        const material = await tx.rawMaterial.findUnique({
          where: { id: data.rawMaterialId },
          include: {
            category: { select: { id: true, name: true } },
            warehouse: { select: { code: true, name: true } },
          },
        });

        if (!material || material.warehouseId !== warehouse.id) {
          throw new Error("Raw material not found in the selected warehouse.");
        }

        const recipient = await tx.recipient.findUnique({ where: { id: data.recipientId } });
        if (!recipient) {
          throw new Error("Recipient not found.");
        }

        if (material.currentStock.lt(requestedQuantity)) {
          return {
            ok: false as const,
            code: "INSUFFICIENT_STOCK" as const,
            message: `Only ${quantityToNumber(material.currentStock)} ${material.baseUnit} is available right now. Refresh availability and reduce the quantity before retrying.`,
            availableStock: quantityToNumber(material.currentStock),
            baseUnit: material.baseUnit,
          };
        }

        const newStock = material.currentStock.minus(requestedQuantity);
        const newStatus = resolveMaterialStatus(newStock, material.minimumStock);
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
          notes: material.notes,
          status: material.status,
        });
        const afterSnapshot = {
          ...beforeSnapshot,
          currentStock: quantityToString(newStock),
          status: newStatus,
        };

        const guardedUpdate = await tx.rawMaterial.updateMany({
          where: {
            id: data.rawMaterialId,
            warehouseId: warehouse.id,
            currentStock: material.currentStock,
          },
          data: {
            currentStock: newStock,
            status: newStatus,
          },
        });

        if (guardedUpdate.count !== 1) {
          const latestMaterial = await tx.rawMaterial.findUnique({
            where: { id: data.rawMaterialId },
            select: { baseUnit: true, currentStock: true, warehouseId: true },
          });

          if (!latestMaterial || latestMaterial.warehouseId !== warehouse.id) {
            throw new Error("Raw material not found in the selected warehouse.");
          }

          const availableStock = quantityToNumber(latestMaterial.currentStock);
          return {
            ok: false as const,
            code: latestMaterial.currentStock.lt(requestedQuantity) ? ("INSUFFICIENT_STOCK" as const) : ("STALE_STOCK" as const),
            message: latestMaterial.currentStock.lt(requestedQuantity)
              ? `Stock changed while this form was open. Only ${availableStock} ${latestMaterial.baseUnit} is available now. Refresh availability and reduce the quantity before retrying.`
              : "Stock changed while this form was open. Refresh availability, review the latest balance, and retry the transfer.",
            availableStock,
            baseUnit: latestMaterial.baseUnit,
          };
        }

        const createdTransfer = await tx.transfer.create({
          data: {
            warehouseId: warehouse.id,
            rawMaterialId: data.rawMaterialId,
            quantity: requestedQuantity,
            recipientId: recipient.id,
            notes: data.notes ?? null,
            referenceNumber: data.referenceNumber ?? null,
            materialSnapshot: {
              ...beforeSnapshot,
              stockBeforeTransfer: serializeQuantity(material.currentStock),
              stockAfterTransfer: serializeQuantity(newStock),
              recipientName: recipient.name,
            },
            createdById: user.id,
          },
        });

        await tx.rawMaterialActivityLog.create({
          data: {
            rawMaterialId: data.rawMaterialId,
            warehouseId: warehouse.id,
            activityType: ActivityType.TRANSFER_DEDUCTION,
            beforeSnapshot,
            afterSnapshot,
            quantityChange: requestedQuantity.mul(-1),
            sourceType: "TRANSFER",
            sourceId: createdTransfer.id,
            performedById: user.id,
          },
        });

        await tx.stockTransaction.create({
          data: {
            warehouseId: warehouse.id,
            rawMaterialId: data.rawMaterialId,
            transactionType: TransactionType.TRANSFER,
            quantity: requestedQuantity,
            previousStock: material.currentStock,
            newStock,
            sourceType: "TRANSFER",
            sourceId: createdTransfer.id,
            createdById: user.id,
          },
        });

        if (newStatus === MaterialStatus.LOW_STOCK || newStatus === MaterialStatus.OUT_OF_STOCK) {
          await tx.notification.create({
            data: {
              type: newStatus === MaterialStatus.OUT_OF_STOCK ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK,
              warehouseId: warehouse.id,
              rawMaterialId: data.rawMaterialId,
              message: `${material.name} is ${newStatus === MaterialStatus.OUT_OF_STOCK ? "out of stock" : "running low"} (${quantityToNumber(newStock)} ${material.baseUnit} remaining)`,
            },
          });
        }

        return { ok: true as const, id: createdTransfer.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await runTransferTransaction();

      if (!result.ok) {
        return result;
      }

      revalidateWarehouseViews(warehouse.slug);
      return result;
    } catch (error) {
      if (attempt === 0 && isRetryableTransactionError(error)) {
        continue;
      }

      if (isRetryableTransactionError(error)) {
        const latestMaterial = await prisma.rawMaterial.findUnique({
          where: { id: data.rawMaterialId },
          select: { baseUnit: true, currentStock: true, warehouseId: true },
        });

        return {
          ok: false,
          code: "STALE_STOCK",
          message: "Stock changed during transfer processing. Refresh availability and review the latest balance before retrying.",
          availableStock:
            latestMaterial && latestMaterial.warehouseId === warehouse.id
              ? quantityToNumber(latestMaterial.currentStock)
              : 0,
          baseUnit: latestMaterial?.warehouseId === warehouse.id ? latestMaterial.baseUnit : "",
        };
      }

      throw error;
    }
  }

  return {
    ok: false,
    code: "STALE_STOCK",
    message: "Stock changed during transfer processing. Refresh availability and review the latest balance before retrying.",
    availableStock: 0,
    baseUnit: "",
  };
}

export async function createRecipient(name: string): Promise<RecipientActionResult> {
  await assertAnyServerPermission(["recipients:manage", "transfers:create"]);
  const parsedName = recipientNameSchema.parse(name);
  const normalizedName = normalizeRecordName(parsedName);

  const existing = await prisma.recipient.findFirst({
    where: {
      OR: [{ normalizedName }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });
  if (existing) {
    return {
      created: false,
      entity: { id: existing.id, name: existing.name },
    };
  }

  try {
    const recipient = await prisma.recipient.create({ data: { name: parsedName, normalizedName } });
    revalidatePath("/settings/recipients");
    return {
      created: true,
      entity: { id: recipient.id, name: recipient.name },
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentRecipient = await prisma.recipient.findFirst({
      where: {
        OR: [{ normalizedName }, { name: { equals: parsedName, mode: "insensitive" } }],
      },
    });

    if (!concurrentRecipient) {
      throw error;
    }

    return {
      created: false,
      entity: { id: concurrentRecipient.id, name: concurrentRecipient.name },
    };
  }
}

export async function getRecipients() {
  await assertServerPermission("transfers:view");
  return prisma.recipient.findMany({ orderBy: { name: "asc" } });
}

export async function getMaterialsForTransfer(warehouseId: string) {
  await assertServerPermission("transfers:view");
  const materials = await prisma.rawMaterial.findMany({
    where: { warehouseId, currentStock: { gt: 0 } },
    select: { id: true, name: true, currentStock: true, baseUnit: true, minimumStock: true },
    orderBy: { name: "asc" },
  });

  return materials.map((material) => ({
    id: material.id,
    name: material.name,
    currentStock: quantityToNumber(material.currentStock),
    baseUnit: material.baseUnit,
    minimumStock: quantityToNumber(material.minimumStock),
  }));
}
