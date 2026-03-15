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
import { prisma } from "@/lib/prisma";
import {
  categoryNameSchema,
  rawMaterialFormSchema,
  recipientNameSchema,
  transferFormSchema,
} from "@/lib/validation";
import { slugify } from "@/lib/utils";

export async function getWarehouseData(slug: string) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { slug },
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

  const totalStock = materials.reduce((sum, material) => sum + material.currentStock, 0);

  return {
    warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, slug: warehouse.slug },
    materials: materials.map((material) => ({
      id: material.id,
      name: material.name,
      category: material.category.name,
      baseUnit: material.baseUnit,
      currentStock: material.currentStock,
      minimumStock: material.minimumStock,
      thicknessValue: material.thicknessValue,
      thicknessUnit: material.thicknessUnit,
      sizeValue: material.sizeValue,
      sizeUnit: material.sizeUnit,
      weightValue: material.weightValue,
      weightUnit: material.weightUnit,
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
      totalStock: Math.round(totalStock),
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
        const createdMaterial = await tx.rawMaterial.create({
          data: {
            warehouseId: warehouse.id,
            name: data.name,
            categoryId: category.id,
            baseUnit: data.baseUnit,
            currentStock: data.currentStock,
            minimumStock: data.minimumStock,
            thicknessValue: data.thicknessValue ?? null,
            thicknessUnit: data.thicknessUnit ?? null,
            sizeValue: data.sizeValue ?? null,
            sizeUnit: data.sizeUnit ?? null,
            weightValue: data.weightValue ?? null,
            weightUnit: data.weightUnit ?? null,
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
          weightValue: data.weightValue ?? null,
          weightUnit: data.weightUnit ?? null,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A raw material with this name already exists in the selected warehouse.");
    }

    throw error;
  }
}

export async function createCategory(name: string) {
  await assertAnyServerPermission(["categories:manage", "raw_materials:create"]);
  const parsedName = categoryNameSchema.parse(name);
  const slug = slugify(parsedName);

  const existing = await prisma.category.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: parsedName, mode: "insensitive" } }],
    },
  });

  if (existing) return existing;

  const category = await prisma.category.create({ data: { name: parsedName, slug } });
  revalidatePath("/settings/categories");
  revalidatePath("/warehouses");
  return category;
}

export async function performTransfer(payload: unknown) {
  const user = await assertServerPermission("transfers:create");
  const data = transferFormSchema.parse(payload);

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: data.warehouseId },
  });

  if (!warehouse) {
    throw new Error("Warehouse not found.");
  }

  const transfer = await prisma.$transaction(
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

      if (material.currentStock < data.quantity) {
        throw new Error("Transfer quantity cannot exceed available stock.");
      }

      const recipient = await tx.recipient.findUnique({ where: { id: data.recipientId } });
      if (!recipient) {
        throw new Error("Recipient not found.");
      }

      const newStock = material.currentStock - data.quantity;
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
        weightValue: material.weightValue,
        weightUnit: material.weightUnit,
        gsm: material.gsm,
        notes: material.notes,
        status: material.status,
      });
      const afterSnapshot = {
        ...beforeSnapshot,
        currentStock: newStock,
        status: newStatus,
      };

      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: {
          currentStock: newStock,
          status: newStatus,
        },
      });

      const createdTransfer = await tx.transfer.create({
        data: {
          warehouseId: warehouse.id,
          rawMaterialId: data.rawMaterialId,
          quantity: data.quantity,
          recipientId: recipient.id,
          notes: data.notes ?? null,
          referenceNumber: data.referenceNumber ?? null,
          materialSnapshot: {
            ...beforeSnapshot,
            stockBeforeTransfer: material.currentStock,
            stockAfterTransfer: newStock,
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
          quantityChange: -data.quantity,
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
          quantity: data.quantity,
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
            message: `${material.name} is ${newStatus === MaterialStatus.OUT_OF_STOCK ? "out of stock" : "running low"} (${newStock} ${material.baseUnit} remaining)`,
          },
        });
      }

      return createdTransfer;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  revalidateWarehouseViews(warehouse.slug);
  return { success: true, id: transfer.id };
}

export async function createRecipient(name: string) {
  await assertAnyServerPermission(["recipients:manage", "transfers:create"]);
  const parsedName = recipientNameSchema.parse(name);

  const existing = await prisma.recipient.findFirst({
    where: { name: { equals: parsedName, mode: "insensitive" } },
  });
  if (existing) return existing;

  const recipient = await prisma.recipient.create({ data: { name: parsedName } });
  revalidatePath("/settings/recipients");
  return recipient;
}

export async function getRecipients() {
  await assertServerPermission("transfers:view");
  return prisma.recipient.findMany({ orderBy: { name: "asc" } });
}

export async function getMaterialsForTransfer(warehouseId: string) {
  await assertServerPermission("transfers:view");
  return prisma.rawMaterial.findMany({
    where: { warehouseId, currentStock: { gt: 0 } },
    select: { id: true, name: true, currentStock: true, baseUnit: true, minimumStock: true },
    orderBy: { name: "asc" },
  });
}
