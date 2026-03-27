"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Clock3,
  Package,
  Search,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { ResponsiveFiltersSheet } from "@/components/shared/responsive-filters-sheet";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APP_TIME_ZONE, FINISHED_GOODS_PAGE_SIZE } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, getAppDateKey, getAppStartOfDay } from "@/lib/utils";

type ActivityRecord = {
  id: string;
  goodId: string;
  goodLabel: string;
  goodUnit: string;
  warehouseCode: string;
  activityType: string;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  notes: string | null;
  performedBy: string;
  createdAt: string;
};

type FinishedGoodOption = {
  id: string;
  label: string;
  baseUnit: string;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
};

type IndexedActivity = ActivityRecord & {
  dateKey: string;
};

type RangePresetKey = "all" | "today" | "this-week" | "last-week" | "this-month";

const DAY_MS = 24 * 60 * 60 * 1000;
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" });
const weekdayIndexes: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const RANGE_PRESETS: Array<{ key: RangePresetKey; label: string }> = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "this-month", label: "This month" },
];

function getActivityLabel(type: string) {
  const labels: Record<string, string> = {
    PRODUCTION: "Production",
    DISPATCH: "Dispatch",
    STOCK_ADJUSTED: "Stock Adjusted",
  };
  return labels[type] || type;
}

function getActivityColor(type: string) {
  switch (type) {
    case "PRODUCTION":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400";
    case "DISPATCH":
      return "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400";
    case "STOCK_ADJUSTED":
      return "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400";
    default:
      return "text-slate-600 bg-slate-50 dark:bg-slate-950 dark:text-slate-400";
  }
}

function todayDateKey() {
  return getAppDateKey(new Date());
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return getAppDateKey(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

function getWeekStartDateKey(reference = new Date()) {
  const todayKey = getAppDateKey(reference);
  const weekdayIndex = weekdayIndexes[weekdayFormatter.format(reference)] ?? 0;
  const offset = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
  return shiftDateKey(todayKey, offset);
}

function getPresetRange(key: RangePresetKey) {
  const todayKey = todayDateKey();
  const currentWeekStart = getWeekStartDateKey();

  switch (key) {
    case "today":
      return { from: todayKey, to: todayKey };
    case "this-week":
      return { from: currentWeekStart, to: todayKey };
    case "last-week":
      return { from: shiftDateKey(currentWeekStart, -7), to: shiftDateKey(currentWeekStart, -1) };
    case "this-month":
      return { from: `${todayKey.slice(0, 7)}-01`, to: todayKey };
    default:
      return { from: "", to: "" };
  }
}

function normalizeDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate > toDate) {
    return { from: toDate, to: fromDate };
  }

  return { from: fromDate, to: toDate };
}

function matchesPreset(fromDate: string, toDate: string, key: RangePresetKey) {
  const preset = getPresetRange(key);
  return preset.from === fromDate && preset.to === toDate;
}

function getRangeLabel(fromDate: string, toDate: string) {
  if (!fromDate && !toDate) {
    return "All time";
  }

  const knownPresets: Array<{ key: RangePresetKey; label: string }> = [
    { key: "today", label: "Today" },
    { key: "this-week", label: "This week" },
    { key: "last-week", label: "Last week" },
    { key: "this-month", label: "This month" },
  ];

  for (const preset of knownPresets) {
    if (matchesPreset(fromDate, toDate, preset.key)) {
      return preset.label;
    }
  }

  if (fromDate && toDate && fromDate === toDate) {
    return formatDate(fromDate);
  }

  if (fromDate && toDate) {
    return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
  }

  if (fromDate) {
    return `From ${formatDate(fromDate)}`;
  }

  return `Until ${formatDate(toDate)}`;
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return "0";
}

