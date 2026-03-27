"use server";

import {
  FinishedGoodActivityType,
  MaterialStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  assertServerPermission,
  getAllowedFinishedGoodsWarehouseCodes,
  resolveFinishedGoodsWarehouseForUser,
  type AuthenticatedUser,
} from "@/lib/auth";
import {
  DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE,
  FINISHED_GOODS_WAREHOUSE_CATALOG,
  FINISHED_GOODS_WAREHOUSE_CODES,
} from "@/lib/constants";
import { daysAgo } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, sumQuantities, toDecimal } from "@/lib/quantities";

function resolveStatus(stock: Prisma.Decimal): MaterialStatus {
  if (stock.lte(0)) return MaterialStatus.OUT_OF_STOCK;
  return MaterialStatus.IN_STOCK;
}

function normalizeFinishedGoodsWarehouseCode(input?: string | null) {
  const normalized = input?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  return FINISHED_GOODS_WAREHOUSE_CODES.includes(
    normalized as (typeof FINISHED_GOODS_WAREHOUSE_CODES)[number],
  )
    ? normalized
    : null;
}

function resolveWarehouseCode(input?: string | null) {
  return (
    normalizeFinishedGoodsWarehouseCode(input) ??
    DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE
  );
}

function getWarehouseMetaByCode(code: string) {
  return (
    FINISHED_GOODS_WAREHOUSE_CATALOG.find((warehouse) => warehouse.code === code) ??
    null
  );
}

function getFinishedGoodsWarehousePath(code: string) {
  const warehouse = getWarehouseMetaByCode(code);
  return warehouse ? `/finished-goods/${warehouse.slug}` : "/finished-goods";
}

function revalidateViews(warehouseCode?: string) {
  revalidatePath("/finished-goods");
  revalidatePath("/finished-goods-history");

  if (warehouseCode) {
    revalidatePath(getFinishedGoodsWarehousePath(warehouseCode));
  }
}

function buildNormalizedFinishedGoodKey(params: {
  warehouseCode: string;
  name: string;
  diameterValue?: number;
  diameterUnit?: string;
}) {
  const warehouse = params.warehouseCode.trim().toLowerCase();
  const name = params.name.trim().toLowerCase();

  if (params.diameterValue === undefined) {
    return `${warehouse}::${name}`;
  }

  const diameterValue = String(params.diameterValue);
  const diameterUnit = params.diameterUnit?.trim().toLowerCase();
  return diameterUnit
    ? `${warehouse}::${name}::${diameterValue}::${diameterUnit}`
    : `${warehouse}::${name}::${diameterValue}`;
}

function requireAllowedWarehouseCode(
  user: Pick<AuthenticatedUser, "finishedGoodsWarehouseCode" | "role">,
  warehouseCode?: string | null,
) {
  const resolvedCode = resolveFinishedGoodsWarehouseForUser(user, warehouseCode);

  if (!resolvedCode) {
    throw new Error("You do not have access to this finished goods warehouse.");
  }

  return resolvedCode;
}

