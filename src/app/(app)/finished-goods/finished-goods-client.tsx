"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, ChevronLeft, History, Minus, OctagonAlert, Package, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { FINISHED_GOODS_PAGE_SIZE, MATERIAL_UNITS, THICKNESS_UNITS } from "@/lib/constants";
import { cn, formatDate, formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import { addDispatch, addFinishedGood, addProduction, deleteFinishedGood } from "./actions";

type Good = {
  baseUnit: string;
  currentStock: number;
  diameterUnit: string | null;
  diameterValue: number | null;
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  warehouseCode: string;
};

type FinishedGoodsData = {
  goods: Good[];
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

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export function FinishedGoodsClient({ canManage, data }: { canManage: boolean; data: FinishedGoodsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newDiameter, setNewDiameter] = useState("");
  const [newDiameterUnit, setNewDiameterUnit] = useState<string>(THICKNESS_UNITS[0]);
  const [newInitialStock, setNewInitialStock] = useState("");

  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [selectedGood, setSelectedGood] = useState<Good | null>(null);
  const [productionQty, setProductionQty] = useState("");
  const [productionNotes, setProductionNotes] = useState("");

  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [dispatchQty, setDispatchQty] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [goodToDelete, setGoodToDelete] = useState<Good | null>(null);

  const units = useMemo(() => [...new Set(data.goods.map((good) => good.baseUnit))].filter(Boolean).sort(), [data.goods]);
  const filtered = useMemo(() => {
    const now = new Date();
    return data.goods.filter((good) => {
      const query = deferredSearch.trim().toLowerCase();
      const updatedAt = new Date(good.updatedAt);
      if (query && ![good.name, good.baseUnit, good.diameterValue === null ? "" : String(good.diameterValue), good.diameterUnit ?? ""].join(" ").toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && good.status !== statusFilter) return false;
      if (unitFilter !== "all" && good.baseUnit !== unitFilter) return false;
      if (updatedFilter === "7d" && updatedAt < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
      if (updatedFilter === "30d" && updatedAt < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
      return true;
    });
  }, [data.goods, deferredSearch, statusFilter, unitFilter, updatedFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / FINISHED_GOODS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedGoods = filtered.slice((currentPage - 1) * FINISHED_GOODS_PAGE_SIZE, currentPage * FINISHED_GOODS_PAGE_SIZE);
  const activeFilterCount = [Boolean(deferredSearch), statusFilter !== "all", unitFilter !== "all", updatedFilter !== "all"].filter(Boolean).length;

  const resetAddDialog = () => {
    setNewName("");
    setNewUnit("pcs");
    setNewDiameter("");
    setNewDiameterUnit(THICKNESS_UNITS[0]);
    setNewInitialStock("");
  };

  const handleAddGood = () => {
    if (!newName.trim()) return toast.error("Enter a name");
    const parsedDiameter = newDiameter.trim() === "" ? undefined : Number(newDiameter);
    if (parsedDiameter !== undefined && (!Number.isFinite(parsedDiameter) || parsedDiameter < 0)) return toast.error("Diameter must be a valid non-negative number");
    startTransition(async () => {
      try {
        const result = await addFinishedGood({ warehouseCode: data.warehouse.code, name: newName.trim(), baseUnit: newUnit, diameterValue: parsedDiameter, diameterUnit: parsedDiameter !== undefined ? newDiameterUnit : undefined, initialStock: newInitialStock ? Number(newInitialStock) : 0 });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Added ${newName.trim()}`);
        setShowAddDialog(false);
        resetAddDialog();
        router.refresh();
      } catch {
        toast.error("Failed to add finished good");
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

  const handleDispatch = () => {
    if (!selectedGood || !dispatchQty) return;
    const qty = Number(dispatchQty);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    startTransition(async () => {
      try {
        const result = await addDispatch({ warehouseCode: data.warehouse.code, finishedGoodId: selectedGood.id, quantity: qty, notes: dispatchNotes.trim() || undefined });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(`Dispatched ${qty} ${selectedGood.baseUnit} of ${selectedGood.name}`);
        setShowDispatchDialog(false);
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
        const result = await deleteFinishedGood({ warehouseCode: data.warehouse.code, finishedGoodId: goodToDelete.id });
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
          actions={<>{<Button asChild variant="outline"><Link href={`/finished-goods-history?warehouse=${data.warehouse.code}`}><History className="h-4 w-4" />Stock history</Link></Button>}{canManage ? <Button type="button" onClick={() => { resetAddDialog(); setShowAddDialog(true); }}><Plus className="h-4 w-4" />Add finished good</Button> : null}</>}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card, index) => <MetricCard key={card.label} className={index === statCards.length - 1 ? "col-span-2 md:col-span-1" : undefined} icon={card.icon} label={card.label} tone={card.tone} value={card.value} />)}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="space-y-4">
            <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">{filters}</div>
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
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No finished goods found</h3>
              <p className="mt-1 text-sm text-muted-foreground">{data.goods.length === 0 ? "Add your first finished good to get started in this warehouse." : "No results match your current filters."}</p>
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
                        <InfoPill label="Updated" value={formatDate(good.updatedAt)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {canManage ? <Button type="button" variant="outline" onClick={() => { setSelectedGood(good); setProductionQty(""); setProductionNotes(""); setShowProductionDialog(true); }}><Plus className="h-4 w-4" />Production</Button> : null}
                        {canManage ? <Button type="button" variant="outline" onClick={() => { setSelectedGood(good); setDispatchQty(""); setDispatchNotes(""); setShowDispatchDialog(true); }}><Minus className="h-4 w-4" />Dispatch</Button> : null}
                        {canManage ? <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setGoodToDelete(good); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" />Delete</Button> : null}
                        <Button asChild variant="ghost" className={!canManage ? "col-span-2" : ""}><Link href={`/finished-goods-history?warehouse=${data.warehouse.code}`}>History</Link></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <PaginationControls page={currentPage} pageCount={pageCount} itemCount={filtered.length} pageSize={FINISHED_GOODS_PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </Card>
      </motion.div>

      <Dialog open={showAddDialog && canManage} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Finished Good</DialogTitle><DialogDescription>Add a new finished good to warehouse {data.warehouse.code}.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-name">Name</label><Input id="fg-name" autoComplete="off" placeholder="e.g. PP Bags 25kg" value={newName} onChange={(event) => setNewName(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-unit">Unit</label><Select value={newUnit} onValueChange={setNewUnit}><SelectTrigger id="fg-unit"><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{MATERIAL_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-diameter">Diameter (optional)</label><Input id="fg-diameter" type="number" min="0" step="any" placeholder="e.g. 2.5" value={newDiameter} onChange={(event) => setNewDiameter(event.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-diameter-unit">Diameter unit</label><Select value={newDiameterUnit} onValueChange={setNewDiameterUnit}><SelectTrigger id="fg-diameter-unit"><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{THICKNESS_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="fg-stock">Initial stock (optional)</label><Input id="fg-stock" type="number" min="0" step="any" placeholder="0" value={newInitialStock} onChange={(event) => setNewInitialStock(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button><Button onClick={handleAddGood} disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button></DialogFooter>
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

      <Dialog open={showDispatchDialog && canManage} onOpenChange={setShowDispatchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Dispatch Stock</DialogTitle><DialogDescription>{selectedGood ? `${selectedGood.name} - currently ${formatNumber(selectedGood.currentStock)} ${selectedGood.baseUnit}` : ""}</DialogDescription></DialogHeader>
          {selectedGood ? <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="disp-qty">Quantity ({selectedGood.baseUnit})</label><Input id="disp-qty" type="number" min="0" step="any" placeholder={`Enter ${selectedGood.baseUnit}`} value={dispatchQty} onChange={(event) => setDispatchQty(event.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="disp-notes">Notes (optional)</label><Textarea id="disp-notes" placeholder="e.g. Order #5678" value={dispatchNotes} onChange={(event) => setDispatchNotes(event.target.value)} rows={2} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setShowDispatchDialog(false)}>Cancel</Button><Button onClick={handleDispatch} disabled={isPending || !dispatchQty}>{isPending ? "Dispatching..." : "Dispatch"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog && canManage} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setGoodToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete Finished Good</DialogTitle><DialogDescription>{goodToDelete ? `Are you sure you want to delete ${goodToDelete.name}? This will also remove its activity history.` : "Are you sure you want to delete this finished good?"}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteGood} disabled={isPending || !goodToDelete}>{isPending ? "Deleting..." : "Okay"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function MetricCard({ className, icon: Icon, label, tone = "default", value }: { className?: string; icon: React.ComponentType<{ className?: string }>; label: string; tone?: "default" | "emerald" | "amber" | "red" | "blue"; value: number | string }) {
  const toneClasses: Record<string, string> = { default: "bg-primary/16 text-primary", emerald: "bg-emerald-500/14 text-emerald-300", amber: "bg-amber-500/14 text-amber-300", red: "bg-red-500/14 text-red-300", blue: "bg-sky-500/14 text-sky-300" };
  return <Card className={cn("rounded-2xl sm:rounded-[24px]", className)}><CardContent className="flex min-h-[110px] items-center gap-2.5 sm:min-h-[132px] sm:gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-[16px] sm:h-12 sm:w-12 sm:rounded-2xl ${toneClasses[tone]}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">{label}</p><p className="numeric-polished mt-1.5 truncate text-xl font-semibold sm:mt-2 sm:text-2xl">{value}</p></div></CardContent></Card>;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p><p className="numeric-polished-soft mt-2 text-sm font-medium">{value}</p></div>;
}

function formatDiameter(value: number | null, unit: string | null) {
  if (value === null) return "No diameter";
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}