function formatIdleLabel(date: string) {
  const idleDays = Math.max(0, Math.floor((getAppStartOfDay(new Date()).getTime() - getAppStartOfDay(date).getTime()) / DAY_MS));

  if (idleDays === 0) return "Moved today";
  if (idleDays === 1) return "Idle for 1 day";
  return `Idle for ${formatNumber(idleDays)} days`;
}

function summarizeUnitQuantities(
  entries: Array<{ quantity: number; unit: string }>,
  options?: { mixedValue?: string; signed?: boolean },
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.quantity) continue;
    totals.set(entry.unit, (totals.get(entry.unit) ?? 0) + entry.quantity);
  }

  const breakdown = [...totals.entries()]
    .map(([unit, quantity]) => ({ quantity, unit }))
    .sort((left, right) => Math.abs(right.quantity) - Math.abs(left.quantity));

  if (breakdown.length === 0) {
    return { meta: "No matching activity", value: "0" };
  }

  if (breakdown.length === 1) {
    const [single] = breakdown;
    return {
      meta: `${entries.length} matching ${entries.length === 1 ? "activity" : "activities"}`,
      value: `${options?.signed ? formatSignedNumber(single.quantity) : formatNumber(single.quantity)} ${single.unit}`,
    };
  }

  const preview = breakdown
    .slice(0, 3)
    .map((entry) => `${options?.signed ? formatSignedNumber(entry.quantity) : formatNumber(entry.quantity)} ${entry.unit}`)
    .join(" / ");

  return {
    meta: `${preview}${breakdown.length > 3 ? ` +${breakdown.length - 3} more` : ""}`,
    value: options?.mixedValue ?? `${breakdown.length} unit groups`,
  };
}

function pickTopEntry<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce<T | null>((best, item) => {
    if (getValue(item) <= 0) return best;
    if (!best || getValue(item) > getValue(best)) return item;
    return best;
  }, null);
}

