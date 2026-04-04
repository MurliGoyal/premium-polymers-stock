"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, ChevronDown, ChevronLeft, Download, History, Minus, OctagonAlert, Package, Plus, Search, SquareCheckBig, Trash2, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FinishedGoodsReport } from "@/components/pdf/finished-goods-report";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { ResponsiveFiltersSheet } from "@/components/shared/responsive-filters-sheet";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APP_TIME_ZONE, FINISHED_GOODS_PAGE_SIZE, MATERIAL_UNITS, THICKNESS_UNITS } from "@/lib/constants";
import { fuzzyScore } from "@/lib/fuzzy-search";
import { computeDurationLabel, formatPdfDate, generateAndDownloadPdf } from "@/lib/pdf-utils";
import { cn, formatDate, formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  addDispatch,
  addFinishedGood,
  addProduction,
  bulkEditFinishedGoodsStock,
  createDispatchParty,
  createMasterGood,
  createSubGood,
  deleteFinishedGood,
  deleteMasterGood,
  deleteSubGood,
  getFinishedGoodsPdfData,
} from "./actions";

type Good = {
  baseUnit: string;
  createdAt: string;
  currentStock: number;
  diameterUnit: string | null;
  diameterValue: number | null;
  id: string;
  isContainer: boolean;
  name: string;
  notes?: string | null;
  parentId: string | null;
  stockInDate: string;
  status: string;
  subGoods: Good[];
  updatedAt: string;
  warehouseCode: string;
};

type Party = {
  id: string;
  name: string;
};

type FinishedGoodsData = {
  goods: Good[];
  parties: Party[];
  stats: {
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentActivities: number;
    totalCount: number;
    totalStock: number;
  };
  warehouse: {
    code: string;
    name: string;
    slug: string;
    subtitle: string;
  };
};

type StatusFilter = "all" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type UpdatedFilter = "all" | "7d" | "30d";
type StockInDateFilter = "all" | "today" | "7d" | "30d" | "thisMonth" | "custom";
type SortOption = "updated-desc" | "updated-asc" | "stock-desc" | "stock-asc" | "name-asc" | "name-desc" | "in-date-desc" | "in-date-asc";
type PdfPreset = "today" | "this-week" | "this-month" | "this-year" | "custom";
type BulkEditRowState = { quantity: string; selected: boolean };

function compareFinishedGoods(a: Good, b: Good, sortOption: SortOption) {
  if (sortOption === "name-asc") return a.name.localeCompare(b.name);
  if (sortOption === "name-desc") return b.name.localeCompare(a.name);
  if (sortOption === "stock-desc") return b.currentStock - a.currentStock;
  if (sortOption === "stock-asc") return a.currentStock - b.currentStock;
  if (sortOption === "in-date-desc") return new Date(b.stockInDate).getTime() - new Date(a.stockInDate).getTime();
  if (sortOption === "in-date-asc") return new Date(a.stockInDate).getTime() - new Date(b.stockInDate).getTime();
  if (sortOption === "updated-asc") return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function getGoodSearchFields(good: Good) {
  return [
    good.name,
    formatDiameter(good.diameterValue, good.diameterUnit),
    good.baseUnit,
    good.notes ?? "",
  ];
}

function getGoodSearchScore(good: Good, query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return 0;
  }

  return getGoodSearchFields(good).reduce(
    (bestScore, field) => Math.max(bestScore, fuzzyScore(normalizedQuery, field)),
    0,
  );
}

