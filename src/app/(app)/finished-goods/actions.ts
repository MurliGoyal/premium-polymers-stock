"use server";

import {
  FinishedGoodActivityType,
  MaterialStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  assertOwnsFinishedGoodsWarehouse,
  assertServerPermission,
  getReadableFinishedGoodsWarehouseCodes,
  resolveFinishedGoodsWarehouseForUser,
  type AuthenticatedUser,
} from "@/lib/auth";
import {
  FINISHED_GOODS_WAREHOUSE_CATALOG,
} from "@/lib/constants";
import { daysAgo } from "@/lib/inventory";
import { normalizeRecordName } from "@/lib/naming";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, sumQuantities, toDecimal } from "@/lib/quantities";
import {
  createMasterGoodSchema,
  createSubGoodSchema,
  recipientNameSchema,
} from "@/lib/validation";

function resolveStatus(stock: Prisma.Decimal): MaterialStatus {
  if (stock.lte(0)) return MaterialStatus.OUT_OF_STOCK;
  return MaterialStatus.IN_STOCK;
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
  parentId?: string | null;
  isContainer?: boolean;
}) {
  const warehouse = params.warehouseCode.trim().toLowerCase();
  const name = params.name.trim().toLowerCase();
  const prefix = params.isContainer
    ? "container"
    : params.parentId
      ? `sub::${params.parentId}`
      : "flat";

  if (params.diameterValue === undefined) {
    return `${prefix}::${warehouse}::${name}`;
  }

  const diameterValue = String(params.diameterValue);
  const diameterUnit = params.diameterUnit?.trim().toLowerCase();
  return diameterUnit
    ? `${prefix}::${warehouse}::${name}::${diameterValue}::${diameterUnit}`
    : `${prefix}::${warehouse}::${name}::${diameterValue}`;
}

