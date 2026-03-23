"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Minus, Package, Plus, Replace, Search, SlidersHorizontal } from "lucide-react";
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
import { formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import { adjustStock } from "./actions";

type MaterialItem = {
  id: string;
  name: string;
  warehouseId: string;
  warehouseCode: string;
  currentStock: number;
  minimumStock: number;
  baseUnit: string;
  status: string;
  category: string;
};

type WarehouseItem = {
  id: string;
  code: string;
  name: string;
  slug: string;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export function StockAdjustmentsClient({
  warehouses,
  materials,
}: {
  warehouses: WarehouseItem[];
  materials: MaterialItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"set" | "add" | "subtract">("set");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return materials.filter((m) => {
      if (warehouseFilter !== "all" && m.warehouseId !== warehouseFilter) return false;
      if (
        normalizedSearch &&
        ![m.name, m.category, m.warehouseCode, m.baseUnit].join(" ").toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [materials, warehouseFilter, deferredSearch]);

  const openAdjust = (material: MaterialItem) => {
    setSelectedMaterial(material);
    setAdjustmentType("set");
    setQuantity("");
    setReason("");
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!selectedMaterial || !quantity || !reason.trim()) return;
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    startTransition(async () => {
      try {
        const result = await adjustStock({
          rawMaterialId: selectedMaterial.id,
          warehouseId: selectedMaterial.warehouseId,
          adjustmentType,
          quantity: parsedQty,
          reason: reason.trim(),
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(
          `Stock adjusted for ${selectedMaterial.name}`,
          { description: `${adjustmentType === "set" ? "Set to" : adjustmentType === "add" ? "Added" : "Subtracted"} ${parsedQty} ${selectedMaterial.baseUnit}` }
        );
        setShowDialog(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to adjust stock");
      }
    });
  };

  const previewNewStock = useMemo(() => {
    if (!selectedMaterial || !quantity) return null;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) return null;
    switch (adjustmentType) {
      case "set": return qty;
      case "add": return selectedMaterial.currentStock + qty;
      case "subtract": return Math.max(0, selectedMaterial.currentStock - qty);
    }
  }, [selectedMaterial, quantity, adjustmentType]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Inventory management"
          title="Stock Adjustments"
          description="Manually adjust raw material stock levels. Use this for opening stock, corrections, damaged goods, or any manual inventory changes."
          badge={
            <Badge variant="secondary">
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              {filteredMaterials.length} materials
            </Badge>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, category, warehouse, or unit"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11"
                />
              </div>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="sm:w-[240px]">
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All warehouses</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        {filteredMaterials.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No materials found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a different warehouse or add materials first.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredMaterials.map((material) => (
              <Card key={material.id} className="rounded-2xl sm:rounded-[24px]">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{material.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {material.warehouseCode} · {material.category}
                      </p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(material.status)}>
                      {getStatusLabel(material.status)}
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Current stock
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {formatNumber(material.currentStock)}{" "}
                        <span className="text-sm font-normal text-muted-foreground">{material.baseUnit}</span>
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openAdjust(material)}>
                      <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                      Adjust
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min: {formatNumber(material.minimumStock)} {material.baseUnit}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedMaterial
                ? `${selectedMaterial.name} — currently ${formatNumber(selectedMaterial.currentStock)} ${selectedMaterial.baseUnit}`
                : "Select a material to adjust"}
            </DialogDescription>
          </DialogHeader>

          {selectedMaterial ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="adjustment-type">Adjustment type</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={adjustmentType === "set" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdjustmentType("set")}
                  >
                    <Replace className="mr-1 h-3.5 w-3.5" />
                    Set to
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentType === "add" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdjustmentType("add")}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentType === "subtract" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAdjustmentType("subtract")}
                  >
                    <Minus className="mr-1 h-3.5 w-3.5" />
                    Subtract
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="quantity">
                  Quantity ({selectedMaterial.baseUnit})
                </label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`Enter ${selectedMaterial.baseUnit}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {previewNewStock !== null ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    New stock after adjustment
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatNumber(previewNewStock)} {selectedMaterial.baseUnit}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reason">
                  Reason
                </label>
                <Textarea
                  id="reason"
                  placeholder="e.g. Opening stock entry, Physical count correction, Damaged goods write-off"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !quantity || !reason.trim()}
            >
              {isPending ? "Adjusting…" : "Confirm adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