export function StockHistoryClient({
  activities,
  warehouseCode,
  finishedGoods,
  users,
  initialGoodFilter = "all",
  initialTypeFilter = "all",
  initialUserFilter = "all",
  initialFromDate = "",
  initialToDate = "",
}: {
  activities: ActivityRecord[];
  warehouseCode: string;
  finishedGoods: FinishedGoodOption[];
  users: string[];
  initialGoodFilter?: string;
  initialTypeFilter?: string;
  initialUserFilter?: string;
  initialFromDate?: string;
  initialToDate?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [goodFilter, setGoodFilter] = useState(initialGoodFilter);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [userFilter, setUserFilter] = useState(initialUserFilter);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [page, setPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const indexedActivities = useMemo<IndexedActivity[]>(
    () => activities.map((activity) => ({ ...activity, dateKey: getAppDateKey(activity.createdAt) })),
    [activities],
  );
  const normalizedRange = useMemo(() => normalizeDateRange(fromDate, toDate), [fromDate, toDate]);
  const currentRangeLabel = useMemo(
    () => getRangeLabel(normalizedRange.from, normalizedRange.to),
    [normalizedRange.from, normalizedRange.to],
  );

  const activityTypes = useMemo(() => [...new Set(activities.map((activity) => activity.activityType))], [activities]);
  const finishedGoodsById = useMemo(() => new Map(finishedGoods.map((good) => [good.id, good])), [finishedGoods]);
  const activePresetKey = useMemo(
    () => RANGE_PRESETS.find((preset) => matchesPreset(normalizedRange.from, normalizedRange.to, preset.key))?.key ?? null,
    [normalizedRange.from, normalizedRange.to],
  );

  const filtered = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return indexedActivities.filter((activity) => {
      const searchableText = [
        activity.goodLabel,
        activity.goodUnit,
        activity.notes ?? "",
        activity.performedBy,
        activity.warehouseCode,
        getActivityLabel(activity.activityType),
        String(Math.abs(activity.quantityChange)),
      ]
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) return false;
      if (goodFilter !== "all" && activity.goodId !== goodFilter) return false;
      if (typeFilter !== "all" && activity.activityType !== typeFilter) return false;
      if (userFilter !== "all" && activity.performedBy !== userFilter) return false;
      if (normalizedRange.from && activity.dateKey < normalizedRange.from) return false;
      if (normalizedRange.to && activity.dateKey > normalizedRange.to) return false;

      return true;
    });
  }, [deferredSearch, goodFilter, indexedActivities, normalizedRange.from, normalizedRange.to, typeFilter, userFilter]);

  const analytics = useMemo(() => {
    const goodsById = new Map<
      string,
      { dispatch: number; label: string; moves: number; net: number; production: number; unit: string }
    >();
    const filteredGoodIds = new Set<string>();
    const productionEntries: Array<{ quantity: number; unit: string }> = [];
    const dispatchEntries: Array<{ quantity: number; unit: string }> = [];
    const netEntries: Array<{ quantity: number; unit: string }> = [];
    let productionCount = 0;
    let dispatchCount = 0;
    let adjustmentCount = 0;

    for (const activity of filtered) {
      filteredGoodIds.add(activity.goodId);
      netEntries.push({ quantity: activity.quantityChange, unit: activity.goodUnit });

      const current = goodsById.get(activity.goodId) ?? {
        dispatch: 0,
        label: activity.goodLabel,
        moves: 0,
        net: 0,
        production: 0,
        unit: activity.goodUnit,
      };

      current.moves += 1;
      current.net += activity.quantityChange;

      if (activity.activityType === "PRODUCTION") {
        const quantity = Math.max(activity.quantityChange, 0);
        current.production += quantity;
        productionEntries.push({ quantity, unit: activity.goodUnit });
        productionCount += 1;
      } else if (activity.activityType === "DISPATCH") {
        const quantity = Math.abs(activity.quantityChange);
        current.dispatch += quantity;
        dispatchEntries.push({ quantity, unit: activity.goodUnit });
        dispatchCount += 1;
      } else if (activity.activityType === "STOCK_ADJUSTED") {
        adjustmentCount += 1;
      }

      goodsById.set(activity.goodId, current);
    }

    const goods = [...goodsById.entries()].map(([goodId, summary]) => ({ goodId, ...summary }));

    return {
      adjustmentCount,
      dispatch: summarizeUnitQuantities(dispatchEntries),
      dispatchCount,
      filteredGoodIds,
      goods,
      matchingActivities: filtered.length,
      mostActive: pickTopEntry(goods, (item) => item.moves),
      net: summarizeUnitQuantities(netEntries, { mixedValue: "Mixed units", signed: true }),
      production: summarizeUnitQuantities(productionEntries),
      productionCount,
      topDispatched: pickTopEntry(goods, (item) => item.dispatch),
      topProduced: pickTopEntry(goods, (item) => item.production),
      uniqueGoodsCount: goods.length,
    };
  }, [filtered]);

  const lastActivityByGoodId = useMemo(() => {
    const map = new Map<string, string>();

    for (const activity of indexedActivities) {
      const current = map.get(activity.goodId);
      if (!current || activity.createdAt > current) {
        map.set(activity.goodId, activity.createdAt);
      }
    }

    return map;
  }, [indexedActivities]);

  const idleInsights = useMemo(() => {
    const goodsInScope = finishedGoods
      .filter((good) => goodFilter === "all" || good.id === goodFilter)
      .filter((good) => good.currentStock > 0)
      .map((good) => ({
        ...good,
        hasMatchingMovement: analytics.filteredGoodIds.has(good.id),
        lastMovementAt: lastActivityByGoodId.get(good.id) ?? good.updatedAt ?? good.createdAt,
      }))
      .sort((left, right) => new Date(left.lastMovementAt).getTime() - new Date(right.lastMovementAt).getTime());

    return {
      oldestIdle: goodsInScope[0] ?? null,
      quietGoods: goodsInScope.filter((good) => !good.hasMatchingMovement),
    };
  }, [analytics.filteredGoodIds, finishedGoods, goodFilter, lastActivityByGoodId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / FINISHED_GOODS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * FINISHED_GOODS_PAGE_SIZE, currentPage * FINISHED_GOODS_PAGE_SIZE);

  const selectedGoodLabel = goodFilter !== "all" ? (finishedGoodsById.get(goodFilter)?.label ?? goodFilter) : null;
  const activeFilters = [
    selectedGoodLabel ? `Good: ${selectedGoodLabel}` : null,
    typeFilter !== "all" ? `Type: ${getActivityLabel(typeFilter)}` : null,
    userFilter !== "all" ? `User: ${userFilter}` : null,
    normalizedRange.from ? `From: ${normalizedRange.from}` : null,
    normalizedRange.to ? `To: ${normalizedRange.to}` : null,
  ].filter(Boolean) as string[];
  const hasActiveFilters = activeFilters.length > 0 || Boolean(deferredSearch.trim());

  const resetFilters = () => {
    setSearch("");
    setGoodFilter("all");
    setTypeFilter("all");
    setUserFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const applyPreset = (key: RangePresetKey) => {
    const preset = getPresetRange(key);
    setFromDate(preset.from);
    setToDate(preset.to);
    setPage(1);
  };

  const filters = (
    <>
      <div className="relative md:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by finished good, notes, user, or activity"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="pl-11"
        />
      </div>
      <Select
        value={goodFilter}
        onValueChange={(value) => {
          setGoodFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Finished good" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All finished goods</SelectItem>
          {finishedGoods.map((good) => (
            <SelectItem key={good.id} value={good.id}>
              {good.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={typeFilter}
        onValueChange={(value) => {
          setTypeFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Activity type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {activityTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {getActivityLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={userFilter}
        onValueChange={(value) => {
          setUserFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="User" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All users</SelectItem>
          {users.map((user) => (
            <SelectItem key={user} value={user}>
              {user}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From date</p>
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">To date</p>
          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
    </>
  );

  const activityMix = [
    analytics.productionCount > 0 ? `${analytics.productionCount} production` : null,
    analytics.dispatchCount > 0 ? `${analytics.dispatchCount} dispatch` : null,
    analytics.adjustmentCount > 0 ? `${analytics.adjustmentCount} adjustments` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  const metricCards = [
    {
      icon: ArrowUpRight,
      label: "Total production",
      meta: analytics.production.meta,
      tone: "emerald" as const,
      value: analytics.production.value,
    },
    {
      icon: ArrowDownRight,
      label: "Total dispatch",
      meta: analytics.dispatch.meta,
      tone: "amber" as const,
      value: analytics.dispatch.value,
    },
    {
      icon: ArrowRightLeft,
      label: "Net movement",
      meta: analytics.net.meta,
      tone: "blue" as const,
      value: analytics.net.value,
    },
    {
      icon: Activity,
      label: "Matching logs",
      meta: activityMix || "No matching activity",
      tone: "default" as const,
      value: formatNumber(analytics.matchingActivities),
    },
    {
      icon: Package,
      label: "Goods touched",
      meta: analytics.mostActive ? `${analytics.mostActive.label} has the most movement` : "No finished goods matched this view",
      tone: "default" as const,
      value: formatNumber(analytics.uniqueGoodsCount),
    },
  ];

  const insightCards = [
    {
      icon: ArrowUpRight,
      label: "Top production item",
      meta: analytics.topProduced
        ? `${formatNumber(analytics.topProduced.production)} ${analytics.topProduced.unit} produced`
        : "No production recorded in this view",
      tone: "emerald" as const,
      value: analytics.topProduced?.label ?? "No production yet",
    },
    {
      icon: ArrowDownRight,
      label: "Top dispatch item",
      meta: analytics.topDispatched
        ? `${formatNumber(analytics.topDispatched.dispatch)} ${analytics.topDispatched.unit} dispatched`
        : "No dispatch recorded in this view",
      tone: "amber" as const,
      value: analytics.topDispatched?.label ?? "No dispatch yet",
    },
    {
      icon: Clock3,
      label: "Oldest idle stock",
      meta: idleInsights.oldestIdle
        ? `${formatNumber(idleInsights.oldestIdle.currentStock)} ${idleInsights.oldestIdle.baseUnit} on hand / Last moved ${formatDate(idleInsights.oldestIdle.lastMovementAt)}`
        : "No stock is currently sitting idle",
      tone: "blue" as const,
      value: idleInsights.oldestIdle ? `${idleInsights.oldestIdle.label} / ${formatIdleLabel(idleInsights.oldestIdle.lastMovementAt)}` : "Nothing idle",
    },
    {
      icon: BarChart3,
      label: "Quiet stock in current view",
      meta:
        idleInsights.quietGoods.length > 0
          ? idleInsights.quietGoods
              .slice(0, 2)
              .map((good) => good.label)
              .join(" / ")
          : "Every in-stock good has matching movement in this view",
      tone: "default" as const,
      value:
        idleInsights.quietGoods.length > 0
          ? `${formatNumber(idleInsights.quietGoods.length)} goods without matching movement`
          : "No quiet stock",
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow={`Warehouse ${warehouseCode}`}
          title="Stock History"
          description={`Audit trail with range summaries, dispatch totals, and idle stock insights for ${currentRangeLabel}.`}
          badge={<Badge variant="secondary">{filtered.length} matching records</Badge>}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quick ranges</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use presets to compare weekly production, dispatch, and older stock without rebuilding the filters.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit">
                  <CalendarRange className="mr-1 h-3.5 w-3.5" />
                  {currentRangeLabel}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    size="sm"
                    variant={activePresetKey === preset.key ? "default" : "outline"}
                    onClick={() => applyPreset(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">{filters}</div>

            <div className="space-y-3 md:hidden">
              <ResponsiveFiltersSheet
                activeCount={activeFilters.length}
                title="Stock history filters"
                description="Search logs, narrow the date window, and focus on one finished good or operator."
              >
                {filters}
              </ResponsiveFiltersSheet>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by finished good, notes, user, or activity"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="pl-11"
                />
              </div>
            </div>

            {activeFilters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter} variant="outline">
                    {filter}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">
        {metricCards.map((card, index) => (
          <MetricCard
            key={card.label}
            className={index === metricCards.length - 1 ? "sm:col-span-2 xl:col-span-1" : undefined}
            icon={card.icon}
            label={card.label}
            meta={card.meta}
            tone={card.tone}
            value={card.value}
          />
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insightCards.map((card) => (
          <InsightCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            meta={card.meta}
            tone={card.tone}
            value={card.value}
          />
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No activity found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters ? "No results match your filters." : "Stock history will appear here once production or dispatch is recorded."}
              </p>
              {hasActiveFilters ? (
                <Button type="button" variant="outline" onClick={resetFilters} className="mt-4">
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
                {paginated.map((activity) => (
                  <Card key={activity.id} className="cursor-pointer rounded-2xl sm:rounded-[24px]" onClick={() => setSelectedActivity(activity)}>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{activity.warehouseCode}</Badge>
                            <Badge variant="outline" className={getActivityColor(activity.activityType)}>
                              {getActivityLabel(activity.activityType)}
                            </Badge>
                          </div>
                          <p className="text-base font-semibold">{activity.goodLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Change</p>
                          <p className={activity.quantityChange < 0 ? "mt-1 text-lg font-semibold text-red-300" : "mt-1 text-lg font-semibold text-emerald-300"}>
                            {activity.quantityChange > 0 ? "+" : ""}
                            {formatNumber(activity.quantityChange)}
                            <span className="ml-1 text-xs text-muted-foreground">{activity.goodUnit}</span>
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Before</p>
                          <p className="mt-2 font-medium">{formatNumber(activity.previousStock)}</p>
                        </div>
                        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">After</p>
                          <p className="mt-2 font-medium">{formatNumber(activity.newStock)}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-muted-foreground sm:rounded-[22px]">
                        {formatDateTime(activity.createdAt)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden max-h-[680px] overflow-auto xl:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-card">
                      <TableHead>Finished Good</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Performed by</TableHead>
                      <TableHead>Date / time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((activity) => (
                      <TableRow key={activity.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelectedActivity(activity)}>
                        <TableCell className="font-medium">{activity.goodLabel}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getActivityColor(activity.activityType)}>
                            {getActivityLabel(activity.activityType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatNumber(activity.previousStock)}</TableCell>
                        <TableCell>
                          <span className={activity.quantityChange < 0 ? "font-semibold text-red-300" : "font-semibold text-emerald-300"}>
                            {activity.quantityChange > 0 ? "+" : ""}
                            {formatNumber(activity.quantityChange)}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">{activity.goodUnit}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{formatNumber(activity.newStock)}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">{activity.notes || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{activity.performedBy}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(activity.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginationControls
                page={currentPage}
                pageCount={pageCount}
                itemCount={filtered.length}
                pageSize={FINISHED_GOODS_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </motion.div>

      <Sheet open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Activity detail</SheetTitle>
            <SheetDescription>{selectedActivity ? getActivityLabel(selectedActivity.activityType) : ""}</SheetDescription>
          </SheetHeader>
          {selectedActivity ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4 sm:grid-cols-2">
                <DetailBlock label="Finished Good" value={selectedActivity.goodLabel} />
                <DetailBlock label="Warehouse" value={selectedActivity.warehouseCode} />
                <DetailBlock label="Activity" value={getActivityLabel(selectedActivity.activityType)} accent />
                <DetailBlock label="Unit" value={selectedActivity.goodUnit} />
                <DetailBlock label="Previous stock" value={formatNumber(selectedActivity.previousStock)} />
                <DetailBlock label="New stock" value={formatNumber(selectedActivity.newStock)} />
                <DetailBlock label="Quantity change" value={`${selectedActivity.quantityChange > 0 ? "+" : ""}${formatNumber(selectedActivity.quantityChange)}`} accent />
                <DetailBlock label="Performed by" value={selectedActivity.performedBy} />
                <DetailBlock label="Date / time" value={formatDateTime(selectedActivity.createdAt)} />
              </div>
              {selectedActivity.notes ? (
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</p>
                  <p className="mt-2 text-sm">{selectedActivity.notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

function MetricCard({
  className,
  icon: Icon,
  label,
  meta,
  tone = "default",
  value,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta: string;
  tone?: "default" | "emerald" | "amber" | "blue";
  value: number | string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/16 text-primary",
    emerald: "bg-emerald-500/14 text-emerald-300",
    amber: "bg-amber-500/14 text-amber-300",
    blue: "bg-sky-500/14 text-sky-300",
  };

  return (
    <Card className={cn("rounded-2xl sm:rounded-[24px]", className)}>
      <CardContent className="flex min-h-[122px] items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold sm:text-2xl">{value}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{meta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  icon: Icon,
  label,
  meta,
  tone = "default",
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta: string;
  tone?: "default" | "emerald" | "amber" | "blue";
  value: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-white/[0.04] text-foreground",
    emerald: "bg-emerald-500/10 text-emerald-300",
    amber: "bg-amber-500/10 text-amber-300",
    blue: "bg-sky-500/10 text-sky-300",
  };

  return (
    <Card className="rounded-2xl sm:rounded-[24px]">
      <CardContent className="flex min-h-[164px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
            <p className="mt-3 line-clamp-2 text-lg font-semibold">{value}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{meta}</p>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ accent, label, value }: { accent?: boolean; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={accent ? "mt-2 font-semibold text-primary" : "mt-2 font-medium"}>{value}</p>
    </div>
  );
}
