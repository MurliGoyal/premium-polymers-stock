import { requirePagePermission } from "@/lib/auth";
import { getDateOnlySearchParam, getMatchingOptionValue, getTrimmedSearchParam } from "@/lib/drilldowns";
import { FINISHED_GOODS_WAREHOUSE_CODE } from "@/lib/constants";
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

export default async function FinishedGoodsHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("finished_goods_history:view");

  const [activities, finishedGoods, users] = await Promise.all([
    prisma.finishedGoodActivityLog.findMany({
      where: { warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        finishedGood: { select: { id: true, name: true, baseUnit: true, diameterValue: true, diameterUnit: true } },
        performedBy: { select: { name: true } },
      },
    }),
    prisma.finishedGood.findMany({
      where: { warehouseCode: FINISHED_GOODS_WAREHOUSE_CODE },
      select: { id: true, name: true, diameterValue: true, diameterUnit: true },
      orderBy: [{ name: "asc" }, { diameterValue: "asc" }],
    }),
    prisma.user.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const resolvedSearchParams = await searchParams;
  const goodOptions = finishedGoods.map((g) => ({
    id: g.id,
    label: getFinishedGoodLabel(g),
  }));
  const userNames = users.map((u) => u.name);
  const activityTypes = [...new Set(activities.map((a) => a.activityType))];

  const initialGoodFilter = getMatchingOptionValue(goodOptions.map((g) => g.id), resolvedSearchParams.good);
  const initialTypeFilter = (() => {
    const requested = getTrimmedSearchParam(resolvedSearchParams.type);
    return activityTypes.includes(requested as (typeof activityTypes)[number]) ? requested : "all";
  })();
  const initialUserFilter = getMatchingOptionValue(userNames, resolvedSearchParams.user);
  const initialFromDate = getDateOnlySearchParam(resolvedSearchParams.from);
  const initialToDate = getDateOnlySearchParam(resolvedSearchParams.to);

  const clientKey = [initialGoodFilter, initialTypeFilter, initialUserFilter, initialFromDate, initialToDate].join("|");

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
      warehouseCode={FINISHED_GOODS_WAREHOUSE_CODE}
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
