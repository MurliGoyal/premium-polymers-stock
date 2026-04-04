"use client";

import { Fragment, useDeferredValue, useMemo, useState, useTransition, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Download,
  History,
  Layers3,
  Package,
  Search,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { ResponsiveFiltersSheet } from "@/components/shared/responsive-filters-sheet";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { DurationPickerDialog } from "@/components/shared/duration-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RawMaterialsReport } from "@/components/pdf/raw-materials-report";
import { formatPdfDate, generateAndDownloadPdf } from "@/lib/pdf-utils";
import { fuzzyScore } from "@/lib/fuzzy-search";
import { cn, formatDateTime, formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import { getTotalRawMaterialsPdfData, type TotalRawMaterialRecord } from "./actions";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "stock-desc", label: "Stock (high to low)" },
  { value: "stock-asc", label: "Stock (low to high)" },
  { value: "category-asc", label: "Category (A-Z)" },
  { value: "updated-desc", label: "Updated (newest)" },
  { value: "updated-asc", label: "Updated (oldest)" },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_SORT = "name-asc";

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type TotalMaterialsClientProps = {
  categories: string[];
  initialCategoryFilter: string;
  initialGsmMax: string;
  initialGsmMin: string;
  initialPageSize: number;
  initialSearch: string;
  initialSizeMax: string;
  initialSizeMin: string;
  initialSort: SortValue;
  initialStatusFilter: string;
  initialUnitFilter: string;
  initialWarehouseFilter: string;
  materials: TotalRawMaterialRecord[];
  units: string[];
  warehouseCodes: string[];
};

function parseNumberFilter(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesRange(value: number | null, minimum: number | null, maximum: number | null) {
  if (minimum === null && maximum === null) {
    return true;
  }

  if (value === null) {
    return false;
  }

  if (minimum !== null && value < minimum) {
    return false;
  }

  if (maximum !== null && value > maximum) {
    return false;
  }

  return true;
}

function parseMaybeNumeric(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getSortLabel(value: SortValue) {
  return SORT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function compareMaterials(left: TotalRawMaterialRecord, right: TotalRawMaterialRecord, sortValue: SortValue) {
  switch (sortValue) {
    case "name-desc":
      return right.displayName.localeCompare(left.displayName) || right.category.localeCompare(left.category);
    case "stock-desc":
      return right.currentStock - left.currentStock || left.displayName.localeCompare(right.displayName);
    case "stock-asc":
      return left.currentStock - right.currentStock || left.displayName.localeCompare(right.displayName);
    case "category-asc":
      return left.category.localeCompare(right.category) || left.displayName.localeCompare(right.displayName);
    case "updated-desc":
      return right.updatedAt.localeCompare(left.updatedAt) || left.displayName.localeCompare(right.displayName);
    case "updated-asc":
      return left.updatedAt.localeCompare(right.updatedAt) || left.displayName.localeCompare(right.displayName);
    case "name-asc":
    default:
      return left.displayName.localeCompare(right.displayName) || left.category.localeCompare(right.category);
  }
}

export function TotalMaterialsClient({
  categories,
  initialCategoryFilter,
  initialGsmMax,
  initialGsmMin,
  initialPageSize,
  initialSearch,
  initialSizeMax,
  initialSizeMin,
  initialSort,
  initialStatusFilter,
  initialUnitFilter,
  initialWarehouseFilter,
  materials,
  units,
  warehouseCodes,
}: TotalMaterialsClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [isPdfPending, startPdfTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseFilter);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [unitFilter, setUnitFilter] = useState(initialUnitFilter);
  const [sortValue, setSortValue] = useState<SortValue>(initialSort);
  const [gsmMin, setGsmMin] = useState(initialGsmMin);
  const [gsmMax, setGsmMax] = useState(initialGsmMax);
  const [sizeMin, setSizeMin] = useState(initialSizeMin);
  const [sizeMax, setSizeMax] = useState(initialSizeMax);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search);

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const searchHasValue = normalizedSearch.length > 0;
    const minimumGsm = parseNumberFilter(gsmMin);
    const maximumGsm = parseNumberFilter(gsmMax);
    const minimumSize = parseNumberFilter(sizeMin);
    const maximumSize = parseNumberFilter(sizeMax);

    return materials
      .map((material) => {
        const searchFields = [
          material.displayName,
          material.name,
          material.category,
          material.vendorName ?? "",
          material.baseUnit,
          getStatusLabel(material.status),
          ...material.sourceWarehouses.map((source) => source.warehouseCode),
          ...material.sourceWarehouses.map((source) => source.warehouseName),
          ...material.sourceWarehouses.map(
            (source) => `${source.warehouseCode} ${formatNumber(source.currentStock)} ${material.baseUnit}`
          ),
          material.gsm !== null ? `gsm ${material.gsm}` : "",
          material.micron !== null ? `micron ${material.micron}` : "",
          material.thicknessValue !== null
            ? `${material.thicknessValue} ${material.thicknessUnit ?? ""}`
            : "",
          material.sizeValue ? `${material.sizeValue} ${material.sizeUnit ?? ""}` : "",
        ];

        const searchScore = searchHasValue
          ? Math.max(...searchFields.map((field) => fuzzyScore(normalizedSearch, field)))
          : 0;

        return { material, searchScore };
      })
      .filter(({ material, searchScore }) => {
        if (searchHasValue && searchScore <= 0) {
          return false;
        }

        if (categoryFilter !== "all" && material.category !== categoryFilter) {
          return false;
        }

        if (warehouseFilter !== "all" && !material.sourceWarehouses.some((source) => source.warehouseCode === warehouseFilter)) {
          return false;
        }

        if (statusFilter !== "all" && material.status !== statusFilter) {
          return false;
        }

        if (unitFilter !== "all" && material.baseUnit !== unitFilter) {
          return false;
        }

        if (!matchesRange(material.gsm, minimumGsm, maximumGsm)) {
          return false;
        }

        if (!matchesRange(parseMaybeNumeric(material.sizeValue), minimumSize, maximumSize)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (searchHasValue && left.searchScore !== right.searchScore) {
          return right.searchScore - left.searchScore;
        }

        return compareMaterials(left.material, right.material, sortValue);
      })
      .map(({ material }) => material);
  }, [
    categoryFilter,
    deferredSearch,
    gsmMax,
    gsmMin,
    materials,
    sizeMax,
    sizeMin,
    sortValue,
    statusFilter,
    unitFilter,
    warehouseFilter,
  ]);

  const summary = useMemo(() => {
    const warehouseSet = new Set<string>();
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const material of filteredMaterials) {
      totalStock += material.currentStock;

      if (material.status === "LOW_STOCK") {
        lowStockCount += 1;
      } else if (material.status === "OUT_OF_STOCK") {
        outOfStockCount += 1;
      }

      for (const source of material.sourceWarehouses) {
        warehouseSet.add(source.warehouseCode);
      }
    }

    return {
      lowStockCount,
      outOfStockCount,
      totalStock,
      warehouseCount: warehouseSet.size,
    };
  }, [filteredMaterials]);

  const activeFilters = [
    search.trim() ? `Search: ${search.trim()}` : null,
    categoryFilter !== "all" ? `Category: ${categoryFilter}` : null,
    warehouseFilter !== "all" ? `Warehouse: ${warehouseFilter}` : null,
    statusFilter !== "all" ? `Status: ${getStatusLabel(statusFilter)}` : null,
    unitFilter !== "all" ? `Unit: ${unitFilter}` : null,
    sortValue !== DEFAULT_SORT ? `Sort: ${getSortLabel(sortValue)}` : null,
    gsmMin || gsmMax ? `GSM: ${gsmMin || "-"} to ${gsmMax || "-"}` : null,
    sizeMin || sizeMax ? `Size: ${sizeMin || "-"} to ${sizeMax || "-"}` : null,
  ].filter(Boolean) as string[];
  const hasActiveFilters = activeFilters.length > 0;

  const pageCount = Math.max(1, Math.ceil(filteredMaterials.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedMaterials = filteredMaterials.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const applyPageReset = () => {
    setPage(1);
  };

  const searchBar = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search by name, spec, category, source warehouse, or notes"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          applyPageReset();
        }}
        className="pl-11"
      />
    </div>
  );

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setWarehouseFilter("all");
    setStatusFilter("all");
    setUnitFilter("all");
    setSortValue(DEFAULT_SORT);
    setGsmMin("");
    setGsmMax("");
    setSizeMin("");
    setSizeMax("");
    setPage(1);
    setExpandedMaterialIds(new Set());
    router.replace(pathname, { scroll: false });
  };

  const toggleExpandedMaterial = (materialId: string) => {
    setExpandedMaterialIds((current) => {
      const next = new Set(current);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const handleGeneratePdf = ({
    fromDate,
    includeAllMaterials,
    label,
    toDate,
  }: {
    fromDate: Date;
    includeAllMaterials: boolean;
    label: string;
    toDate: Date;
  }) => {
    startPdfTransition(async () => {
      try {
        const reportData = await getTotalRawMaterialsPdfData({
          fromDate: fromDate.toISOString(),
          includeAllMaterials,
          toDate: toDate.toISOString(),
        });

        await generateAndDownloadPdf(
          <RawMaterialsReport
            categories={reportData.categories}
            durationLabel={label}
            generatedLabel={formatPdfDate(new Date())}
            reportTitle="Total Raw Materials Report — All Warehouses"
          />,
          `raw-materials-total-${new Date().toISOString().slice(0, 10)}.pdf`,
        );

        setShowPdfDialog(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate raw materials PDF.";
        toast.error(message);
      }
    });
  };

  const filterControls = (
    <>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Category</p>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            applyPageReset();
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
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Warehouse origin</p>
        <Select
          value={warehouseFilter}
          onValueChange={(value) => {
            setWarehouseFilter(value);
            applyPageReset();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouseCodes.map((warehouseCode) => (
              <SelectItem key={warehouseCode} value={warehouseCode}>
                {warehouseCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            applyPageReset();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="IN_STOCK">In stock</SelectItem>
            <SelectItem value="LOW_STOCK">Low stock</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Unit</p>
        <Select
          value={unitFilter}
          onValueChange={(value) => {
            setUnitFilter(value);
            applyPageReset();
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
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sort</p>
        <Select
          value={sortValue}
          onValueChange={(value) => {
            setSortValue(value as SortValue);
            applyPageReset();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Page size</p>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(Number(value));
            applyPageReset();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Page size" />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">GSM min</p>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Minimum GSM"
            value={gsmMin}
            onChange={(event) => {
              setGsmMin(event.target.value);
              applyPageReset();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">GSM max</p>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Maximum GSM"
            value={gsmMax}
            onChange={(event) => {
              setGsmMax(event.target.value);
              applyPageReset();
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:col-span-2 xl:col-span-2">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Size min</p>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Minimum size"
            value={sizeMin}
            onChange={(event) => {
              setSizeMin(event.target.value);
              applyPageReset();
            }}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Size max</p>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="Maximum size"
            value={sizeMax}
            onChange={(event) => {
              setSizeMax(event.target.value);
              applyPageReset();
            }}
          />
        </div>
      </div>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <ResponsivePageHeader
        eyebrow="Aggregate warehouse view"
        title="Total Raw Materials"
        description="Merged stock across every warehouse, grouped by matching specification fingerprint with source breakdowns."
        badge={
          <Badge variant="secondary">
            {filteredMaterials.length === materials.length
              ? `${materials.length} merged materials`
              : `${filteredMaterials.length} of ${materials.length} merged materials`}
          </Badge>
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setShowPdfDialog(true)}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button asChild variant="outline">
              <Link href="/warehouses">
                <Warehouse className="h-4 w-4" />
                Warehouses
              </Link>
            </Button>
            <Button asChild>
              <Link href="/raw-materials-history">
                <History className="h-4 w-4" />
                History
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Package} label="Merged rows" tone="indigo" value={filteredMaterials.length} />
        <SummaryCard icon={BarChart3} label="Combined stock" tone="emerald" value={formatNumber(summary.totalStock)} />
        <SummaryCard icon={Warehouse} label="Warehouses represented" tone="cyan" value={summary.warehouseCount} />
        <SummaryCard
          icon={AlertTriangle}
          label="Low / empty"
          tone="amber"
          value={summary.lowStockCount + summary.outOfStockCount}
        />
      </div>

      <Card className="glass-panel border-white/10">
        <CardContent className="space-y-4 pt-6">
          <div className="hidden space-y-3 md:block">
            {searchBar}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{filterControls}</div>
          </div>

          <div className="space-y-3 md:hidden">
            {searchBar}
            <ResponsiveFiltersSheet activeCount={activeFilters.length} title="Total raw materials filters">
              {filterControls}
            </ResponsiveFiltersSheet>
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="outline">
                  {filter}
                </Badge>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="glass-panel overflow-hidden border-white/10">
        {filteredMaterials.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Layers3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No raw materials found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No merged materials match the current filters right now."
                : "Merged raw materials will appear here once inventory exists in the warehouses."}
            </p>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={resetFilters} className="mt-4">
                Clear filters
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-4">
                <Link href="/warehouses">
                  <ArrowRight className="h-4 w-4" />
                  Back to warehouses
                </Link>
              </Button>
            )}
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Material</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead className="whitespace-nowrap">Stock</TableHead>
                    <TableHead className="whitespace-nowrap">Minimum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="whitespace-nowrap">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMaterials.map((material) => {
                    const isExpanded = expandedMaterialIds.has(material.id);

                    return (
                      <Fragment key={material.id}>
                        <TableRow className={cn(isExpanded ? "bg-white/[0.03]" : "")}> 
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${material.displayName}`}
                              aria-expanded={isExpanded}
                              onClick={() => toggleExpandedMaterial(material.id)}
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                            </Button>
                          </TableCell>
                          <TableCell className="min-w-0">
                            <div className="space-y-1">
                              <p className="font-semibold leading-tight">{material.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {material.vendorName ? `Vendor: ${material.vendorName}` : "No vendor recorded"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{material.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {material.sourceWarehouses.map((source) => (
                                <Link
                                  key={source.warehouseCode}
                                  href={`/warehouses/${source.warehouseSlug}`}
                                  className="group"
                                >
                                  <Badge
                                    variant="outline"
                                    className="rounded-full border-white/10 bg-white/[0.03] text-[11px] transition-colors group-hover:bg-white/[0.08]"
                                  >
                                    {source.warehouseCode}: {formatNumber(source.currentStock)} {material.baseUnit}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap numeric-polished">{formatNumber(material.currentStock)} {material.baseUnit}</TableCell>
                          <TableCell className="whitespace-nowrap numeric-polished">{formatNumber(material.minimumStock)} {material.baseUnit}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("whitespace-nowrap", getStatusColor(material.status))}>
                              {getStatusLabel(material.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(material.updatedAt)}
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-white/[0.02] pb-4 pt-0">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">Source warehouse breakdown</p>
                                    <p className="text-xs text-muted-foreground">Combined data for the selected merged material.</p>
                                  </div>
                                  <Badge variant="secondary">
                                    {material.sourceWarehouses.length} source{material.sourceWarehouses.length === 1 ? "" : "s"}
                                  </Badge>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {material.sourceWarehouses.map((source) => (
                                    <Link
                                      key={source.warehouseCode}
                                      href={`/warehouses/${source.warehouseSlug}`}
                                      className="group block"
                                    >
                                      <div className="h-full rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-all duration-200 group-hover:border-white/15 group-hover:bg-white/[0.05]">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-semibold">{source.warehouseCode}</p>
                                            <p className="text-xs text-muted-foreground">{source.warehouseName}</p>
                                          </div>
                                          <Badge variant="outline" className={cn("whitespace-nowrap", getStatusColor(source.status))}>
                                            {getStatusLabel(source.status)}
                                          </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                                          <span>
                                            Stock <span className="numeric-polished font-semibold text-foreground">{formatNumber(source.currentStock)}</span> {material.baseUnit}
                                          </span>
                                          <span>
                                            Min <span className="numeric-polished font-semibold text-foreground">{formatNumber(source.minimumStock)}</span> {material.baseUnit}
                                          </span>
                                        </div>
                                        <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
                                          Updated {formatDateTime(source.updatedAt)}
                                        </p>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <PaginationControls
              page={currentPage}
              pageCount={pageCount}
              itemCount={filteredMaterials.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <DurationPickerDialog
        description="Choose a date range for the total raw materials PDF. The report is generated from the merged warehouse view."
        isLoading={isPdfPending}
        open={showPdfDialog}
        title="Download Total Raw Materials PDF"
        onConfirm={handleGeneratePdf}
        onOpenChange={setShowPdfDialog}
      />
    </motion.div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone: "amber" | "cyan" | "emerald" | "indigo";
  value: number | string;
}) {
  const toneClasses: Record<string, string> = {
    amber: "bg-amber-500/12 text-amber-300",
    cyan: "bg-cyan-500/12 text-cyan-300",
    emerald: "bg-emerald-500/12 text-emerald-300",
    indigo: "bg-indigo-500/12 text-indigo-300",
  };

  return (
    <Card className="glass-panel border-white/10">
      <CardContent className="flex min-h-[110px] items-center gap-3 sm:min-h-[132px] sm:gap-4">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-[16px] sm:h-12 sm:w-12 sm:rounded-2xl", toneClasses[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">{label}</p>
          <p className="numeric-polished numeric-no-ellipsis mt-1.5 text-xl font-semibold sm:mt-2 sm:text-2xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}