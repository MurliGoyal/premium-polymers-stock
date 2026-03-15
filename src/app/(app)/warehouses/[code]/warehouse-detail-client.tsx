"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WAREHOUSE_MATERIAL_PAGE_SIZE } from "@/lib/constants";
import { hasPermission } from "@/lib/rbac";
import { formatDate, formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";

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
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function WarehouseDetailClient({ data }: { data: WarehouseDetailData }) {
  const { data: session } = useSession();
  const { warehouse, materials, stats } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [updatedFilter, setUpdatedFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const role = session?.user?.role || "VIEWER";
  const canCreateMaterials = hasPermission(role, "raw_materials:create");
  const canCreateTransfers = hasPermission(role, "transfers:create");
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

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir("desc");
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/warehouses" className="flex items-center gap-1 transition-colors hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Warehouses
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{warehouse.code}</span>
        </div>
        <div className="rounded-[28px] border bg-card/95 p-6 shadow-sm shadow-slate-950/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Warehouse className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{warehouse.code}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{warehouse.name}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {stats.recentTransfers} transfers in the last 7 days / {stats.recentActivities} logged activities
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCreateTransfers ? (
                <Button asChild variant="outline">
                  <Link href={`/warehouses/${warehouse.slug}/transfer`}>
                    <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                    Transfer
                  </Link>
                </Button>
              ) : null}
              {canCreateMaterials ? (
                <Button asChild>
                  <Link href={`/warehouses/${warehouse.slug}/raw-materials/add`}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add material
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <MetricCard icon={Package} label="Total materials" value={stats.totalCount} />
        <MetricCard icon={BarChart3} label="Total stock" value={formatNumber(stats.totalStock)} tone="emerald" />
        <MetricCard icon={AlertTriangle} label="Low stock" value={stats.lowStockCount} tone="amber" />
        <MetricCard icon={OctagonAlert} label="Out of stock" value={stats.outOfStockCount} tone="red" />
        <MetricCard icon={ArrowRightLeft} label="Recent transfers" value={stats.recentTransfers} tone="blue" />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-3 xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search materials, categories, units, or notes"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
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
                  setUpdatedFilter(value);
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
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/transfer-history?warehouse=${warehouse.code}`}>
                  <History className="mr-1.5 h-4 w-4" />
                  Transfer history
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/raw-materials-history?warehouse=${warehouse.code}`}>
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  Materials history
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No materials found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {deferredSearch || statusFilter !== "all" || categoryFilter !== "all" || unitFilter !== "all" || updatedFilter !== "all"
                  ? "Adjust the active filters to widen the result set."
                  : "Add the first raw material to start tracking warehouse stock."}
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[640px] overflow-auto">
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
                          <Badge variant="secondary" className="text-[11px]">
                            {material.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{material.baseUnit}</TableCell>
                        <TableCell>
                          <span
                            className={
                              material.status === "OUT_OF_STOCK"
                                ? "font-semibold text-red-600"
                                : material.status === "LOW_STOCK"
                                  ? "font-semibold text-amber-600"
                                  : "font-semibold"
                            }
                          >
                            {formatNumber(material.currentStock)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatNumber(material.minimumStock)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {material.thicknessValue ? (
                              <span className="block">
                                Thickness: {material.thicknessValue}
                                {material.thicknessUnit}
                              </span>
                            ) : null}
                            {material.sizeValue ? (
                              <span className="block">
                                Size: {material.sizeValue}
                                {material.sizeUnit ? ` ${material.sizeUnit}` : ""}
                              </span>
                            ) : null}
                            {material.weightValue ? (
                              <span className="block">
                                Weight: {material.weightValue}
                                {material.weightUnit}
                              </span>
                            ) : null}
                            {material.gsm ? <span className="block">GSM: {material.gsm}</span> : null}
                            {!material.thicknessValue && !material.sizeValue && !material.weightValue && !material.gsm ? (
                              <span className="text-muted-foreground/50">-</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${getStatusColor(material.status)}`}>
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

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "default" | "emerald" | "amber" | "red" | "blue";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    red: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  };

  return (
    <Card className="rounded-[24px] border bg-card/95 shadow-sm shadow-slate-950/5">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-xl p-2 ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
