"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ClipboardList,
  History,
  OctagonAlert,
  Package,
  Plus,
  Search,
  Warehouse,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WAREHOUSE_MATERIAL_PAGE_SIZE } from "@/lib/constants";
import {
  type WarehouseStatusFilter,
  type WarehouseUpdatedFilter,
  getTransferHistoryRangeHref,
  getWarehouseDetailHref,
} from "@/lib/drilldowns";
import { hasPermission } from "@/lib/rbac";
import { cn, formatDate, formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";

type WarehouseDetailData = {
  warehouse: { id: string; code: string; name: string; slug: string };
  materials: Array<{
    id: string;
    name: string;
    category: string;
    baseUnit: string;
    currentStock: number;
    minimumStock: number;
    thicknessValue: number | null;
    thicknessUnit: string | null;
    sizeValue: string | null;
    sizeUnit: string | null;
    weightValue: number | null;
    weightUnit: string | null;
    gsm: number | null;
    notes: string | null;
    status: string;
    createdBy: string;
    updatedAt: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  stats: {
    totalCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStock: number;
    recentTransfers: number;
    recentActivities: number;
  };
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function WarehouseDetailClient({
  data,
  initialCategoryFilter,
  initialSearch,
  initialStatusFilter,
  initialUnitFilter,
  initialUpdatedFilter,
  userRole,
}: {
  data: WarehouseDetailData;
  initialCategoryFilter: string;
  initialSearch: string;
  initialStatusFilter: WarehouseStatusFilter;
  initialUnitFilter: string;
  initialUpdatedFilter: WarehouseUpdatedFilter;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { warehouse, materials, stats } = data;
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<WarehouseStatusFilter>(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [unitFilter, setUnitFilter] = useState(initialUnitFilter);
  const [updatedFilter, setUpdatedFilter] = useState<WarehouseUpdatedFilter>(initialUpdatedFilter);
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const canCreateMaterials = hasPermission(userRole, "raw_materials:create");
  const canCreateTransfers = hasPermission(userRole, "transfers:create");
  const defaultWarehouseHref = getWarehouseDetailHref(warehouse.slug);
  const recentTransfersHref = getTransferHistoryRangeHref("last-7-days", { warehouse: warehouse.code });
  const statCards = [
    { href: defaultWarehouseHref, icon: Package, label: "Total materials", value: stats.totalCount },
    { href: defaultWarehouseHref, icon: BarChart3, label: "Total stock", value: formatNumber(stats.totalStock), tone: "emerald" as const },
    {
      href: getWarehouseDetailHref(warehouse.slug, { status: "LOW_STOCK" }),
      icon: AlertTriangle,
      label: "Low stock",
      value: stats.lowStockCount,
      tone: "amber" as const,
    },
    {
      href: getWarehouseDetailHref(warehouse.slug, { status: "OUT_OF_STOCK" }),
      icon: OctagonAlert,
      label: "Out of stock",
      value: stats.outOfStockCount,
      tone: "red" as const,
    },
    {
      href: recentTransfersHref,
      icon: ArrowRightLeft,
      label: "Recent transfers",
      value: stats.recentTransfers,
      tone: "blue" as const,
    },
  ];
  const categories = useMemo(() => [...new Set(materials.map((material) => material.category))].sort(), [materials]);
  const units = useMemo(() => [...new Set(materials.map((material) => material.baseUnit))].sort(), [materials]);

  const filtered = useMemo(() => {
    const now = new Date();
    return [...materials]
      .filter((material) => {
        const normalizedSearch = deferredSearch.trim().toLowerCase();
        const updatedAt = new Date(material.updatedAt);

        if (
          normalizedSearch &&
          ![material.name, material.category, material.baseUnit, material.notes ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        ) {
          return false;
        }

        if (statusFilter !== "all" && material.status !== statusFilter) return false;
        if (categoryFilter !== "all" && material.category !== categoryFilter) return false;
        if (unitFilter !== "all" && material.baseUnit !== unitFilter) return false;
        if (updatedFilter === "7d" && updatedAt < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
        if (updatedFilter === "30d" && updatedAt < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;

        return true;
      })
      .sort((left, right) => {
        let comparison = 0;
        if (sortField === "name") comparison = left.name.localeCompare(right.name);
        else if (sortField === "currentStock") comparison = left.currentStock - right.currentStock;
        else if (sortField === "category") comparison = left.category.localeCompare(right.category);
        else comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
        return sortDir === "asc" ? comparison : -comparison;
      });
  }, [categoryFilter, deferredSearch, materials, sortDir, sortField, statusFilter, unitFilter, updatedFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / WAREHOUSE_MATERIAL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedMaterials = filtered.slice(
    (currentPage - 1) * WAREHOUSE_MATERIAL_PAGE_SIZE,
    currentPage * WAREHOUSE_MATERIAL_PAGE_SIZE
  );

  const activeFilterCount = [
    statusFilter !== "all",
    categoryFilter !== "all",
    unitFilter !== "all",
    updatedFilter !== "all",
    Boolean(deferredSearch),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setUnitFilter("all");
    setUpdatedFilter("all");
    setPage(1);
    router.replace(pathname, { scroll: false });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir("desc");
  };

  const filters = (
    <>
      <div className="relative md:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search materials, categories, units, or notes"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="pl-11"
        />
      </div>
      <Select
        value={statusFilter}
        onValueChange={(value) => {
          setStatusFilter(value as WarehouseStatusFilter);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="IN_STOCK">In stock</SelectItem>
          <SelectItem value="LOW_STOCK">Low stock</SelectItem>
          <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
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
        value={unitFilter}
        onValueChange={(value) => {
          setUnitFilter(value);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All units</SelectItem>
          {units.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={updatedFilter}
        onValueChange={(value) => {
          setUpdatedFilter(value as WarehouseUpdatedFilter);
          setPage(1);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Recently updated" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any time</SelectItem>
          <SelectItem value="7d">Updated in 7 days</SelectItem>
          <SelectItem value="30d">Updated in 30 days</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants} className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/warehouses" className="flex items-center gap-1 transition-colors hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Warehouses
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{warehouse.code}</span>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Warehouse inventory"
          title={warehouse.code}
          description={`${warehouse.name}. ${stats.recentTransfers} transfers in the last 7 days and ${stats.recentActivities} logged activities.`}
          badge={
            <Badge variant="secondary">
              <Warehouse className="mr-1 h-3 w-3" />
              Active stock view
            </Badge>
          }
          actions={
            <>
              {canCreateTransfers ? (
                <Button asChild variant="outline">
                  <Link href={`/warehouses/${warehouse.slug}/transfer`}>
                    <ArrowRightLeft className="h-4 w-4" />
                    Transfer
                  </Link>
                </Button>
              ) : null}
              {canCreateMaterials ? (
                <Button asChild>
                  <Link href={`/warehouses/${warehouse.slug}/raw-materials/add`}>
                    <Plus className="h-4 w-4" />
                    Add material
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card, index) => (
          <MetricCard
            key={card.label}
            className={index === statCards.length - 1 ? "col-span-2 md:col-span-1" : undefined}
            href={card.href}
            icon={card.icon}
            label={card.label}
            tone={card.tone}
            value={card.value}
          />
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="space-y-4">
            <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">{filters}</div>
            <div className="flex flex-col gap-3 md:hidden">
              <ResponsiveFiltersSheet
                activeCount={activeFilterCount}
                title="Material filters"
                description="Refine the material list without collapsing the layout into narrow columns."
              >
                {filters}
              </ResponsiveFiltersSheet>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search materials, categories, units, or notes"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="pl-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/transfer-history?warehouse=${warehouse.code}`}>
                  <History className="h-4 w-4" />
                  Transfer history
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/raw-materials-history?warehouse=${warehouse.code}`}>
                  <ClipboardList className="h-4 w-4" />
                  Materials history
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No materials found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {deferredSearch || statusFilter !== "all" || categoryFilter !== "all" || unitFilter !== "all" || updatedFilter !== "all"
                  ? "Adjust the active filters to widen the result set."
                  : "Add the first raw material to start tracking warehouse stock."}
              </p>
              {activeFilterCount > 0 ? (
                <Button type="button" variant="outline" onClick={resetFilters} className="mt-4">
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
                {paginatedMaterials.map((material) => (
                  <Card key={material.id} className="rounded-[24px]">
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <p className="text-base font-semibold">{material.name}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{material.category}</Badge>
                            <Badge variant="outline" className={getStatusColor(material.status)}>
                              {getStatusLabel(material.status)}
                            </Badge>
                          </div>
                        </div>
                      <div className="surface-subtle self-start rounded-[18px] px-3 py-2 text-left sm:self-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right sm:shadow-none">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stock</p>
                        <p className="mt-1 text-2xl font-semibold">
                            {formatQuantity(material.currentStock, material.baseUnit)}
                          </p>
                      </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <InfoPill label="Minimum" value={formatQuantity(material.minimumStock, material.baseUnit)} />
                        <InfoPill label="Updated" value={formatDate(material.updatedAt)} />
                      </div>

                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Specifications
                        </p>
                        <p className="mt-2 text-sm text-foreground/88">{formatSpecs(material)}</p>
                      </div>

                      {material.notes ? (
                        <p className="text-sm leading-6 text-muted-foreground">{material.notes}</p>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        {canCreateTransfers ? (
                          <Button asChild variant="outline">
                            <Link href={`/warehouses/${warehouse.slug}/transfer`}>Transfer</Link>
                          </Button>
                        ) : null}
                        <Button asChild variant="ghost" className={canCreateTransfers ? "" : "col-span-2"}>
                          <Link href={`/raw-materials-history?warehouse=${warehouse.code}`}>History</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden max-h-[680px] overflow-auto xl:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-card">
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                        <span className="flex items-center gap-1">
                          Raw material <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("category")}>
                        <span className="flex items-center gap-1">
                          Category <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("currentStock")}>
                        <span className="flex items-center gap-1">
                          Stock <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>Minimum</TableHead>
                      <TableHead>Specs</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("updatedAt")}>
                        <span className="flex items-center gap-1">
                          Last updated <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMaterials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{material.name}</p>
                            {material.notes ? <p className="text-xs text-muted-foreground">{material.notes}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{material.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{material.baseUnit}</TableCell>
                        <TableCell>
                          <span
                            className={
                              material.status === "OUT_OF_STOCK"
                                ? "font-semibold text-red-300"
                                : material.status === "LOW_STOCK"
                                  ? "font-semibold text-amber-300"
                                  : "font-semibold"
                            }
                          >
                            {formatNumber(material.currentStock)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatNumber(material.minimumStock)}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                          {formatSpecs(material)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(material.status)}>
                            {getStatusLabel(material.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(material.updatedAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {canCreateTransfers ? (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/warehouses/${warehouse.slug}/transfer`}>Transfer</Link>
                              </Button>
                            ) : null}
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/raw-materials-history?warehouse=${warehouse.code}`}>History</Link>
                            </Button>
                          </div>
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
                pageSize={WAREHOUSE_MATERIAL_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function MetricCard({
  className,
  href,
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  className?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "default" | "emerald" | "amber" | "red" | "blue";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/16 text-primary",
    emerald: "bg-emerald-500/14 text-emerald-300",
    amber: "bg-amber-500/14 text-amber-300",
    red: "bg-red-500/14 text-red-300",
    blue: "bg-sky-500/14 text-sky-300",
  };

  const content = (
    <Card className={cn("rounded-[24px]", className)}>
      <CardContent className="flex min-h-[124px] items-center gap-3 sm:min-h-[132px]">
        <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] sm:h-12 sm:w-12 sm:rounded-2xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
      {content}
    </Link>
  );
}

function formatSpecs(material: WarehouseDetailData["materials"][number]) {
  const specs = [
    material.thicknessValue ? `Thickness ${formatQuantity(material.thicknessValue, material.thicknessUnit)}` : null,
    material.sizeValue ? `Size ${material.sizeValue}${material.sizeUnit ? ` ${material.sizeUnit}` : ""}` : null,
    material.weightValue ? `Weight ${formatQuantity(material.weightValue, material.weightUnit)}` : null,
    material.gsm ? `GSM ${material.gsm}` : null,
  ].filter(Boolean);

  return specs.length > 0 ? specs.join(" / ") : "No dimensional metadata";
}

function formatQuantity(value: number | string, unit?: string | null) {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}
