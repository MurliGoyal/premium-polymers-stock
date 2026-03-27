import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { resolveFinishedGoodsWarehouseForUser } from "@/lib/auth";
import { getDateOnlySearchParam, getMatchingOptionValue, getTrimmedSearchParam } from "@/lib/drilldowns";
import { prisma } from "@/lib/prisma";
import { quantityToNumber } from "@/lib/quantities";
import { StockHistoryClient } from "./stock-history-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatDiameterLabel(value: number | null, unit: string | null) {
  if (value === null) {
    return null;
  }

  const valueLabel = Number.isInteger(value) ? String(value) : String(value);
  return unit ? `${valueLabel} ${unit}` : valueLabel;
}

function getFinishedGoodLabel(good: { name: string; diameterValue: number | null; diameterUnit: string | null }) {
  const diameter = formatDiameterLabel(good.diameterValue, good.diameterUnit);
  return diameter ? `${good.name} (${diameter})` : good.name;
}

function resolveWarehouseCode(searchParams: Record<string, string | string[] | undefined>) {
  const requested = Array.isArray(searchParams.warehouse) ? searchParams.warehouse[0] : searchParams.warehouse;
  return requested?.trim() ?? undefined;
}

export default async function FinishedGoodsHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePagePermission("finished_goods_history:view");
  const resolvedSearchParams = await searchParams;
  const warehouseCode = resolveFinishedGoodsWarehouseForUser(
    user,
    resolveWarehouseCode(resolvedSearchParams),
  );

  if (!warehouseCode) {
    redirect("/login");
  }

  const [activities, finishedGoods] = await Promise.all([
    prisma.finishedGoodActivityLog.findMany({
      where: { warehouseCode },
      orderBy: { createdAt: "desc" },
      include: {
        finishedGood: { select: { id: true, name: true, baseUnit: true, diameterValue: true, diameterUnit: true } },
        performedBy: { select: { name: true } },
      },
    }),
    prisma.finishedGood.findMany({
      where: { warehouseCode },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        currentStock: true,
        createdAt: true,
        updatedAt: true,
        diameterValue: true,
        diameterUnit: true,
      },
      orderBy: [{ name: "asc" }, { diameterValue: "asc" }],
    }),
  ]);

  const goodOptions = finishedGoods.map((g) => ({
    id: g.id,
    label: getFinishedGoodLabel(g),
    baseUnit: g.baseUnit,
    currentStock: quantityToNumber(g.currentStock),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));
  const userNames = [...new Set(activities.map((activity) => activity.performedBy?.name || "System"))].sort();
  const activityTypes = [...new Set(activities.map((a) => a.activityType))];

  const initialGoodFilter = getMatchingOptionValue(goodOptions.map((g) => g.id), resolvedSearchParams.good);
  const initialTypeFilter = (() => {
    const requested = getTrimmedSearchParam(resolvedSearchParams.type);
    return activityTypes.includes(requested as (typeof activityTypes)[number]) ? requested : "all";
  })();
  const initialUserFilter = getMatchingOptionValue(userNames, resolvedSearchParams.user);
  const initialFromDate = getDateOnlySearchParam(resolvedSearchParams.from);
  const initialToDate = getDateOnlySearchParam(resolvedSearchParams.to);

  const clientKey = [warehouseCode, initialGoodFilter, initialTypeFilter, initialUserFilter, initialFromDate, initialToDate].join("|");

  const data = activities.map((a) => ({
    id: a.id,
    goodId: a.finishedGood.id,
    goodLabel: getFinishedGoodLabel(a.finishedGood),
    goodUnit: a.finishedGood.baseUnit,
    warehouseCode: a.warehouseCode,
    activityType: a.activityType,
    quantityChange: quantityToNumber(a.quantityChange),
    previousStock: quantityToNumber(a.previousStock),
    newStock: quantityToNumber(a.newStock),
    notes: a.notes,
    performedBy: a.performedBy?.name || "System",
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <StockHistoryClient
      key={clientKey}
      activities={data}
      warehouseCode={warehouseCode}
      finishedGoods={goodOptions}
      users={userNames}
      initialGoodFilter={initialGoodFilter}
      initialTypeFilter={initialTypeFilter}
      initialUserFilter={initialUserFilter}
      initialFromDate={initialFromDate}
      initialToDate={initialToDate}
    />
  );
}
