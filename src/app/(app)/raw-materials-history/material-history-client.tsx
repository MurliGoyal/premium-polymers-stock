"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Search } from "lucide-react";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { ResponsiveFiltersSheet } from "@/components/shared/responsive-filters-sheet";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HISTORY_PAGE_SIZE } from "@/lib/constants";
import { formatDateTime, formatNumber, getActivityColor, getActivityLabel } from "@/lib/utils";

type ActivityRecord = {
  id: string;
  materialName: string;
  materialUnit: string;
  category: string;
  warehouseCode: string;
  activityType: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  quantityChange: number | null;
  sourceType: string | null;
  performedBy: string;
  createdAt: string;
};

export function MaterialHistoryClient({
  activities,
  warehouses,
  categories,
  materials,
  users,
  initialWarehouseFilter = "all",
}: {
  activities: ActivityRecord[];
  warehouses: string[];
  categories: string[];
  materials: string[];
  users: string[];
  initialWarehouseFilter?: string;
}) {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const activityTypes = useMemo(() => [...new Set(activities.map((activity) => activity.activityType))], [activities]);
  const filtered = useMemo(() => {
    return activities.filter((activity) => {
      const normalizedSearch = deferredSearch.trim().toLowerCase();
      const createdAt = new Date(activity.createdAt);

      if (
        normalizedSearch &&
        ![
          activity.materialName,
          activity.category,
          activity.warehouseCode,
          activity.performedBy,
          getActivityLabel(activity.activityType),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }

      if (warehouseFilter !== "all" && activity.warehouseCode !== warehouseFilter) return false;
      if (typeFilter !== "all" && activity.activityType !== typeFilter) return false;
      if (categoryFilter !== "all" && activity.category !== categoryFilter) return false;
      if (materialFilter !== "all" && activity.materialName !== materialFilter) return false;
      if (userFilter !== "all" && activity.performedBy !== userFilter) return false;
      if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && createdAt > new Date(`${toDate}T23:59:59`)) return false;

      return true;
    });
  }, [
    activities,
    categoryFilter,
    deferredSearch,
    fromDate,
    materialFilter,
    toDate,
    typeFilter,
    userFilter,
    warehouseFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedActivities = filtered.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE);
  const activeFilters = [
    warehouseFilter !== "all" ? `Warehouse: ${warehouseFilter}` : null,
    typeFilter !== "all" ? `Activity: ${getActivityLabel(typeFilter)}` : null,
    categoryFilter !== "all" ? `Category: ${categoryFilter}` : null,
    materialFilter !== "all" ? `Material: ${materialFilter}` : null,
    userFilter !== "all" ? `User: ${userFilter}` : null,
    fromDate ? `From: ${fromDate}` : null,
    toDate ? `To: ${toDate}` : null,
  ].filter(Boolean) as string[];

  const filters = (
    <>
      <div className="relative xl:col-span-[1.5]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by material, category, activity, warehouse, or user"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="pl-11"
        />
      </div>
      <Select
        value={warehouseFilter}
        onValueChange={(value) => {
          setWarehouseFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All warehouses</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse} value={warehouse}>
              {warehouse}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={materialFilter}
        onValueChange={(value) => {
          setMaterialFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Material" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All materials</SelectItem>
          {materials.map((material) => (
            <SelectItem key={material} value={material}>
              {material}
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
          <SelectItem value="all">All activity types</SelectItem>
          {activityTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {getActivityLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={categoryFilter}
        onValueChange={(value) => {
          setCategoryFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
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
      <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
        <div className="space-y-1.5">
          <LabelText>From date</LabelText>
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
          <LabelText>To date</LabelText>
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <ResponsivePageHeader
        eyebrow="Audit ledger"
        title="Raw materials history"
        description="Premium audit ledger for material creation, stock adjustments, transfers, and metadata changes."
        badge={<Badge variant="secondary">{filtered.length} matching activities</Badge>}
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="hidden gap-3 xl:grid xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))_minmax(0,1fr)_minmax(0,1fr)]">
            {filters}
          </div>
          <div className="space-y-3 xl:hidden">
            <ResponsiveFiltersSheet activeCount={activeFilters.length} title="Activity filters">
              {filters}
            </ResponsiveFiltersSheet>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by material, category, activity, warehouse, or user"
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

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No activity found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting the material, user, or date filters.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 xl:hidden">
              {paginatedActivities.map((activity) => (
                <Card key={activity.id} className="cursor-pointer rounded-[24px]" onClick={() => setSelectedActivity(activity)}>
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{activity.warehouseCode}</Badge>
                          <Badge variant="outline" className={getActivityColor(activity.activityType)}>
                            {getActivityLabel(activity.activityType)}
                          </Badge>
                        </div>
                        <p className="text-base font-semibold">{activity.materialName}</p>
                        <p className="text-sm text-muted-foreground">{activity.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Change</p>
                        <p
                          className={
                            activity.quantityChange === null
                              ? "mt-1 text-lg font-semibold"
                              : activity.quantityChange < 0
                                ? "mt-1 text-lg font-semibold text-red-300"
                                : "mt-1 text-lg font-semibold text-emerald-300"
                          }
                        >
                          {activity.quantityChange !== null
                            ? `${activity.quantityChange > 0 ? "+" : ""}${formatNumber(activity.quantityChange)}`
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <DetailBlock label="Performed by" value={activity.performedBy} compact />
                      <DetailBlock label="Source" value={activity.sourceType || "-"} compact />
                    </div>

                    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3 text-sm text-muted-foreground">
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
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Quantity change</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Performed by</TableHead>
                    <TableHead>Date / time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <TableCell>
                        <Badge variant="secondary">{activity.warehouseCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{activity.materialName}</p>
                          <p className="text-xs text-muted-foreground">{activity.category}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActivityColor(activity.activityType)}>
                          {getActivityLabel(activity.activityType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {extractStock(activity.beforeSnapshot)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {extractStock(activity.afterSnapshot)}
                      </TableCell>
                      <TableCell>
                        {activity.quantityChange !== null ? (
                          <span className={activity.quantityChange < 0 ? "font-semibold text-red-300" : "font-semibold text-emerald-300"}>
                            {activity.quantityChange > 0 ? "+" : ""}
                            {formatNumber(activity.quantityChange)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{activity.sourceType || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{activity.performedBy}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationControls
              page={currentPage}
              pageCount={pageCount}
              itemCount={filtered.length}
              pageSize={HISTORY_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Sheet open={!!selectedActivity} onOpenChange={() => setSelectedActivity(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Activity detail</SheetTitle>
            <SheetDescription>{selectedActivity ? getActivityLabel(selectedActivity.activityType) : ""}</SheetDescription>
          </SheetHeader>
          {selectedActivity ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4 sm:grid-cols-2">
                <DetailBlock label="Warehouse" value={selectedActivity.warehouseCode} />
                <DetailBlock label="Material" value={selectedActivity.materialName} />
                <DetailBlock label="Category" value={selectedActivity.category} />
                <DetailBlock label="Unit" value={selectedActivity.materialUnit} />
                <DetailBlock label="Activity" value={getActivityLabel(selectedActivity.activityType)} accent />
                <DetailBlock label="Performed by" value={selectedActivity.performedBy} />
                <DetailBlock label="Source" value={selectedActivity.sourceType || "-"} />
                <DetailBlock label="Date / time" value={formatDateTime(selectedActivity.createdAt)} />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <JsonCard title="Before snapshot" payload={selectedActivity.beforeSnapshot} />
                <JsonCard title="After snapshot" payload={selectedActivity.afterSnapshot} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quantity affected</p>
                <p className="mt-2 text-lg font-semibold">
                  {selectedActivity.quantityChange !== null ? formatNumber(selectedActivity.quantityChange) : "-"}
                </p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

function DetailBlock({
  accent,
  compact,
  label,
  value,
}: {
  accent?: boolean;
  compact?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={compact ? "rounded-[20px] border border-white/8 bg-white/[0.03] p-3" : undefined}>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={accent ? "mt-2 font-semibold text-primary" : "mt-2 font-medium"}>{value}</p>
    </div>
  );
}

function JsonCard({ title, payload }: { title: string; payload: Record<string, unknown> | null }) {
  return (
    <div className="rounded-[24px] border border-white/8 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <pre className="mt-3 overflow-auto rounded-[20px] border border-white/6 bg-white/[0.03] p-3 text-xs text-muted-foreground">
        {payload ? JSON.stringify(payload, null, 2) : "-"}
      </pre>
    </div>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{children}</p>;
}

function extractStock(snapshot: Record<string, unknown> | null) {
  const value = snapshot?.currentStock ?? snapshot?.stock;
  return value === undefined || value === null ? "-" : formatNumber(Number(value));
}