export async function getFinishedGoodsDirectoryData() {
  const user = await assertServerPermission("finished_goods:view");
  const allowedWarehouseCodes = getAllowedFinishedGoodsWarehouseCodes(user);
  const sevenDaysAgo = daysAgo(6);

  const [goods, activities] = await Promise.all([
    prisma.finishedGood.findMany({
      where: { warehouseCode: { in: allowedWarehouseCodes } },
      select: {
        warehouseCode: true,
        currentStock: true,
        status: true,
      },
    }),
    prisma.finishedGoodActivityLog.findMany({
      where: {
        warehouseCode: { in: allowedWarehouseCodes },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        activityType: true,
        quantityChange: true,
        warehouseCode: true,
      },
    }),
  ]);

  return FINISHED_GOODS_WAREHOUSE_CATALOG.filter((warehouse) =>
    allowedWarehouseCodes.includes(warehouse.code),
  ).map((warehouse) => {
    const warehouseGoods = goods.filter(
      (good) => good.warehouseCode === warehouse.code,
    );
    const warehouseActivities = activities.filter(
      (activity) => activity.warehouseCode === warehouse.code,
    );
    const dispatchQuantity = warehouseActivities.reduce((sum, activity) => {
      if (activity.activityType !== FinishedGoodActivityType.DISPATCH) {
        return sum;
      }

      return sum + Math.abs(quantityToNumber(activity.quantityChange));
    }, 0);

    return {
      code: warehouse.code,
      gradient: warehouse.gradient,
      id: warehouse.code,
      inStockCount: warehouseGoods.filter(
        (good) => good.status === MaterialStatus.IN_STOCK,
      ).length,
      lowStockCount: warehouseGoods.filter(
        (good) => good.status === MaterialStatus.LOW_STOCK,
      ).length,
      name: warehouse.name,
      outOfStockCount: warehouseGoods.filter(
        (good) => good.status === MaterialStatus.OUT_OF_STOCK,
      ).length,
      recentActivities: warehouseActivities.length,
      slug: warehouse.slug,
      subtitle: warehouse.subtitle,
      totalDispatchQty: dispatchQuantity,
      totalGoods: warehouseGoods.length,
      totalStock: quantityToNumber(
        sumQuantities(warehouseGoods.map((good) => good.currentStock)),
      ),
    };
  });
}

