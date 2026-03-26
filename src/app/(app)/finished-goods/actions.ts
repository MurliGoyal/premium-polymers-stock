"use server";

import { FinishedGoodActivityType, MaterialStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertServerPermission } from "@/lib/auth";
import { FINISHED_GOODS_WAREHOUSE_CODE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, toDecimal } from "@/lib/quantities";

function revalidateViews() {
  revalidatePath("/finished-goods");
  revalidatePath("/finished-goods-history");
}

function resolveStatus(stock: Prisma.Decimal): MaterialStatus {
  if (stock.lte(0)) return MaterialStatus.OUT_OF_STOCK;
  return MaterialStatus.IN_STOCK;
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

export async function getFinishedGoodsData() {
  await assertServerPermission("finished_goods:view");

  const goods = await prisma.finishedGood.findMany({
    where: { warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE },
    orderBy: { name: "asc" },
  });

  return goods.map((g) => ({
    id: g.id,
    name: g.name,
    warehouseCode: g.warehouseCode,
    baseUnit: g.baseUnit,
    diameterValue: g.diameterValue,
    diameterUnit: g.diameterUnit,
    currentStock: quantityToNumber(g.currentStock),
    status: g.status,
  }));
}

export type AddFinishedGoodResult = { ok: true } | { ok: false; message: string };

export async function addFinishedGood(payload: {
  name: string;
  baseUnit: string;
  diameterValue?: number;
  diameterUnit?: string;
  initialStock?: number;
}): Promise<AddFinishedGoodResult> {
  const user = await assertServerPermission("finished_goods:manage");
  const name = payload.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  const baseUnit = payload.baseUnit.trim();
  if (!baseUnit) return { ok: false, message: "Unit is required." };
  const diameterValue = payload.diameterValue;
  const diameterUnit = payload.diameterUnit?.trim();
  const hasDiameter = diameterValue !== undefined;

  if (hasDiameter) {
    if (!Number.isFinite(diameterValue) || diameterValue < 0) {
      return { ok: false, message: "Diameter must be a valid non-negative number." };
    }
    if (!diameterUnit) {
      return { ok: false, message: "Diameter unit is required when diameter is provided." };
    }
  }

  const normalizedName = buildNormalizedFinishedGoodKey({
    warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE,
    name,
    diameterValue,
    diameterUnit,
  });

  const existing = await prisma.finishedGood.findUnique({ where: { normalizedName } });
  if (existing) return { ok: false, message: "A finished good with this name and diameter already exists." };

  const initialStock = toDecimal(payload.initialStock ?? 0);
  const status = resolveStatus(initialStock);

  const createFinishedGood = async (includeDiameter: boolean) => {
    await prisma.$transaction(async (tx) => {
      const fg = await tx.finishedGood.create({
        data: {
          name,
          normalizedName,
          warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE,
          baseUnit,
          ...(includeDiameter
            ? {
                diameterValue: diameterValue ?? null,
                diameterUnit: diameterValue !== undefined ? diameterUnit ?? null : null,
              }
            : {}),
          currentStock: initialStock,
          status,
        },
      });

      if (initialStock.gt(0)) {
        await tx.finishedGoodActivityLog.create({
          data: {
            finishedGoodId: fg.id,
            warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE,
            activityType: FinishedGoodActivityType.PRODUCTION,
            quantityChange: initialStock,
            previousStock: new Prisma.Decimal(0),
            newStock: initialStock,
            notes: "Initial stock",
            performedById: user.id,
          },
        });
      }
    });
  };

  try {
    await createFinishedGood(true);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { ok: false, message: "A finished good with this name and diameter already exists." };
      }
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
        return { ok: false, message: "Failed to add finished good. Please try again." };
      }
      revalidateViews();
      return { ok: true };
    }

    return { ok: false, message: "Failed to add finished good. Please try again." };
  }

  revalidateViews();
  return { ok: true };
}

export type StockActionResult = { ok: true } | { ok: false; message: string };

export async function deleteFinishedGood(payload: {
  finishedGoodId: string;
}): Promise<StockActionResult> {
  await assertServerPermission("finished_goods:manage");

  const fg = await prisma.finishedGood.findUnique({ where: { id: payload.finishedGoodId } });
  if (!fg) return { ok: false, message: "Finished good not found." };

  await prisma.finishedGood.delete({ where: { id: fg.id } });

  revalidateViews();
  return { ok: true };
}

export async function addProduction(payload: {
  finishedGoodId: string;
  quantity: number;
  notes?: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const fg = await prisma.finishedGood.findUnique({ where: { id: payload.finishedGoodId } });
  if (!fg) return { ok: false, message: "Finished good not found." };

  const qty = toDecimal(payload.quantity);
  const newStock = fg.currentStock.plus(qty);
  const status = resolveStatus(newStock);

  await prisma.$transaction(async (tx) => {
    await tx.finishedGood.update({
      where: { id: fg.id },
      data: { currentStock: newStock, status },
    });
    await tx.finishedGoodActivityLog.create({
      data: {
        finishedGoodId: fg.id,
        warehouseCode: fg.warehouseCode,
        activityType: FinishedGoodActivityType.PRODUCTION,
        quantityChange: qty,
        previousStock: fg.currentStock,
        newStock,
        notes: payload.notes?.trim() || null,
        performedById: user.id,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidateViews();
  return { ok: true };
}

export async function addDispatch(payload: {
  finishedGoodId: string;
  quantity: number;
  notes?: string;
}): Promise<StockActionResult> {
  const user = await assertServerPermission("finished_goods:manage");
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, message: "Enter a valid positive quantity." };
  }

  const fg = await prisma.finishedGood.findUnique({ where: { id: payload.finishedGoodId } });
  if (!fg) return { ok: false, message: "Finished good not found." };

  const qty = toDecimal(payload.quantity);
  if (fg.currentStock.lt(qty)) {
    return { ok: false, message: `Cannot dispatch ${payload.quantity} — only ${quantityToNumber(fg.currentStock)} ${fg.baseUnit} available.` };
  }

  const newStock = fg.currentStock.minus(qty);
  const status = resolveStatus(newStock);

  await prisma.$transaction(async (tx) => {
    await tx.finishedGood.update({
      where: { id: fg.id },
      data: { currentStock: newStock, status },
    });
    await tx.finishedGoodActivityLog.create({
      data: {
        finishedGoodId: fg.id,
        warehouseCode: fg.warehouseCode,
        activityType: FinishedGoodActivityType.DISPATCH,
        quantityChange: qty.neg(),
        previousStock: fg.currentStock,
        newStock,
        notes: payload.notes?.trim() || null,
        performedById: user.id,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidateViews();
  return { ok: true };
}