function createInitialBulkRows(goods: Good[]): Record<string, BulkEditRowState> {
  return goods.reduce<Record<string, BulkEditRowState>>((accumulator, good) => {
    accumulator[good.id] = { quantity: "", selected: false };
    return accumulator;
  }, {});
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export function FinishedGoodsClient({
  canManage,
  data,
  isReadOnlyView = false,
  ownWarehouseCode = null,
}: {
  canManage: boolean;
  data: FinishedGoodsData;
  isReadOnlyView?: boolean;
  ownWarehouseCode?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPdfPending, startPdfTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>("all");
  const [stockInDateFilter, setStockInDateFilter] = useState<StockInDateFilter>("all");
  const [stockInDateFrom, setStockInDateFrom] = useState("");
  const [stockInDateTo, setStockInDateTo] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated-desc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [selectedMasterForVariant, setSelectedMasterForVariant] = useState<Good | null>(null);
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(() => new Set());
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newDiameter, setNewDiameter] = useState("");
  const [newDiameterUnit, setNewDiameterUnit] = useState<string>(THICKNESS_UNITS[0]);
  const [newInitialStock, setNewInitialStock] = useState("");
  const [newStockInDate, setNewStockInDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [selectedGood, setSelectedGood] = useState<Good | null>(null);
  const [productionQty, setProductionQty] = useState("");
  const [productionNotes, setProductionNotes] = useState("");

  const [createdParties, setCreatedParties] = useState<Party[]>([]);
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [dispatchPartyId, setDispatchPartyId] = useState("");
  const [dispatchGoodId, setDispatchGoodId] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [goodToDelete, setGoodToDelete] = useState<Good | null>(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const masterGoods = useMemo(
    () => data.goods.filter((good) => good.isContainer && good.parentId === null),
    [data.goods],
  );

  const stockableGoods = useMemo(
    () =>
      data.goods.flatMap((good) =>
        good.isContainer ? good.subGoods : [good],
      ),
    [data.goods],
  );

  const [bulkEditRows, setBulkEditRows] = useState<Record<string, BulkEditRowState>>(() => createInitialBulkRows(stockableGoods));
  const [bulkEditSearch, setBulkEditSearch] = useState("");
  const [bulkEditNotes, setBulkEditNotes] = useState("");
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfPreset, setPdfPreset] = useState<PdfPreset>("today");
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");

  const parties = useMemo(() => {
    const byId = new Map<string, Party>();

    for (const party of data.parties) {
      byId.set(party.id, party);
    }

    for (const party of createdParties) {
      byId.set(party.id, party);
    }

    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [createdParties, data.parties]);

  const dispatchPartyOptions = useMemo(
    () =>
      parties.map((party) => ({
        value: party.id,
        label: party.name,
      })),
    [parties],
  );

  const dispatchGoodOptions = useMemo(
    () =>
      stockableGoods
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((good) => ({
          value: good.id,
          label: good.name,
          description: `${formatDiameter(good.diameterValue, good.diameterUnit)} - ${formatNumber(good.currentStock)} ${good.baseUnit} in stock`,
        })),
    [stockableGoods],
  );

  const selectedDispatchGood = useMemo(
    () => stockableGoods.find((good) => good.id === dispatchGoodId) ?? null,
    [stockableGoods, dispatchGoodId],
  );

  const selectedPartyName = useMemo(() => {
    if (!dispatchPartyId) return "";
    return parties.find((party) => party.id === dispatchPartyId)?.name ?? "";
  }, [dispatchPartyId, parties]);

  const parsePositiveQuantity = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  };

  const parsedDispatchQty = parsePositiveQuantity(dispatchQty);

  const hasEnoughDispatchStock =
    !selectedDispatchGood ||
    (parsedDispatchQty !== null && parsedDispatchQty <= selectedDispatchGood.currentStock);

  const canSubmitDispatch =
    !!dispatchPartyId &&
    !!selectedDispatchGood &&
    parsedDispatchQty !== null &&
    hasEnoughDispatchStock &&
    parsedDispatchQty > 0;

  const query = deferredSearch.trim();
  const hasSearchQuery = query.length > 0;

  const units = useMemo(() => [...new Set(stockableGoods.map((good) => good.baseUnit))].filter(Boolean).sort(), [stockableGoods]);
  const filteredGoods = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const parseDate = (value: string) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const fromDate = stockInDateFrom ? parseDate(stockInDateFrom) : null;
    const toDate = stockInDateTo ? parseDate(stockInDateTo) : null;

    if (fromDate) fromDate.setHours(0, 0, 0, 0);
    if (toDate) toDate.setHours(23, 59, 59, 999);

    return stockableGoods.filter((good) => {
      const updatedAt = new Date(good.updatedAt);
      const stockInDate = parseDate(good.stockInDate);
      if (statusFilter !== "all" && good.status !== statusFilter) return false;
      if (unitFilter !== "all" && good.baseUnit !== unitFilter) return false;
      if (updatedFilter === "7d" && updatedAt < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
      if (updatedFilter === "30d" && updatedAt < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
      if (stockInDateFilter === "today" && (!stockInDate || stockInDate < startOfToday)) return false;
      if (stockInDateFilter === "7d" && (!stockInDate || stockInDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))) return false;
      if (stockInDateFilter === "30d" && (!stockInDate || stockInDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))) return false;
      if (stockInDateFilter === "thisMonth" && (!stockInDate || stockInDate < startOfMonth)) return false;
      if (stockInDateFilter === "custom") {
        if (!stockInDate) return false;
        if (fromDate && stockInDate < fromDate) return false;
        if (toDate && stockInDate > toDate) return false;
      }
      return true;
    });
  }, [stockableGoods, statusFilter, unitFilter, updatedFilter, stockInDateFilter, stockInDateFrom, stockInDateTo]);

  const rankedGoods = useMemo(() => {
    const parsed = filteredGoods.map((good) => ({
      good,
      searchScore: hasSearchQuery ? getGoodSearchScore(good, query) : 0,
    }));

    const visible = hasSearchQuery
      ? parsed.filter(({ searchScore }) => searchScore > 0)
      : parsed;

    visible.sort((a, b) => {
      if (hasSearchQuery && b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }

      return compareFinishedGoods(a.good, b.good, sortOption);
    });

    return visible;
  }, [filteredGoods, hasSearchQuery, query, sortOption]);

  const sortedGoods = useMemo(() => rankedGoods.map(({ good }) => good), [rankedGoods]);
  const searchScoreById = useMemo(
    () => new Map(rankedGoods.map(({ good, searchScore }) => [good.id, searchScore])),
    [rankedGoods],
  );

  const hasInventoryFilters =
    statusFilter !== "all" ||
    unitFilter !== "all" ||
    updatedFilter !== "all" ||
    stockInDateFilter !== "all";

  const groupedHierarchy = useMemo(() => {
    const availableSubGoodsByMaster = new Map<string, Good[]>();
    const matchedSubGoodsByMaster = new Map<string, Good[]>();

    for (const good of filteredGoods) {
      if (!good.parentId) {
        continue;
      }

      const current = availableSubGoodsByMaster.get(good.parentId) ?? [];
      current.push(good);
      availableSubGoodsByMaster.set(good.parentId, current);
    }

    for (const good of sortedGoods) {
      if (!good.parentId) {
        continue;
      }

      const current = matchedSubGoodsByMaster.get(good.parentId) ?? [];
      current.push(good);
      matchedSubGoodsByMaster.set(good.parentId, current);
    }

    return masterGoods
      .map((master, originalIndex) => {
        const masterSearchScore = hasSearchQuery ? getGoodSearchScore(master, query) : 0;
        const masterMatchesQuery = hasSearchQuery ? masterSearchScore > 0 : false;
        const availableSubGoods = availableSubGoodsByMaster.get(master.id) ?? [];
        const matchedSubGoods = matchedSubGoodsByMaster.get(master.id) ?? [];
        const visibleSubGoods = hasSearchQuery
          ? (masterMatchesQuery ? availableSubGoods : matchedSubGoods)
          : availableSubGoods;
        const bestVisibleSubScore = hasSearchQuery
          ? Math.max(
              0,
              ...visibleSubGoods.map((subGood) => searchScoreById.get(subGood.id) ?? 0),
            )
          : 0;

        return {
          master,
          masterMatchesQuery,
          originalIndex,
          subGoods: visibleSubGoods,
          groupScore: Math.max(masterSearchScore, bestVisibleSubScore),
        };
      })
      .filter((row) => {
        if (!hasInventoryFilters && !hasSearchQuery) {
          return true;
        }

        return row.masterMatchesQuery || row.subGoods.length > 0;
      })
      .sort((a, b) => {
        if (hasSearchQuery && b.groupScore !== a.groupScore) {
          return b.groupScore - a.groupScore;
        }

        return a.originalIndex - b.originalIndex;
      });
  }, [filteredGoods, hasInventoryFilters, hasSearchQuery, masterGoods, query, searchScoreById, sortedGoods]);

  const legacyGoods = useMemo(
    () => sortedGoods.filter((good) => !good.parentId),
    [sortedGoods],
  );

  const pageCount = Math.max(1, Math.ceil(legacyGoods.length / FINISHED_GOODS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedGoods = legacyGoods.slice((currentPage - 1) * FINISHED_GOODS_PAGE_SIZE, currentPage * FINISHED_GOODS_PAGE_SIZE);
  const activeFilterCount = [
    Boolean(deferredSearch),
    statusFilter !== "all",
    unitFilter !== "all",
    updatedFilter !== "all",
    stockInDateFilter !== "all",
    stockInDateFilter === "custom" && Boolean(stockInDateFrom),
    stockInDateFilter === "custom" && Boolean(stockInDateTo),
    sortOption !== "updated-desc",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setUnitFilter("all");
    setUpdatedFilter("all");
    setStockInDateFilter("all");
    setStockInDateFrom("");
    setStockInDateTo("");
    setSortOption("updated-desc");
    setPage(1);
  };

  const resetAddDialog = () => {
    setNewName("");
    setNewUnit("pcs");
    setNewDiameter("");
    setNewDiameterUnit(THICKNESS_UNITS[0]);
    setNewInitialStock("");
    setNewStockInDate(new Date().toISOString().slice(0, 10));
    setSelectedMasterForVariant(null);
  };

  const toggleMasterExpansion = (masterId: string) => {
    setExpandedMasters((current) => {
      const next = new Set(current);
      if (next.has(masterId)) {
        next.delete(masterId);
      } else {
        next.add(masterId);
      }
      return next;
    });
  };

  const handleAddGroup = () => {
    if (!newName.trim()) return toast.error("Enter a group name");

    startTransition(async () => {
      try {
        const result = await createMasterGood({
          warehouseCode: data.warehouse.code,
          name: newName.trim(),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(`Added group ${newName.trim()}`);
        setShowAddGroupDialog(false);
        resetAddDialog();
        router.refresh();
      } catch {
        toast.error("Failed to add group");
      }
    });
  };

  const openVariantDialog = (master: Good) => {
    setSelectedMasterForVariant(master);
    setNewName("");
    setNewUnit("pcs");
    setNewDiameter("");
    setNewDiameterUnit(THICKNESS_UNITS[0]);
    setNewInitialStock("");
    setNewStockInDate(new Date().toISOString().slice(0, 10));
    setShowAddDialog(true);
  };

  const handleAddGood = () => {
    if (!newName.trim()) return toast.error("Enter a name");
    const parsedDiameter = newDiameter.trim() === "" ? undefined : Number(newDiameter);
    if (parsedDiameter !== undefined && (!Number.isFinite(parsedDiameter) || parsedDiameter < 0)) return toast.error("Diameter must be a valid non-negative number");
    startTransition(async () => {
      try {
        const result = selectedMasterForVariant
          ? await createSubGood({
              warehouseCode: data.warehouse.code,
              masterGoodId: selectedMasterForVariant.id,
              name: newName.trim(),
              baseUnit: newUnit,
              diameterValue: parsedDiameter,
              diameterUnit: parsedDiameter !== undefined ? newDiameterUnit : undefined,
              initialStock: newInitialStock ? Number(newInitialStock) : 0,
              stockInDate: newStockInDate || undefined,
            })
          : await addFinishedGood({ warehouseCode: data.warehouse.code, name: newName.trim(), baseUnit: newUnit, diameterValue: parsedDiameter, diameterUnit: parsedDiameter !== undefined ? newDiameterUnit : undefined, initialStock: newInitialStock ? Number(newInitialStock) : 0, stockInDate: newStockInDate || undefined });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(selectedMasterForVariant ? `Added variant ${newName.trim()}` : `Added ${newName.trim()}`);
        setShowAddDialog(false);
        resetAddDialog();
        router.refresh();
      } catch {
        toast.error(selectedMasterForVariant ? "Failed to add variant" : "Failed to add finished good");
      }
    });
  };

  const handleProduction = () => {
    if (!selectedGood || !productionQty) return;
    const qty = Number(productionQty);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    startTransition(async () => {
      try {
        const result = await addProduction({ warehouseCode: data.warehouse.code, finishedGoodId: selectedGood.id, quantity: qty, notes: productionNotes.trim() || undefined });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Added ${qty} ${selectedGood.baseUnit} to ${selectedGood.name}`);
        setShowProductionDialog(false);
        router.refresh();
      } catch {
        toast.error("Failed to add production");
      }
    });
  };

  const resetDispatchDialog = () => {
    setDispatchPartyId("");
    setDispatchGoodId("");
    setDispatchQty("");
    setDispatchNotes("");
  };

  const openDispatchDialogForGood = (good: Good) => {
    setSelectedGood(good);
    setDispatchGoodId(good.id);
    setDispatchPartyId("");
    setDispatchQty("");
    setDispatchNotes("");
    setShowDispatchDialog(true);
  };

  const handleCreateDispatchParty = async (name: string) => {
    const result = await createDispatchParty(name);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setCreatedParties((current) => {
      if (current.some((party) => party.id === result.entity.id)) {
        return current;
      }

      return [...current, result.entity];
    });

    setDispatchPartyId(result.entity.id);
    toast.success(result.created ? "Party added" : "Party selected");

    return result.entity.id;
  };

  const handleDispatch = () => {
    if (!canSubmitDispatch || !selectedDispatchGood || !selectedPartyName || parsedDispatchQty === null) {
      toast.error("Complete all dispatch fields");
      return;
    }

    startTransition(async () => {
      try {
        if (!hasEnoughDispatchStock && selectedDispatchGood) {
          toast.error(
            `Only ${formatNumber(selectedDispatchGood.currentStock)} ${selectedDispatchGood.baseUnit} available in stock`,
          );
          return;
        }

        const result = await addDispatch({
          warehouseCode: data.warehouse.code,
          finishedGoodId: selectedDispatchGood.id,
          partyName: selectedPartyName,
          quantity: parsedDispatchQty,
          notes: dispatchNotes.trim() || undefined,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(
          `Dispatched ${formatNumber(parsedDispatchQty)} ${selectedDispatchGood.baseUnit}`,
        );
        setShowDispatchDialog(false);
        resetDispatchDialog();
        router.refresh();
      } catch {
        toast.error("Failed to dispatch");
      }
    });
  };

  const handleDeleteGood = () => {
    if (!goodToDelete) return;
    startTransition(async () => {
      try {
        const result = goodToDelete.parentId
          ? await deleteSubGood({ warehouseCode: data.warehouse.code, finishedGoodId: goodToDelete.id })
          : await deleteFinishedGood({ warehouseCode: data.warehouse.code, finishedGoodId: goodToDelete.id });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Deleted ${goodToDelete.name}`);
        setShowDeleteDialog(false);
        setGoodToDelete(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete finished good");
      }
    });
  };

  const handleDeleteMaster = (master: Good) => {
    startTransition(async () => {
      try {
        const result = await deleteMasterGood({
          warehouseCode: data.warehouse.code,
          masterGoodId: master.id,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(`Deleted group ${master.name}`);
        router.refresh();
      } catch {
        toast.error("Failed to delete group");
      }
    });
  };

  const openBulkEditDialog = () => {
    setBulkEditRows(createInitialBulkRows(stockableGoods));
    setBulkEditSearch("");
    setBulkEditNotes("");
    setShowBulkEditDialog(true);
  };

  const bulkEditFilteredGoods = useMemo(() => {
    const query = bulkEditSearch.trim();
    if (!query) return stockableGoods;
    return stockableGoods
      .map((good) => ({
        good,
        score: getGoodSearchScore(good, query),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.good.name.localeCompare(b.good.name))
      .map(({ good }) => good);
  }, [bulkEditSearch, stockableGoods]);

  const bulkEditSelectedCount = useMemo(
    () => Object.values(bulkEditRows).filter((row) => row.selected).length,
    [bulkEditRows]
  );

  const toggleBulkRowSelection = (goodId: string, selected: boolean) => {
    setBulkEditRows((current) => ({
      ...current,
      [goodId]: {
        quantity: current[goodId]?.quantity ?? "",
        selected,
      },
    }));
  };

  const updateBulkRowQuantity = (goodId: string, quantity: string) => {
    setBulkEditRows((current) => ({
      ...current,
      [goodId]: {
        quantity,
        selected: current[goodId]?.selected ?? false,
      },
    }));
  };

  const toggleSelectVisibleBulkRows = (selected: boolean) => {
    setBulkEditRows((current) => {
      const next = { ...current };
      for (const good of bulkEditFilteredGoods) {
        next[good.id] = {
          quantity: next[good.id]?.quantity ?? "",
          selected,
        };
      }
      return next;
    });
  };

  const handleBulkEditSubmit = () => {
    const preparedItems: Array<{ finishedGoodId: string; quantity: number; name: string }> = [];

    for (const good of stockableGoods) {
      const row = bulkEditRows[good.id];
      if (!row?.selected) continue;

      const parsedQuantity = Number(row.quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        toast.error(`Enter a valid quantity for ${good.name}`);
        return;
      }

      preparedItems.push({
        finishedGoodId: good.id,
        quantity: parsedQuantity,
        name: good.name,
      });
    }

    if (preparedItems.length === 0) {
      toast.error("Select at least one finished good");
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkEditFinishedGoodsStock({
          warehouseCode: data.warehouse.code,
          items: preparedItems.map(({ finishedGoodId, quantity }) => ({ finishedGoodId, quantity })),
          notes: bulkEditNotes.trim() || undefined,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(`Production updated for ${result.processed} item${result.processed > 1 ? "s" : ""}`);
        setShowBulkEditDialog(false);
        router.refresh();
      } catch {
        toast.error("Bulk edit failed");
      }
    });
  };

  const resolvePdfRange = () => {
    const now = getZonedNow(APP_TIME_ZONE);

    if (pdfPreset === "custom") {
      const fromDate = pdfFromDate ? new Date(`${pdfFromDate}T00:00:00`) : null;
      const toDate = pdfToDate ? new Date(`${pdfToDate}T23:59:59`) : null;

      if (!fromDate || Number.isNaN(fromDate.getTime())) {
        throw new Error("Select a valid from date.");
      }

      if (!toDate || Number.isNaN(toDate.getTime())) {
        throw new Error("Select a valid to date.");
      }

      if (fromDate > toDate) {
        throw new Error("From date must be before to date.");
      }

      return {
        fromDate,
        label: computeDurationLabel(fromDate, toDate),
        toDate,
      };
    }

    const fromDate = new Date(now);
    const toDate = new Date(now);
    toDate.setHours(23, 59, 59, 999);

    if (pdfPreset === "today") {
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate, label: "Today", toDate };
    }

    if (pdfPreset === "this-week") {
      const day = now.getDay();
      const diffFromMonday = day === 0 ? 6 : day - 1;
      fromDate.setDate(now.getDate() - diffFromMonday);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate, label: "This Week", toDate };
    }

    if (pdfPreset === "this-month") {
      fromDate.setDate(1);
      fromDate.setHours(0, 0, 0, 0);
      return { fromDate, label: "This Month", toDate };
    }

    fromDate.setMonth(0, 1);
    fromDate.setHours(0, 0, 0, 0);
    return { fromDate, label: "This Year", toDate };
  };

  const handleGeneratePdf = () => {
    startPdfTransition(async () => {
      try {
        const { fromDate, label, toDate } = resolvePdfRange();

        const reportData = await getFinishedGoodsPdfData({
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          warehouseCode: data.warehouse.code,
        });

        const groups = data.goods
          .map((good) => {
            if (good.isContainer) {
              return {
                masterName: good.name,
                rows: good.subGoods.map((subGood) => ({
                  balance: subGood.currentStock,
                  createdAt: formatPdfDate(subGood.createdAt),
                  dispatch: reportData.totalsByGoodId[subGood.id]?.dispatch ?? 0,
                  name: subGood.name,
                  production: reportData.totalsByGoodId[subGood.id]?.production ?? 0,
                  size: formatDiameter(subGood.diameterValue, subGood.diameterUnit),
                  unit: subGood.baseUnit,
                  updatedAt: formatPdfDate(subGood.updatedAt),
                })),
              };
            }

            return {
              masterName: null,
              rows: [
                {
                  balance: good.currentStock,
                  createdAt: formatPdfDate(good.createdAt),
                  dispatch: reportData.totalsByGoodId[good.id]?.dispatch ?? 0,
                  name: good.name,
                  production: reportData.totalsByGoodId[good.id]?.production ?? 0,
                  size: formatDiameter(good.diameterValue, good.diameterUnit),
                  unit: good.baseUnit,
                  updatedAt: formatPdfDate(good.updatedAt),
                },
              ],
            };
          })
          .filter((group) => group.rows.length > 0);

        const periodLabel = label === "Today" || label === "This Week" || label === "This Month" || label === "This Year"
          ? `${label} (${computeDurationLabel(fromDate, toDate)})`
          : label;

        await generateAndDownloadPdf(
          <FinishedGoodsReport
            durationLabel={periodLabel}
            generatedLabel={formatPdfDate(new Date())}
            groups={groups}
            warehouseCode={data.warehouse.code}
          />,
          `finished-goods-${data.warehouse.code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`,
        );

        toast.success("Finished goods PDF downloaded.");
        setShowPdfDialog(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate PDF report.";
        toast.error(message);
      }
    });
  };

  const filters = (
    <>
      <div className="relative md:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, unit, or diameter..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-11" />
      </div>
      <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as StatusFilter); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="IN_STOCK">In stock</SelectItem>
          <SelectItem value="LOW_STOCK">Low stock</SelectItem>
          <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
        </SelectContent>
      </Select>
      <Select value={unitFilter} onValueChange={(value) => { setUnitFilter(value); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All units</SelectItem>
          {units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={updatedFilter} onValueChange={(value) => { setUpdatedFilter(value as UpdatedFilter); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Recently updated" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any time</SelectItem>
          <SelectItem value="7d">Updated in 7 days</SelectItem>
          <SelectItem value="30d">Updated in 30 days</SelectItem>
        </SelectContent>
      </Select>
      <Select value={stockInDateFilter} onValueChange={(value) => { setStockInDateFilter(value as StockInDateFilter); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Stock in date" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any stock-in date</SelectItem>
          <SelectItem value="today">Stocked today</SelectItem>
          <SelectItem value="7d">Stocked in last 7 days</SelectItem>
          <SelectItem value="30d">Stocked in last 30 days</SelectItem>
          <SelectItem value="thisMonth">Stocked this month</SelectItem>
          <SelectItem value="custom">Custom date range</SelectItem>
        </SelectContent>
      </Select>
      {stockInDateFilter === "custom" ? (
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-2">
          <Input
            type="date"
            aria-label="Stock in from date"
            value={stockInDateFrom}
            onChange={(event) => { setStockInDateFrom(event.target.value); setPage(1); }}
          />
          <Input
            type="date"
            aria-label="Stock in to date"
            value={stockInDateTo}
            onChange={(event) => { setStockInDateTo(event.target.value); setPage(1); }}
          />
        </div>
      ) : null}
      <Select value={sortOption} onValueChange={(value) => { setSortOption(value as SortOption); setPage(1); }}>
        <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="updated-desc">Latest activity</SelectItem>
          <SelectItem value="updated-asc">Oldest activity</SelectItem>
          <SelectItem value="stock-desc">Stock high to low</SelectItem>
          <SelectItem value="stock-asc">Stock low to high</SelectItem>
          <SelectItem value="name-asc">Name A to Z</SelectItem>
          <SelectItem value="name-desc">Name Z to A</SelectItem>
          <SelectItem value="in-date-desc">Newest stock-in date</SelectItem>
          <SelectItem value="in-date-asc">Oldest stock-in date</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
    </>
  );

  const statCards = [
    { icon: Package, label: "Total goods", value: data.stats.totalCount },
    { icon: BarChart3, label: "Total stock", tone: "emerald" as const, value: formatNumber(data.stats.totalStock) },
    { icon: Package, label: "In stock", tone: "blue" as const, value: data.stats.inStockCount },
    { icon: OctagonAlert, label: "Out of stock", tone: "red" as const, value: data.stats.outOfStockCount },
    { icon: History, label: "Recent activity", tone: "amber" as const, value: data.stats.recentActivities },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants} className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/finished-goods" className="flex items-center gap-1 transition-colors hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />Finished Goods</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{data.warehouse.code}</span>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Warehouse inventory"
          title={data.warehouse.code}
          description={`${data.warehouse.subtitle}. ${data.stats.recentActivities} activity logs in the last 7 days.`}
          badge={<Badge variant="secondary"><Warehouse className="mr-1 h-3 w-3" />Finished goods view</Badge>}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href={`/finished-goods-history?warehouse=${data.warehouse.code}`}>
                  <History className="h-4 w-4" />Stock history
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowPdfDialog(true)}>
                <Download className="h-4 w-4" />Download PDF
              </Button>
              {canManage ? (
                <Button type="button" variant="outline" onClick={openBulkEditDialog}>
                  <SquareCheckBig className="h-4 w-4" />Bulk edit
                </Button>
              ) : null}
              {canManage ? <Button type="button" variant="outline" onClick={() => { resetAddDialog(); setShowAddGroupDialog(true); }}><Plus className="h-4 w-4" />Add group</Button> : null}
              {canManage ? <Button type="button" onClick={() => { resetAddDialog(); setShowAddDialog(true); }}><Plus className="h-4 w-4" />Add finished good</Button> : null}
            </>
          }
        />
      </motion.div>

      {isReadOnlyView ? (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-300/30 bg-amber-500/10">
            <CardContent className="py-3 text-sm text-amber-100">
              You are viewing warehouse {data.warehouse.code} in read-only mode.
              {ownWarehouseCode ? ` You can only manage warehouse ${ownWarehouseCode}.` : ""}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card, index) => <MetricCard key={card.label} className={index === statCards.length - 1 ? "col-span-2 md:col-span-1" : undefined} icon={card.icon} label={card.label} tone={card.tone} value={card.value} />)}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="space-y-4">
            <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-7">{filters}</div>
            <div className="flex flex-col gap-3 md:hidden">
              <ResponsiveFiltersSheet activeCount={activeFilterCount} title="Finished goods filters" description="Refine the finished goods list.">{filters}</ResponsiveFiltersSheet>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by name, unit, or diameter..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-11" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        {groupedHierarchy.length > 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium text-muted-foreground">Master groups</p>
              {groupedHierarchy.map(({ master, subGoods }) => {
                const isExpanded = expandedMasters.has(master.id) || deferredSearch.trim().length > 0;
                const combinedStock = subGoods.reduce((total, good) => total + good.currentStock, 0);

                return (
                  <Card key={master.id} className="rounded-2xl border border-white/10">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleMasterExpansion(master.id)}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isExpanded ? "rotate-180" : "")} />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold">{master.name}</p>
                            <p className="text-xs text-muted-foreground">{subGoods.length} variant{subGoods.length === 1 ? "" : "s"} · {formatNumber(combinedStock)} total stock</p>
                          </div>
                        </button>
                        {canManage ? (
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openVariantDialog(master)}>
                              <Plus className="h-3.5 w-3.5" />Add variant
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDeleteMaster(master)}>
                              <Trash2 className="h-3.5 w-3.5" />Delete group
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {subGoods.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">No variants in this group yet.</p>
                          ) : (
                            subGoods.map((good) => (
                              <Card key={good.id} className="rounded-2xl border border-white/10">
                                <CardContent className="space-y-3 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold">{good.name}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">{formatDiameter(good.diameterValue, good.diameterUnit)}</p>
                                    </div>
                                    <Badge variant="outline" className={getStatusColor(good.status)}>{getStatusLabel(good.status)}</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <InfoPill label="Current stock" value={`${formatNumber(good.currentStock)} ${good.baseUnit}`} />
                                    <InfoPill label="In stock date" value={formatDate(good.stockInDate)} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {canManage ? <Button type="button" variant="outline" onClick={() => { setSelectedGood(good); setProductionQty(""); setProductionNotes(""); setShowProductionDialog(true); }}><Plus className="h-4 w-4" />Production</Button> : null}
                                    {canManage ? <Button type="button" variant="outline" onClick={() => openDispatchDialogForGood(good)}><Minus className="h-4 w-4" />Dispatch</Button> : null}
                                    {canManage ? <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setGoodToDelete(good); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" />Delete</Button> : null}
                                    <Button asChild variant="ghost" className={!canManage ? "col-span-2" : ""}><Link href={`/finished-goods-history?warehouse=${data.warehouse.code}`}>History</Link></Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {legacyGoods.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No flat goods found</h3>
              <p className="mt-1 text-sm text-muted-foreground">{stockableGoods.length === 0 ? "Add your first finished good to get started in this warehouse." : "All results belong to master groups."}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedGoods.map((good) => (
                  <Card key={good.id} className="rounded-2xl sm:rounded-[24px]">
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold">{good.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{formatDiameter(good.diameterValue, good.diameterUnit)}</p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(good.status)}>{getStatusLabel(good.status)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <InfoPill label="Current stock" value={`${formatNumber(good.currentStock)} ${good.baseUnit}`} />
                        <InfoPill label="In stock date" value={formatDate(good.stockInDate)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {canManage ? <Button type="button" variant="outline" onClick={() => { setSelectedGood(good); setProductionQty(""); setProductionNotes(""); setShowProductionDialog(true); }}><Plus className="h-4 w-4" />Production</Button> : null}
                        {canManage ? <Button type="button" variant="outline" onClick={() => openDispatchDialogForGood(good)}><Minus className="h-4 w-4" />Dispatch</Button> : null}
                        {canManage ? <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setGoodToDelete(good); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" />Delete</Button> : null}
                        <Button asChild variant="ghost" className={!canManage ? "col-span-2" : ""}><Link href={`/finished-goods-history?warehouse=${data.warehouse.code}`}>History</Link></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <PaginationControls page={currentPage} pageCount={pageCount} itemCount={legacyGoods.length} pageSize={FINISHED_GOODS_PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </Card>
      </motion.div>

      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Finished Goods PDF</DialogTitle>
            <DialogDescription>
              Choose a duration for production and dispatch totals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="pdf-duration">Duration</label>
              <Select value={pdfPreset} onValueChange={(value) => setPdfPreset(value as PdfPreset)}>
                <SelectTrigger id="pdf-duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pdfPreset === "custom" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="pdf-from-date">From</label>
                  <Input
                    id="pdf-from-date"
                    type="date"
                    value={pdfFromDate}
                    onChange={(event) => setPdfFromDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="pdf-to-date">To</label>
                  <Input
                    id="pdf-to-date"
                    type="date"
                    value={pdfToDate}
                    onChange={(event) => setPdfToDate(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Date calculations use timezone {APP_TIME_ZONE}. Balance is always live stock at report generation time.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfDialog(false)}>Cancel</Button>
            <Button onClick={handleGeneratePdf} disabled={isPdfPending}>
              {isPdfPending ? "Generating..." : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddGroupDialog && canManage} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Master Group</DialogTitle>
            <DialogDescription>Create a new container group in warehouse {data.warehouse.code}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fg-group-name">Group name</label>
            <Input id="fg-group-name" autoComplete="off" placeholder="e.g. ABC" value={newName} onChange={(event) => setNewName(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroupDialog(false)}>Cancel</Button>
            <Button onClick={handleAddGroup} disabled={isPending}>{isPending ? "Adding..." : "Add group"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog && canManage} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selectedMasterForVariant ? "Add Variant" : "Add Finished Good"}</DialogTitle><DialogDescription>{selectedMasterForVariant ? `Create a variant under ${selectedMasterForVariant.name} in warehouse ${data.warehouse.code}.` : `Add a new finished good to warehouse ${data.warehouse.code}.`}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-name">{selectedMasterForVariant ? "Variant name" : "Name"}</label><Input id="fg-name" autoComplete="off" placeholder={selectedMasterForVariant ? "e.g. ABC 100 mm" : "e.g. PP Bags 25kg"} value={newName} onChange={(event) => setNewName(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-unit">Unit</label><Select value={newUnit} onValueChange={setNewUnit}><SelectTrigger id="fg-unit"><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{MATERIAL_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-diameter">Diameter (optional)</label><Input id="fg-diameter" type="number" min="0" step="any" placeholder="e.g. 2.5" value={newDiameter} onChange={(event) => setNewDiameter(event.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-diameter-unit">Diameter unit</label><Select value={newDiameterUnit} onValueChange={setNewDiameterUnit}><SelectTrigger id="fg-diameter-unit"><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{THICKNESS_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-stock">Initial stock (optional)</label><Input id="fg-stock" type="number" min="0" step="any" placeholder="0" value={newInitialStock} onChange={(event) => setNewInitialStock(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-stock-in-date">Date of in stock</label><Input id="fg-stock-in-date" type="date" value={newStockInDate} onChange={(event) => setNewStockInDate(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button><Button onClick={handleAddGood} disabled={isPending}>{isPending ? "Adding..." : selectedMasterForVariant ? "Add variant" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProductionDialog && canManage} onOpenChange={setShowProductionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Production</DialogTitle><DialogDescription>{selectedGood ? `${selectedGood.name} - currently ${formatNumber(selectedGood.currentStock)} ${selectedGood.baseUnit}` : ""}</DialogDescription></DialogHeader>
          {selectedGood ? <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="prod-qty">Quantity ({selectedGood.baseUnit})</label><Input id="prod-qty" type="number" min="0" step="any" placeholder={`Enter ${selectedGood.baseUnit}`} value={productionQty} onChange={(event) => setProductionQty(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="prod-notes">Notes (optional)</label><Textarea id="prod-notes" placeholder="e.g. Batch #1234" value={productionNotes} onChange={(event) => setProductionNotes(event.target.value)} rows={2} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setShowProductionDialog(false)}>Cancel</Button><Button onClick={handleProduction} disabled={isPending || !productionQty}>{isPending ? "Adding..." : "Add Production"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDispatchDialog && canManage}
        onOpenChange={(open) => {
          setShowDispatchDialog(open);
          if (!open) {
            resetDispatchDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dispatch finished goods</DialogTitle>
            <DialogDescription>
              Enter dispatch quantity and recipient details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Party name <span aria-hidden="true">*</span>
                </label>
                <SearchableSelect
                  ariaLabel="Party name"
                  ariaRequired
                  allowCreate
                  creatingLabel="Saving party..."
                  createOptionLabel={(query) => `Add \"${query}\" as party`}
                  emptyState="No party found"
                  options={dispatchPartyOptions}
                  placeholder="Select or type party"
                  searchPlaceholder="Search party..."
                  value={dispatchPartyId}
                  onChange={setDispatchPartyId}
                  onCreateOption={handleCreateDispatchParty}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Finished goods name <span aria-hidden="true">*</span>
                </label>
                <SearchableSelect
                  ariaLabel="Finished goods"
                  ariaRequired
                  emptyState="No finished good found"
                  options={dispatchGoodOptions}
                  placeholder="Select finished good"
                  searchPlaceholder="Search finished goods..."
                  value={dispatchGoodId}
                  onChange={setDispatchGoodId}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected size</p>
              <p className="mt-2 text-base font-semibold">
                {selectedDispatchGood ? formatDiameter(selectedDispatchGood.diameterValue, selectedDispatchGood.diameterUnit) : "Select finished good to view size"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Current stock: {selectedDispatchGood ? `${formatNumber(selectedDispatchGood.currentStock)} ${selectedDispatchGood.baseUnit}` : "-"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="disp-qty">Quantity</label>
                <Input
                  id="disp-qty"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 300 or 300.5"
                  value={dispatchQty}
                  onChange={(event) => setDispatchQty(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="disp-remaining-stock">Stock after dispatch</label>
                <Input
                  id="disp-remaining-stock"
                  value={selectedDispatchGood && parsedDispatchQty !== null ? `${formatNumber(selectedDispatchGood.currentStock - parsedDispatchQty)} ${selectedDispatchGood.baseUnit}` : ""}
                  placeholder="Auto calculated"
                  readOnly
                  className={cn(
                    "bg-muted/40",
                    selectedDispatchGood && parsedDispatchQty !== null && parsedDispatchQty > selectedDispatchGood.currentStock
                      ? "text-destructive"
                      : "",
                  )}
                />
              </div>
            </div>

            {!hasEnoughDispatchStock && selectedDispatchGood ? (
              <p className="text-sm text-destructive">
                Dispatch exceeds available stock ({formatNumber(selectedDispatchGood.currentStock)} {selectedDispatchGood.baseUnit}).
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="disp-notes">Notes (optional)</label>
              <Textarea
                id="disp-notes"
                placeholder="e.g. Batch code / invoice / remarks"
                value={dispatchNotes}
                onChange={(event) => setDispatchNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDispatchDialog(false);
                resetDispatchDialog();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDispatch} disabled={isPending || !canSubmitDispatch}>
              {isPending ? "Dispatching..." : "Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog && canManage} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setGoodToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete Finished Good</DialogTitle><DialogDescription>{goodToDelete ? `Are you sure you want to delete ${goodToDelete.name}? This will also remove its activity history.` : "Are you sure you want to delete this finished good?"}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteGood} disabled={isPending || !goodToDelete}>{isPending ? "Deleting..." : "Okay"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkEditDialog && canManage} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk edit finished goods</DialogTitle>
            <DialogDescription>
              Select multiple goods and enter production quantity for each selected item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium">
                  <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Production</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bulk-edit-search">Search</label>
                <Input
                  id="bulk-edit-search"
                  placeholder="Search goods by name, unit, diameter"
                  value={bulkEditSearch}
                  onChange={(event) => setBulkEditSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {bulkEditSelectedCount} selected
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectVisibleBulkRows(true)}>
                  Select visible
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectVisibleBulkRows(false)}>
                  Clear visible
                </Button>
              </div>
            </div>

            <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-xl border border-white/8 p-2">
              {bulkEditFilteredGoods.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No finished goods match your search.</p>
              ) : (
                bulkEditFilteredGoods.map((good) => {
                  const row = bulkEditRows[good.id] ?? { quantity: "", selected: false };

                  return (
                    <div key={good.id} className={cn("grid items-end gap-2 rounded-lg border border-white/8 p-3 md:grid-cols-[1fr_150px_120px]", row.selected && "bg-white/[0.03]")}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{good.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Current: {formatNumber(good.currentStock)} {good.baseUnit}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground" htmlFor={`bulk-qty-${good.id}`}>
                          Quantity
                        </label>
                        <Input
                          id={`bulk-qty-${good.id}`}
                          type="number"
                          min="0"
                          step="any"
                          placeholder={good.baseUnit}
                          value={row.quantity}
                          disabled={!row.selected}
                          onChange={(event) => updateBulkRowQuantity(good.id, event.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant={row.selected ? "default" : "outline"}
                        onClick={() => toggleBulkRowSelection(good.id, !row.selected)}
                      >
                        {row.selected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="bulk-edit-notes">Notes (optional)</label>
              <Textarea
                id="bulk-edit-notes"
                placeholder="Applied to all selected bulk entries"
                value={bulkEditNotes}
                onChange={(event) => setBulkEditNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkEditSubmit} disabled={isPending}>
              {isPending ? "Saving..." : "Apply production"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MetricCard({ className, icon: Icon, label, tone = "default", value }: { className?: string; icon: React.ComponentType<{ className?: string }>; label: string; tone?: "default" | "emerald" | "amber" | "red" | "blue"; value: number | string }) {
  const toneClasses: Record<string, string> = { default: "bg-primary/16 text-primary", emerald: "bg-emerald-500/14 text-emerald-300", amber: "bg-amber-500/14 text-amber-300", red: "bg-red-500/14 text-red-300", blue: "bg-sky-500/14 text-sky-300" };
  const valueText = String(value);
  const valueSizeClass = valueText.length > 14 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl";

  return <Card className={cn("rounded-2xl sm:rounded-[24px]", className)}><CardContent className="flex min-h-[110px] items-center gap-2.5 sm:min-h-[132px] sm:gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-[16px] sm:h-12 sm:w-12 sm:rounded-2xl ${toneClasses[tone]}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">{label}</p><p className={cn("numeric-polished numeric-no-ellipsis mt-1.5 font-semibold sm:mt-2", valueSizeClass)}>{value}</p></div></CardContent></Card>;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p><p className="numeric-polished-soft mt-2 text-sm font-medium">{value}</p></div>;
}

function formatDiameter(value: number | null, unit: string | null) {
  if (value === null) return "No diameter";
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function getZonedNow(timeZone: string) {
  const zonedText = new Date().toLocaleString("en-US", { timeZone });
  return new Date(zonedText);
}
