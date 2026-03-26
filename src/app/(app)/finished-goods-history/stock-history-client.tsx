"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Search } from "lucide-react";
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
import { FINISHED_GOODS_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime, formatNumber, getAppDateKey } from "@/lib/utils";

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
    case "PRODUCTION": return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400";
    case "DISPATCH": return "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400";
    case "STOCK_ADJUSTED": return "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400";
    default: return "text-slate-600 bg-slate-50 dark:bg-slate-950 dark:text-slate-400";
  }
}

function todayDateKey() {
  return getAppDateKey(new Date());
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
  finishedGoods: { id: string; label: string }[];
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
  const [fromDate, setFromDate] = useState(initialFromDate || todayDateKey());
  const [toDate, setToDate] = useState(initialToDate || todayDateKey());
  const [page, setPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const activityTypes = useMemo(() => [...new Set(activities.map((a) => a.activityType))], [activities]);
  const finishedGoodsById = useMemo(() => {
    return new Map(finishedGoods.map((good) => [good.id, good.label]));
  }, [finishedGoods]);

  const filtered = useMemo(() => {
    return activities.filter((activity) => {
      const q = deferredSearch.trim().toLowerCase();
      const createdAt = new Date(activity.createdAt);

      if (q && ![activity.goodLabel, activity.performedBy, getActivityLabel(activity.activityType)].join(" ").toLowerCase().includes(q)) {
        return false;
      }
      if (goodFilter !== "all" && activity.goodId !== goodFilter) return false;
      if (typeFilter !== "all" && activity.activityType !== typeFilter) return false;
      if (userFilter !== "all" && activity.performedBy !== userFilter) return false;
      if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && createdAt > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [activities, deferredSearch, goodFilter, typeFilter, userFilter, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / FINISHED_GOODS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * FINISHED_GOODS_PAGE_SIZE, currentPage * FINISHED_GOODS_PAGE_SIZE);

  const selectedGoodLabel = goodFilter !== "all" ? (finishedGoodsById.get(goodFilter) ?? goodFilter) : null;
  const activeFilters = [
    selectedGoodLabel ? `Good: ${selectedGoodLabel}` : null,
    typeFilter !== "all" ? `Type: ${getActivityLabel(typeFilter)}` : null,
    userFilter !== "all" ? `User: ${userFilter}` : null,
    fromDate ? `From: ${fromDate}` : null,
    toDate ? `To: ${toDate}` : null,
  ].filter(Boolean) as string[];
  const hasActiveFilters = activeFilters.length > 0 || Boolean(deferredSearch);

  const resetFilters = () => {
    setSearch("");
    setGoodFilter("all");
    setTypeFilter("all");
    setUserFilter("all");
    setFromDate(todayDateKey());
    setToDate(todayDateKey());
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const filters = (
    <>
      <div className="relative md:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, user, or activity type"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-11"
        />
      </div>
      <Select value={goodFilter} onValueChange={(v) => { setGoodFilter(v); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Finished good" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All finished goods</SelectItem>
          {finishedGoods.map((g) => (<SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>))}
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Activity type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {activityTypes.map((t) => (<SelectItem key={t} value={t}>{getActivityLabel(t)}</SelectItem>))}
        </SelectContent>
      </Select>
      <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="User" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All users</SelectItem>
          {users.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
        </SelectContent>
      </Select>
      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From date</p>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">To date</p>
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        </div>
      </div>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-5">
      <ResponsivePageHeader
        eyebrow={`Warehouse ${warehouseCode}`}
        title="Stock History"
        description="Full audit trail of production and dispatch for finished goods. Defaults to today's activity."
        badge={<Badge variant="secondary">{filtered.length} records</Badge>}
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">{filters}</div>
          <div className="space-y-3 md:hidden">
            <ResponsiveFiltersSheet activeCount={activeFilters.length} title="Stock history filters">
              {filters}
            </ResponsiveFiltersSheet>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, user, or activity type"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-11"
              />
            </div>
          </div>
          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((f) => (<Badge key={f} variant="outline">{f}</Badge>))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No activity found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters ? "No results match your filters." : "Stock history will appear here once production or dispatch is recorded."}
            </p>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={resetFilters} className="mt-4">Clear filters</Button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
              {paginated.map((a) => (
                <Card key={a.id} className="cursor-pointer rounded-2xl sm:rounded-[24px]" onClick={() => setSelectedActivity(a)}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{a.warehouseCode}</Badge>
                          <Badge variant="outline" className={getActivityColor(a.activityType)}>{getActivityLabel(a.activityType)}</Badge>
                        </div>
                        <p className="text-base font-semibold">{a.goodLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Change</p>
                        <p className={a.quantityChange < 0 ? "mt-1 text-lg font-semibold text-red-300" : "mt-1 text-lg font-semibold text-emerald-300"}>
                          {a.quantityChange > 0 ? "+" : ""}{formatNumber(a.quantityChange)}
                          <span className="ml-1 text-xs text-muted-foreground">{a.goodUnit}</span>
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Before</p>
                        <p className="mt-2 font-medium">{formatNumber(a.previousStock)}</p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">After</p>
                        <p className="mt-2 font-medium">{formatNumber(a.newStock)}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-muted-foreground sm:rounded-[22px]">
                      {formatDateTime(a.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
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
                  {paginated.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelectedActivity(a)}>
                      <TableCell className="font-medium">{a.goodLabel}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActivityColor(a.activityType)}>{getActivityLabel(a.activityType)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatNumber(a.previousStock)}</TableCell>
                      <TableCell>
                        <span className={a.quantityChange < 0 ? "font-semibold text-red-300" : "font-semibold text-emerald-300"}>
                          {a.quantityChange > 0 ? "+" : ""}{formatNumber(a.quantityChange)}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">{a.goodUnit}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatNumber(a.newStock)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{a.notes || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.performedBy}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationControls page={currentPage} pageCount={pageCount} itemCount={filtered.length} pageSize={FINISHED_GOODS_PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      {/* Detail sheet */}
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

function DetailBlock({ accent, label, value }: { accent?: boolean; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={accent ? "mt-2 font-semibold text-primary" : "mt-2 font-medium"}>{value}</p>
    </div>
  );
}
