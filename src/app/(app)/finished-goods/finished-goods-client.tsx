"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MATERIAL_UNITS, THICKNESS_UNITS } from "@/lib/constants";
import { formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import { addDispatch, addFinishedGood, addProduction, deleteFinishedGood } from "./actions";

type FinishedGoodItem = {
  id: string;
  name: string;
  warehouseCode: string;
  baseUnit: string;
  diameterValue: number | null;
  diameterUnit: string | null;
  currentStock: number;
  status: string;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function FinishedGoodsClient({
  goods,
  warehouseCode,
  canManage,
}: {
  goods: FinishedGoodItem[];
  warehouseCode: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  // Add new finished good dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");
  const [newDiameter, setNewDiameter] = useState("");
  const [newDiameterUnit, setNewDiameterUnit] = useState<string>(THICKNESS_UNITS[0]);
  const [newInitialStock, setNewInitialStock] = useState("");

  // Production dialog
  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [selectedGood, setSelectedGood] = useState<FinishedGoodItem | null>(null);
  const [productionQty, setProductionQty] = useState("");
  const [productionNotes, setProductionNotes] = useState("");

  // Dispatch dialog
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [dispatchQty, setDispatchQty] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [goodToDelete, setGoodToDelete] = useState<FinishedGoodItem | null>(null);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return goods;
    return goods.filter((g) => g.name.toLowerCase().includes(q) || g.baseUnit.toLowerCase().includes(q));
  }, [goods, deferredSearch]);

  const openProduction = (good: FinishedGoodItem) => {
    setSelectedGood(good);
    setProductionQty("");
    setProductionNotes("");
    setShowProductionDialog(true);
  };

  const openDispatch = (good: FinishedGoodItem) => {
    setSelectedGood(good);
    setDispatchQty("");
    setDispatchNotes("");
    setShowDispatchDialog(true);
  };

  const handleAddGood = () => {
    if (!newName.trim()) { toast.error("Enter a name"); return; }
    const parsedDiameter = newDiameter.trim() === "" ? undefined : Number(newDiameter);
    if (parsedDiameter !== undefined && (!Number.isFinite(parsedDiameter) || parsedDiameter < 0)) {
      toast.error("Diameter must be a valid non-negative number");
      return;
    }
    startTransition(async () => {
      try {
        const result = await addFinishedGood({
          name: newName.trim(),
          baseUnit: newUnit,
          diameterValue: parsedDiameter,
          diameterUnit: parsedDiameter !== undefined ? newDiameterUnit : undefined,
          initialStock: newInitialStock ? Number(newInitialStock) : 0,
        });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success(`Added ${newName.trim()}`);
        setShowAddDialog(false);
        setNewName("");
        setNewDiameter("");
        setNewDiameterUnit(THICKNESS_UNITS[0]);
        setNewInitialStock("");
        router.refresh();
      } catch { toast.error("Failed to add finished good"); }
    });
  };

  const openDeleteDialog = (good: FinishedGoodItem) => {
    setGoodToDelete(good);
    setShowDeleteDialog(true);
  };

  const handleDeleteGood = () => {
    if (!goodToDelete) return;
    startTransition(async () => {
      try {
        const result = await deleteFinishedGood({ finishedGoodId: goodToDelete.id });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success(`Deleted ${goodToDelete.name}`);
        setShowDeleteDialog(false);
        setGoodToDelete(null);
        router.refresh();
      } catch {
        toast.error("Failed to delete finished good");
      }
    });
  };

  const handleProduction = () => {
    if (!selectedGood || !productionQty) return;
    const qty = Number(productionQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    startTransition(async () => {
      try {
        const result = await addProduction({
          finishedGoodId: selectedGood.id,
          quantity: qty,
          notes: productionNotes.trim() || undefined,
        });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success(`Added ${qty} ${selectedGood.baseUnit} to ${selectedGood.name}`);
        setShowProductionDialog(false);
        router.refresh();
      } catch { toast.error("Failed to add production"); }
    });
  };

  const handleDispatch = () => {
    if (!selectedGood || !dispatchQty) return;
    const qty = Number(dispatchQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    startTransition(async () => {
      try {
        const result = await addDispatch({
          finishedGoodId: selectedGood.id,
          quantity: qty,
          notes: dispatchNotes.trim() || undefined,
        });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success(`Dispatched ${qty} ${selectedGood.baseUnit} of ${selectedGood.name}`);
        setShowDispatchDialog(false);
        router.refresh();
      } catch { toast.error("Failed to dispatch"); }
    });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow={`Warehouse ${warehouseCode}`}
          title="Finished Goods"
          description={
            canManage
              ? "Manage finished goods inventory. Add production stock or dispatch goods."
              : "Read-only view of finished goods inventory."
          }
          badge={<Badge variant="secondary"><Package className="mr-1 h-3 w-3" />{filtered.length} items</Badge>}
          actions={
            canManage ? (
              <Button onClick={() => { setNewName(""); setNewUnit("pcs"); setNewDiameter(""); setNewDiameterUnit(THICKNESS_UNITS[0]); setNewInitialStock(""); setShowAddDialog(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Add Finished Good
              </Button>
            ) : undefined
          }
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or unit"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        {filtered.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No finished goods found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {goods.length === 0 ? "Add your first finished good to get started." : "No results match your search."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((good) => (
              <Card key={good.id} className="rounded-2xl sm:rounded-[24px]">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{good.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{good.warehouseCode}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={getStatusColor(good.status)}>
                        {getStatusLabel(good.status)}
                      </Badge>
                      {canManage ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteDialog(good)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          aria-label={`Delete ${good.name}`}
                          title={`Delete ${good.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
                    <div className="min-w-[120px]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current stock</p>
                      <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
                        {formatNumber(good.currentStock)}{" "}
                        <span className="text-sm font-normal text-muted-foreground">{good.baseUnit}</span>
                      </p>
                    </div>
                    <div className="min-w-[120px]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Diameter</p>
                      <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
                        {good.diameterValue !== null ? formatNumber(good.diameterValue) : "-"}
                        <span className="text-sm font-normal text-muted-foreground">
                          {good.diameterValue !== null ? (good.diameterUnit ?? "") : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => openProduction(good)} className="flex-1">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Production
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDispatch(good)} className="flex-1">
                        <Minus className="mr-1 h-3.5 w-3.5" /> Dispatch
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add Finished Good Dialog */}
      <Dialog open={showAddDialog && canManage} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Finished Good</DialogTitle>
            <DialogDescription>Add a new finished good to warehouse {warehouseCode}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fg-name">Name</label>
              <Input
                id="fg-name"
                name="fg_name"
                autoComplete="off"
                placeholder="e.g. PP Bags 25kg"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fg-unit">Unit</label>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger id="fg-unit"><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fg-diameter">Diameter (optional)</label>
                <Input
                  id="fg-diameter"
                  name="fg_diameter"
                  autoComplete="off"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 2.5"
                  value={newDiameter}
                  onChange={(e) => setNewDiameter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fg-diameter-unit">Diameter unit</label>
                <Select value={newDiameterUnit} onValueChange={setNewDiameterUnit}>
                  <SelectTrigger id="fg-diameter-unit"><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    {THICKNESS_UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fg-stock">Initial stock (optional)</label>
              <Input
                id="fg-stock"
                name="fg_stock"
                autoComplete="off"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={newInitialStock}
                onChange={(e) => setNewInitialStock(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddGood} disabled={isPending}>{isPending ? "Adding…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Dialog */}
      <Dialog open={showProductionDialog && canManage} onOpenChange={setShowProductionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Production</DialogTitle>
            <DialogDescription>
              {selectedGood ? `${selectedGood.name} — currently ${formatNumber(selectedGood.currentStock)} ${selectedGood.baseUnit}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedGood ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="prod-qty">Quantity ({selectedGood.baseUnit})</label>
                <Input id="prod-qty" type="number" min="0" step="any" placeholder={`Enter ${selectedGood.baseUnit}`} value={productionQty} onChange={(e) => setProductionQty(e.target.value)} />
              </div>
              {productionQty && Number.isFinite(Number(productionQty)) && Number(productionQty) > 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">New stock after production</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-300">{formatNumber(selectedGood.currentStock + Number(productionQty))} {selectedGood.baseUnit}</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="prod-notes">Notes (optional)</label>
                <Textarea id="prod-notes" placeholder="e.g. Batch #1234" value={productionNotes} onChange={(e) => setProductionNotes(e.target.value)} rows={2} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductionDialog(false)}>Cancel</Button>
            <Button onClick={handleProduction} disabled={isPending || !productionQty}>{isPending ? "Adding…" : "Add Production"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch Dialog */}
      <Dialog open={showDispatchDialog && canManage} onOpenChange={setShowDispatchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Stock</DialogTitle>
            <DialogDescription>
              {selectedGood ? `${selectedGood.name} — currently ${formatNumber(selectedGood.currentStock)} ${selectedGood.baseUnit}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedGood ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="disp-qty">Quantity ({selectedGood.baseUnit})</label>
                <Input id="disp-qty" type="number" min="0" step="any" placeholder={`Enter ${selectedGood.baseUnit}`} value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} />
              </div>
              {dispatchQty && Number.isFinite(Number(dispatchQty)) && Number(dispatchQty) > 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Stock after dispatch</p>
                  <p className={`mt-1 text-xl font-semibold ${selectedGood.currentStock - Number(dispatchQty) < 0 ? "text-red-400" : "text-amber-300"}`}>
                    {formatNumber(Math.max(0, selectedGood.currentStock - Number(dispatchQty)))} {selectedGood.baseUnit}
                  </p>
                  {Number(dispatchQty) > selectedGood.currentStock ? (
                    <p className="mt-1 text-xs text-red-400">Exceeds available stock</p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="disp-notes">Notes (optional)</label>
                <Textarea id="disp-notes" placeholder="e.g. Order #5678, Truck ABC-1234" value={dispatchNotes} onChange={(e) => setDispatchNotes(e.target.value)} rows={2} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispatchDialog(false)}>Cancel</Button>
            <Button onClick={handleDispatch} disabled={isPending || !dispatchQty}>{isPending ? "Dispatching…" : "Dispatch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={showDeleteDialog && canManage}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setGoodToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Finished Good</DialogTitle>
            <DialogDescription>
              {goodToDelete
                ? `Are you sure you want to delete ${goodToDelete.name}? This will also remove its activity history.`
                : "Are you sure you want to delete this finished good?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGood} disabled={isPending || !goodToDelete}>
              {isPending ? "Deleting..." : "Okay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