function parseStockInDate(value?: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
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
  const allowedWarehouseCodes = getReadableFinishedGoodsWarehouseCodes(user);
  const sevenDaysAgo = daysAgo(6);

  const [goods, activities] = await Promise.all([
    prisma.finishedGood.findMany({
      where: {
        warehouseCode: { in: allowedWarehouseCodes },
        isContainer: false,
      },
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

  const goodsByWarehouse = new Map<string, typeof goods>();
  for (const good of goods) {
    const groupedGoods = goodsByWarehouse.get(good.warehouseCode);
    if (groupedGoods) {
      groupedGoods.push(good);
      continue;
    }

    goodsByWarehouse.set(good.warehouseCode, [good]);
  }

  const activityCountByWarehouse = new Map<string, number>();
  const dispatchQuantityByWarehouse = new Map<string, number>();
  for (const activity of activities) {
    const currentCount = activityCountByWarehouse.get(activity.warehouseCode) ?? 0;
    activityCountByWarehouse.set(activity.warehouseCode, currentCount + 1);

    if (activity.activityType === FinishedGoodActivityType.DISPATCH) {
      const currentDispatchQuantity =
        dispatchQuantityByWarehouse.get(activity.warehouseCode) ?? 0;
      dispatchQuantityByWarehouse.set(
        activity.warehouseCode,
        currentDispatchQuantity + Math.abs(quantityToNumber(activity.quantityChange)),
      );
    }
  }

  return FINISHED_GOODS_WAREHOUSE_CATALOG.filter((warehouse) =>
    allowedWarehouseCodes.includes(warehouse.code),
  ).map((warehouse) => {
    const warehouseGoods = goodsByWarehouse.get(warehouse.code) ?? [];
    const dispatchQuantity =
      dispatchQuantityByWarehouse.get(warehouse.code) ?? 0;

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
      recentActivities: activityCountByWarehouse.get(warehouse.code) ?? 0,
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
  const [topLevelGoods, recentActivities, parties] = await Promise.all([
    prisma.finishedGood.findMany({
      where: {
        warehouseCode: resolvedWarehouseCode,
        parentId: null,
      },
      include: {
        subGoods: {
          orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
    prisma.finishedGoodActivityLog.count({
      where: {
        warehouseCode: resolvedWarehouseCode,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.finishedGoodsParty
      .findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      })
      .catch((error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2021"
        ) {
          return [];
        }

        throw error;
      }),
  ]);

  const stockableGoods = topLevelGoods.flatMap((good) =>
    good.isContainer ? good.subGoods : [good],
  );

  return {
    goods: topLevelGoods.map((good) => ({
      baseUnit: good.baseUnit,
      createdAt: good.createdAt.toISOString(),
      currentStock: quantityToNumber(good.currentStock),
      diameterUnit: good.diameterUnit,
      diameterValue: good.diameterValue,
      id: good.id,
      isContainer: good.isContainer,
      name: good.name,
      parentId: good.parentId,
      stockInDate: good.stockInDate.toISOString(),
      status: good.status,
      subGoods: good.subGoods.map((subGood) => ({
        baseUnit: subGood.baseUnit,
        createdAt: subGood.createdAt.toISOString(),
        currentStock: quantityToNumber(subGood.currentStock),
        diameterUnit: subGood.diameterUnit,
        diameterValue: subGood.diameterValue,
        id: subGood.id,
        isContainer: subGood.isContainer,
        name: subGood.name,
        parentId: subGood.parentId,
        stockInDate: subGood.stockInDate.toISOString(),
        status: subGood.status,
        subGoods: [],
        updatedAt: subGood.updatedAt.toISOString(),
        warehouseCode: subGood.warehouseCode,
      })),
      updatedAt: good.updatedAt.toISOString(),
      warehouseCode: good.warehouseCode,
    })),
    stats: {
      inStockCount: stockableGoods.filter(
        (good) => good.status === MaterialStatus.IN_STOCK,
      ).length,
      lowStockCount: stockableGoods.filter(
        (good) => good.status === MaterialStatus.LOW_STOCK,
      ).length,
      outOfStockCount: stockableGoods.filter(
        (good) => good.status === MaterialStatus.OUT_OF_STOCK,
      ).length,
      recentActivities,
      totalCount: stockableGoods.length,
      totalStock: quantityToNumber(
        sumQuantities(stockableGoods.map((good) => good.currentStock)),
      ),
    },
    parties: parties.map((party) => ({
      id: party.id,
      name: party.name,
    })),
    warehouse: {
      code: warehouseMeta.code,
      name: warehouseMeta.name,
      slug: warehouseMeta.slug,
      subtitle: warehouseMeta.subtitle,
    },
  };
}

export async function getFinishedGoodsPdfData(payload: {
  warehouseCode?: string;
  fromDate: string;
  toDate: string;
}) {
  const user = await assertServerPermission("finished_goods:view");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);

  const fromDate = new Date(payload.fromDate);
  const toDate = new Date(payload.toDate);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("Invalid report date range.");
  }

  if (fromDate > toDate) {
    throw new Error("From date must be before to date.");
  }

  const activityLogs = await prisma.finishedGoodActivityLog.findMany({
    where: {
      activityType: {
        in: [
          FinishedGoodActivityType.PRODUCTION,
          FinishedGoodActivityType.DISPATCH,
        ],
      },
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
      warehouseCode,
    },
    select: {
      activityType: true,
      finishedGoodId: true,
      quantityChange: true,
    },
  });

  const totalsByGoodId: Record<string, { dispatch: number; production: number }> = {};

  for (const activityLog of activityLogs) {
    const currentTotals = totalsByGoodId[activityLog.finishedGoodId] ?? {
      dispatch: 0,
      production: 0,
    };

    const quantity = Math.abs(quantityToNumber(activityLog.quantityChange));

    if (activityLog.activityType === FinishedGoodActivityType.PRODUCTION) {
      currentTotals.production += quantity;
    }

    if (activityLog.activityType === FinishedGoodActivityType.DISPATCH) {
      currentTotals.dispatch += quantity;
    }

    totalsByGoodId[activityLog.finishedGoodId] = currentTotals;
  }

  return {
    totalsByGoodId,
  };
}

export type AddFinishedGoodResult =
  | { ok: true }
  | { ok: false; message: string };

export async function createMasterGood(payload: {
  warehouseCode?: string;
  name: string;
}): Promise<AddFinishedGoodResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const parsed = createMasterGoodSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Enter a valid group name.",
    };
  }

  const name = parsed.data.name;
  const normalizedName = buildNormalizedFinishedGoodKey({
    warehouseCode,
    name,
    isContainer: true,
  });

  const existingMaster = await prisma.finishedGood.findFirst({
    where: {
      warehouseCode,
      isContainer: true,
      normalizedName,
      parentId: null,
    },
    select: { id: true },
  });

  if (existingMaster) {
    return {
      ok: false,
      message: "A master group with this name already exists.",
    };
  }

  await prisma.finishedGood.create({
    data: {
      baseUnit: "group",
      currentStock: new Prisma.Decimal(0),
      isContainer: true,
      name,
      normalizedName,
      parentId: null,
      status: MaterialStatus.IN_STOCK,
      warehouseCode,
    },
  });

  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function createSubGood(payload: {
  warehouseCode?: string;
  masterGoodId: string;
  name: string;
  baseUnit: string;
  diameterValue?: number;
  diameterUnit?: string;
  initialStock?: number;
  stockInDate?: string;
}): Promise<AddFinishedGoodResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const parsed = createSubGoodSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Enter valid variant details.",
    };
  }

  const {
    baseUnit,
    diameterUnit,
    diameterValue,
    initialStock,
    masterGoodId,
    name,
    stockInDate,
  } = parsed.data;

  const masterGood = await prisma.finishedGood.findUnique({
    where: { id: masterGoodId },
    select: {
      id: true,
      isContainer: true,
      parentId: true,
      warehouseCode: true,
    },
  });

  if (
    !masterGood ||
    masterGood.warehouseCode !== warehouseCode ||
    !masterGood.isContainer ||
    masterGood.parentId !== null
  ) {
    return { ok: false, message: "Master group not found." };
  }

  const parsedStockInDate = parseStockInDate(stockInDate);
  if (stockInDate && !parsedStockInDate) {
    return { ok: false, message: "Enter a valid stock in date." };
  }

  const variantName = name.trim();
  const normalizedName = buildNormalizedFinishedGoodKey({
    warehouseCode,
    name: variantName,
    diameterUnit,
    diameterValue,
    parentId: masterGood.id,
  });

  const existingSub = await prisma.finishedGood.findFirst({
    where: {
      parentId: masterGood.id,
      normalizedName,
      warehouseCode,
    },
    select: { id: true },
  });

  if (existingSub) {
    return {
      ok: false,
      message: "A variant with these details already exists in this group.",
    };
  }

  const startingStock = toDecimal(initialStock ?? 0);
  const status = resolveStatus(startingStock);

  await prisma.$transaction(async (tx) => {
    const subGood = await tx.finishedGood.create({
      data: {
        baseUnit,
        currentStock: startingStock,
        diameterUnit: diameterValue !== undefined ? diameterUnit ?? null : null,
        diameterValue: diameterValue ?? null,
        isContainer: false,
        name: variantName,
        normalizedName,
        parentId: masterGood.id,
        status,
        stockInDate: parsedStockInDate ?? new Date(),
        warehouseCode,
      },
    });

    if (startingStock.gt(0)) {
      await tx.finishedGoodActivityLog.create({
        data: {
          activityType: FinishedGoodActivityType.PRODUCTION,
          finishedGoodId: subGood.id,
          newStock: startingStock,
          notes: "Initial stock",
          performedById: user.id,
          previousStock: new Prisma.Decimal(0),
          quantityChange: startingStock,
          warehouseCode,
        },
      });
    }
  });

  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function addFinishedGood(payload: {
  warehouseCode?: string;
  name: string;
  baseUnit: string;
  diameterValue?: number;
  diameterUnit?: string;
  initialStock?: number;
  stockInDate?: string;
}): Promise<AddFinishedGoodResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);
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
    isContainer: false,
    name,
    parentId: null,
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
  const parsedStockInDate = parseStockInDate(payload.stockInDate);

  if (payload.stockInDate && !parsedStockInDate) {
    return { ok: false, message: "Enter a valid stock in date." };
  }

  const createFinishedGood = async (includeDiameter: boolean) => {
    await prisma.$transaction(async (tx) => {
      const finishedGood = await tx.finishedGood.create({
        data: {
          baseUnit,
          currentStock: initialStock,
          isContainer: false,
          parentId: null,
          stockInDate: parsedStockInDate ?? new Date(),
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

export type DispatchPartyResult =
  | { ok: true; created: boolean; entity: { id: string; name: string } }
  | { ok: false; message: string };

export async function createDispatchParty(name: string): Promise<DispatchPartyResult> {
  await assertServerPermission("finished_goods:manage");

  const parsedNameResult = recipientNameSchema.safeParse(name);
  if (!parsedNameResult.success) {
    return {
      ok: false,
      message:
        parsedNameResult.error.issues[0]?.message ??
        "Enter a valid party name.",
    };
  }

  const parsedName = parsedNameResult.data;
  const normalizedName = normalizeRecordName(parsedName);

  const existing = await prisma.finishedGoodsParty
    .findFirst({
      where: {
        OR: [
          { normalizedName },
          { name: { equals: parsedName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    })
    .catch((error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        return null;
      }

      throw error;
    });

  if (existing) {
    return {
      ok: true,
      created: false,
      entity: existing,
    };
  }

  try {
    const created = await prisma.finishedGoodsParty.create({
      data: {
        name: parsedName,
        normalizedName,
      },
      select: {
        id: true,
        name: true,
      },
    });

    revalidatePath("/finished-goods");

    return {
      ok: true,
      created: true,
      entity: created,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return {
        ok: false,
        message:
          "Dispatch party setup is pending in the database. Run pnpm db:push once and retry.",
      };
    }

    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const concurrent = await prisma.finishedGoodsParty.findFirst({
      where: {
        OR: [
          { normalizedName },
          { name: { equals: parsedName, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!concurrent) {
      throw error;
    }

    return {
      ok: true,
      created: false,
      entity: concurrent,
    };
  }
}

export async function deleteFinishedGood(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  if (finishedGood.isContainer) {
    return {
      ok: false,
      message:
        "This is a master group. Delete variants first, or use Delete Group when no variants remain.",
    };
  }

  await prisma.finishedGood.delete({ where: { id: finishedGood.id } });

  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function deleteSubGood(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const subGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
    select: {
      id: true,
      isContainer: true,
      parentId: true,
      warehouseCode: true,
    },
  });

  if (
    !subGood ||
    subGood.warehouseCode !== warehouseCode ||
    subGood.isContainer ||
    !subGood.parentId
  ) {
    return { ok: false, message: "Sub-good not found." };
  }

  await prisma.finishedGood.delete({ where: { id: subGood.id } });
  revalidateViews(warehouseCode);
  return { ok: true };
}

export async function deleteMasterGood(payload: {
  warehouseCode?: string;
  masterGoodId: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const master = await prisma.finishedGood.findUnique({
    where: { id: payload.masterGoodId },
    include: {
      subGoods: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (
    !master ||
    master.warehouseCode !== warehouseCode ||
    !master.isContainer ||
    master.parentId !== null
  ) {
    return { ok: false, message: "Master group not found." };
  }

  if (master.subGoods.length > 0) {
    return {
      ok: false,
      message: `Remove all variants first. Remaining: ${master.subGoods
        .map((item) => item.name)
        .join(", ")}.`,
    };
  }

  await prisma.finishedGood.delete({ where: { id: master.id } });
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
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  if (finishedGood.isContainer) {
    return {
      ok: false,
      message: "Cannot record production on a master group. Select a variant.",
    };
  }

  const quantity = toDecimal(payload.quantity);
  const newStock = finishedGood.currentStock.plus(quantity);
  const status = resolveStatus(newStock);

  await prisma.$transaction(
    async (tx) => {
      await tx.finishedGood.update({
        where: { id: finishedGood.id },
        data: { currentStock: newStock, status, stockInDate: new Date() },
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

export type DispatchActionResult =
  | { ok: true; partyName: string }
  | { ok: false; message: string };

export async function addDispatch(payload: {
  warehouseCode?: string;
  finishedGoodId: string;
  partyName: string;
  quantity: number;
  notes?: string;
}): Promise<DispatchActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  const parsedPartyNameResult = recipientNameSchema.safeParse(payload.partyName);
  if (!parsedPartyNameResult.success) {
    return {
      ok: false,
      message:
        parsedPartyNameResult.error.issues[0]?.message ??
        "Enter a valid party name.",
    };
  }

  const parsedPartyName = parsedPartyNameResult.data;

  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const finishedGood = await prisma.finishedGood.findUnique({
    where: { id: payload.finishedGoodId },
  });

  if (!finishedGood || finishedGood.warehouseCode !== warehouseCode) {
    return { ok: false, message: "Finished good not found." };
  }

  if (finishedGood.isContainer) {
    return {
      ok: false,
      message: "Cannot record dispatch on a master group. Select a variant.",
    };
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

  const normalizedPartyName = normalizeRecordName(parsedPartyName);

  const slipDetails = [`Party: ${parsedPartyName}`];
  if (payload.notes?.trim()) {
    slipDetails.push(`Notes: ${payload.notes.trim()}`);
  }
  const notes = slipDetails.join(" | ");

  const newStock = finishedGood.currentStock.minus(quantity);
  const status = resolveStatus(newStock);

  const result = await prisma.$transaction(
    async (tx) => {
      try {
        const existingParty = await tx.finishedGoodsParty.findFirst({
          where: {
            OR: [
              { normalizedName: normalizedPartyName },
              { name: { equals: parsedPartyName, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
          },
        });

        if (!existingParty) {
          await tx.finishedGoodsParty.create({
            data: {
              name: parsedPartyName,
              normalizedName: normalizedPartyName,
            },
          });
        }
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          (error.code !== "P2002" && error.code !== "P2021")
        ) {
          throw error;
        }
      }

      await tx.finishedGood.update({
        where: { id: finishedGood.id },
        data: { currentStock: newStock, status, stockInDate: new Date() },
      });

      await tx.finishedGoodActivityLog.create({
        data: {
          activityType: FinishedGoodActivityType.DISPATCH,
          finishedGoodId: finishedGood.id,
          newStock,
          notes,
          performedById: user.id,
          previousStock: finishedGood.currentStock,
          quantityChange: quantity.neg(),
          warehouseCode: finishedGood.warehouseCode,
        },
      });

      return { ok: true, partyName: parsedPartyName };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  revalidateViews(warehouseCode);
  return { ok: true, partyName: result.partyName };
}

export type BulkStockActionResult =
  | { ok: true; processed: number }
  | { ok: false; message: string };

export async function bulkEditFinishedGoodsStock(payload: {
  warehouseCode?: string;
  items: Array<{ finishedGoodId: string; quantity: number }>;
  notes?: string;
}): Promise<BulkStockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const warehouseCode = requireAllowedWarehouseCode(user, payload.warehouseCode);
  assertOwnsFinishedGoodsWarehouse(user, warehouseCode);

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, message: "Select at least one finished good." };
  }

  const consolidated = new Map<string, number>();
  for (const item of payload.items) {
    const quantity = Number(item.quantity);
    if (!item.finishedGoodId) {
      return { ok: false, message: "One or more selected goods are invalid." };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, message: "Each selected quantity must be greater than 0." };
    }

    const currentQty = consolidated.get(item.finishedGoodId) ?? 0;
    consolidated.set(item.finishedGoodId, currentQty + quantity);
  }

  const entries = Array.from(consolidated.entries());
  const finishedGoods = await prisma.finishedGood.findMany({
    where: {
      id: { in: entries.map(([finishedGoodId]) => finishedGoodId) },
      warehouseCode,
    },
  });

  if (finishedGoods.length !== entries.length) {
    return {
      ok: false,
      message: "One or more selected finished goods were not found in this warehouse.",
    };
  }

  const containerSelection = finishedGoods.find((good) => good.isContainer);
  if (containerSelection) {
    return {
      ok: false,
      message: "Bulk edit only supports variants and flat goods, not master groups.",
    };
  }

  const goodsById = new Map(finishedGoods.map((good) => [good.id, good]));

  const normalizedNotes = payload.notes?.trim();
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      for (const [finishedGoodId, quantityAsNumber] of entries) {
        const good = goodsById.get(finishedGoodId);
        if (!good) {
          throw new Error("Selected finished good not found.");
        }

        const quantity = toDecimal(quantityAsNumber);
        const quantityChange = quantity;
        const newStock = good.currentStock.plus(quantity);
        const status = resolveStatus(newStock);

        await tx.finishedGood.update({
          where: { id: good.id },
          data: {
            currentStock: newStock,
            status,
            stockInDate: now,
          },
        });

        await tx.finishedGoodActivityLog.create({
          data: {
            activityType: FinishedGoodActivityType.PRODUCTION,
            finishedGoodId: good.id,
            newStock,
            notes: normalizedNotes || null,
            performedById: user.id,
            previousStock: good.currentStock,
            quantityChange,
            warehouseCode,
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  revalidateViews(warehouseCode);
  return { ok: true, processed: entries.length };
}