export async function getFinishedGoodsWarehouseData(
  warehouseCode?: string | null,
) {
  const user = await assertServerPermission("finished_goods:view");
  const resolvedWarehouseCode = requireAllowedWarehouseCode(user, warehouseCode);
  const warehouseMeta = getWarehouseMetaByCode(resolvedWarehouseCode);

  if (!warehouseMeta) {
    return null;
  }

  const sevenDaysAgo = daysAgo(6);
  const [goods, recentActivities] = await Promise.all([
    prisma.finishedGood.findMany({
      where: { warehouseCode: resolvedWarehouseCode },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
    prisma.finishedGoodActivityLog.count({
      where: {
        warehouseCode: resolvedWarehouseCode,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return {
    goods: goods.map((good) => ({
      baseUnit: good.baseUnit,
      currentStock: quantityToNumber(good.currentStock),
      diameterUnit: good.diameterUnit,
      diameterValue: good.diameterValue,
      id: good.id,
      name: good.name,
      status: good.status,
      updatedAt: good.updatedAt.toISOString(),
      warehouseCode: good.warehouseCode,
    })),
    stats: {
      inStockCount: goods.filter(
        (good) => good.status === MaterialStatus.IN_STOCK,
      ).length,
      lowStockCount: goods.filter(
        (good) => good.status === MaterialStatus.LOW_STOCK,
      ).length,
      outOfStockCount: goods.filter(
        (good) => good.status === MaterialStatus.OUT_OF_STOCK,
      ).length,
      recentActivities,
      totalCount: goods.length,
      totalStock: quantityToNumber(
        sumQuantities(goods.map((good) => good.currentStock)),
      ),
    },
    warehouse: {
      code: warehouseMeta.code,
      name: warehouseMeta.name,
      slug: warehouseMeta.slug,
      subtitle: warehouseMeta.subtitle,
    },
  };
}

export type AddFinishedGoodResult =
  | { ok: true }
  | { ok: false; message: string };

export async function addFinishedGood(payload: {
  warehouseCode?: string;
  name: string;
  baseUnit: string;
  diameterValue?: number;
  diameterUnit?: string;
  initialStock?: number;
}): Promise<AddFinishedGoodResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  const name = payload.name.trim();

  if (!name) {
    return { ok: false, message: "Name is required." };
  }

  const baseUnit = payload.baseUnit.trim();
  if (!baseUnit) {
    return { ok: false, message: "Unit is required." };
  }

  const diameterValue = payload.diameterValue;
  const diameterUnit = payload.diameterUnit?.trim();
  const hasDiameter = diameterValue !== undefined;

  if (hasDiameter) {
    if (!Number.isFinite(diameterValue) || diameterValue < 0) {
      return {
        ok: false,
        message: "Diameter must be a valid non-negative number.",
      };
    }

    if (!diameterUnit) {
      return {
        ok: false,
        message: "Diameter unit is required when diameter is provided.",
      };
    }
  }

  const normalizedName = buildNormalizedFinishedGoodKey({
    diameterUnit,
    diameterValue,
    name,
    warehouseCode,
  });

  const existing = await prisma.finishedGood.findUnique({ where: { normalizedName } });
  if (existing) {
    return {
      ok: false,
      message: "A finished good with this name and diameter already exists.",
    };
  }

  const initialStock = toDecimal(payload.initialStock ?? 0);
  const status = resolveStatus(initialStock);

  const createFinishedGood = async (includeDiameter: boolean) => {
    await prisma.$transaction(async (tx) => {
      const finishedGood = await tx.finishedGood.create({
        data: {
          baseUnit,
          currentStock: initialStock,
          ...(includeDiameter
            ? {
                diameterUnit:
                  diameterValue !== undefined ? diameterUnit ?? null : null,
                diameterValue: diameterValue ?? null,
              }
            : {}),
          name,
          normalizedName,
          status,
          warehouseCode,
        },
      });

      if (initialStock.gt(0)) {
        await tx.finishedGoodActivityLog.create({
          data: {
            activityType: FinishedGoodActivityType.PRODUCTION,
            finishedGoodId: finishedGood.id,
            newStock: initialStock,
            notes: "Initial stock",
            performedById: user.id,
            previousStock: new Prisma.Decimal(0),
            quantityChange: initialStock,
            warehouseCode,
          },
        });
      }
    });
  };

  try {
    await createFinishedGood(true);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "A finished good with this name and diameter already exists.",
      };
    }

    const message = error instanceof Error ? error.message : "";
    const diameterSchemaMismatch =
      /diameter_value/i.test(message) ||
      /diameterValue/i.test(message) ||
      /Unknown argument/i.test(message);

    if (diameterSchemaMismatch) {
      try {
        await createFinishedGood(false);
      } catch {
        return {
          ok: false,
          message: "Failed to add finished good. Please try again.",
        };
      }

      revalidateViews(warehouseCode);
      return { ok: true };
    }

    return { ok: false, message: "Failed to add finished good. Please try again." };
  }

  revalidateViews(warehouseCode);
  return { ok: true };
}

export type StockActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteFinishedGood(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  await prisma.finishedGood.delete({ where: { id: finishedGood.id } });

  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function addProduction(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
  quantity: number;
  notes?: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);

  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  const quantity = toDecimal(payload.quantity);
  const newStock = finishedGood.currentStock.plus(quantity);
  const status = resolveStatus(newStock);

  await prisma.$transaction(
    async (tx) => {
      await tx.finishedGood.update({
        where: { id: finishedGood.id },
        data: { currentStock: newStock, status },
      });

      await tx.finishedGoodActivityLog.create({
        data: {
          activityType: FinishedGoodActivityType.PRODUCTION,
          finishedGoodId: finishedGood.id,
          newStock,
          notes: payload.notes?.trim() || null,
          performedById: user.id,
          previousStock: finishedGood.currentStock,
          quantityChange: quantity,
          warehouseCode: finishedGood.warehouseCode,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function addDispatch(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
  quantity: number;
  notes?: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);

  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  const quantity = toDecimal(payload.quantity);
  if (finishedGood.currentStock.lt(quantity)) {
    return {
      ok: false,
      message: `Cannot dispatch ${payload.quantity} - only ${quantityToNumber(
        finishedGood.currentStock,
      )} ${finishedGood.baseUnit} available.`,
    };
  }

  const newStock = finishedGood.currentStock.minus(quantity);
  const status = resolveStatus(newStock);

  await prisma.$transaction(
    async (tx) => {
      await tx.finishedGood.update({
        where: { id: finishedGood.id },
        data: { currentStock: newStock, status },
      });

      await tx.finishedGoodActivityLog.create({
        data: {
          activityType: FinishedGoodActivityType.DISPATCH,
          finishedGoodId: finishedGood.id,
          newStock,
          notes: payload.notes?.trim() || null,
          performedById: user.id,
          previousStock: finishedGood.currentStock,
          quantityChange: quantity.neg(),
          warehouseCode: finishedGood.warehouseCode,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  revalidateViews(warehouseCode);
  return { ok: true };
}
