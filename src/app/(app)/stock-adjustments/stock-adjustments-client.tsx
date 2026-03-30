"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRightLeft, Minus, Package, Pencil, Plus, Replace, Search, SlidersHorizontal } from "lucide-react";
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
import { SIZE_UNITS, THICKNESS_UNITS } from "@/lib/constants";
import { buildRawMaterialNormalizedKey } from "@/lib/raw-materials";
import { formatNumber, getStatusColor, getStatusLabel } from "@/lib/utils";
import { performTransfer } from "../warehouses/[code]/actions";
import { adjustStock, updateRawMaterialSpecifications } from "./actions";

type MaterialItem = {
  id: string;
  name: string;
  warehouseId: string;
  warehouseCode: string;
  currentStock: number;
  minimumStock: number;
  baseUnit: string;
  thicknessValue: number | null;
  thicknessUnit: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  gsm: number | null;
  micron: number | null;
  notes: string | null;
  status: string;
  category: string;
};

type WarehouseItem = {
  id: string;
  code: string;
  name: string;
  slug: string;
};

type AggregatedMaterialItem = {
  id: string;
  normalizedKey: string;
  name: string;
  category: string;
  baseUnit: string;
  currentStock: number;
  minimumStock: number;
  status: string;
  warehouseCodes: string[];
  members: MaterialItem[];
};

type BulkTransferRow = {
  id: string;
  materialKey: string;
  warehouseId: string;
  quantity: string;
};

let bulkRowSequence = 0;

function createBulkTransferRow(): BulkTransferRow {
  bulkRowSequence += 1;
  return {
    id: `bulk-row-${bulkRowSequence}`,
    materialKey: "",
    warehouseId: "",
    quantity: "",
  };
}

function buildBulkBatchReference() {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `BULK-${timestamp}`;
}

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
  recipients,
  materials,
  canManage,
  canEditMaterials,
  canTransfer,
}: {
  warehouses: WarehouseItem[];
  recipients: Array<{ id: string; name: string }>;
  materials: MaterialItem[];
  canManage: boolean;
  canEditMaterials: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [selectedMaterial, setSelectedMaterial] = useState<AggregatedMaterialItem | null>(null);
  const [selectedWarehouseForAdjust, setSelectedWarehouseForAdjust] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"set" | "add" | "subtract">("set");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<AggregatedMaterialItem | null>(null);
  const [selectedWarehouseForEdit, setSelectedWarehouseForEdit] = useState("");
  const [editThicknessValue, setEditThicknessValue] = useState("");
  const [editThicknessUnit, setEditThicknessUnit] = useState("none");
  const [editSizeValue, setEditSizeValue] = useState("");
  const [editSizeUnit, setEditSizeUnit] = useState("none");
  const [editGsm, setEditGsm] = useState("");
  const [editMicron, setEditMicron] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferMaterial, setTransferMaterial] = useState<AggregatedMaterialItem | null>(null);
  const [selectedWarehouseForTransfer, setSelectedWarehouseForTransfer] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferRecipientId, setTransferRecipientId] = useState("");
  const [transferReferenceNumber, setTransferReferenceNumber] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [showBulkTransferDialog, setShowBulkTransferDialog] = useState(false);
  const [bulkTransferRows, setBulkTransferRows] = useState<BulkTransferRow[]>([createBulkTransferRow()]);
  const [bulkTransferRecipientId, setBulkTransferRecipientId] = useState("");
  const [bulkTransferReferenceNumber, setBulkTransferReferenceNumber] = useState("");
  const [bulkTransferNotes, setBulkTransferNotes] = useState("");

  const aggregatedMaterials = useMemo<AggregatedMaterialItem[]>(() => {
    const grouped = new Map<string, MaterialItem[]>();

    for (const material of materials) {
      const key = buildRawMaterialNormalizedKey({
        name: material.name,
        thicknessValue: material.thicknessValue,
        thicknessUnit: material.thicknessUnit,
        sizeValue: material.sizeValue,
        sizeUnit: material.sizeUnit,
        gsm: material.gsm,
        micron: material.micron,
      });
      const existing = grouped.get(key);
      if (existing) {
        existing.push(material);
      } else {
        grouped.set(key, [material]);
      }
    }

    return Array.from(grouped.entries())
      .map(([normalizedKey, members]) => {
        const first = members[0];
        const totalStock = members.reduce((sum, item) => sum + item.currentStock, 0);
        const totalMinimum = members.reduce((sum, item) => sum + item.minimumStock, 0);
        const status = totalStock <= 0 ? "OUT_OF_STOCK" : totalStock <= totalMinimum ? "LOW_STOCK" : "IN_STOCK";

        return {
          id: normalizedKey,
          normalizedKey,
          name: first.name,
          category:
            new Set(members.map((item) => item.category)).size === 1
              ? first.category
              : "Mixed categories",
          baseUnit: first.baseUnit,
          currentStock: totalStock,
          minimumStock: totalMinimum,
          status,
          warehouseCodes: [...new Set(members.map((item) => item.warehouseCode))],
          members,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return aggregatedMaterials.filter((m) => {
      if (warehouseFilter !== "all" && !m.members.some((member) => member.warehouseId === warehouseFilter)) return false;
      if (
        normalizedSearch &&
        ![m.name, m.category, m.baseUnit, ...m.warehouseCodes].join(" ").toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [aggregatedMaterials, warehouseFilter, deferredSearch]);

  const selectedAdjustMember = useMemo(
    () => selectedMaterial?.members.find((member) => member.warehouseId === selectedWarehouseForAdjust) ?? null,
    [selectedMaterial, selectedWarehouseForAdjust]
  );

  const selectedEditMember = useMemo(
    () => editingMaterial?.members.find((member) => member.warehouseId === selectedWarehouseForEdit) ?? null,
    [editingMaterial, selectedWarehouseForEdit]
  );

  const selectedTransferMember = useMemo(
    () => transferMaterial?.members.find((member) => member.warehouseId === selectedWarehouseForTransfer) ?? null,
    [transferMaterial, selectedWarehouseForTransfer]
  );

  const aggregatedMaterialsByKey = useMemo(
    () => new Map(aggregatedMaterials.map((material) => [material.normalizedKey, material])),
    [aggregatedMaterials]
  );

  const openAdjust = (material: AggregatedMaterialItem) => {
    setSelectedMaterial(material);
    setSelectedWarehouseForAdjust(material.members.length === 1 ? material.members[0].warehouseId : "");
    setAdjustmentType("set");
    setQuantity("");
    setReason("");
    setShowDialog(true);
  };

  const openEditSpecifications = (material: AggregatedMaterialItem) => {
    const defaultMember = material.members.length === 1 ? material.members[0] : null;
    setEditingMaterial(material);
    setSelectedWarehouseForEdit(defaultMember?.warehouseId ?? "");
    setEditThicknessValue(defaultMember?.thicknessValue !== null && defaultMember?.thicknessValue !== undefined ? String(defaultMember.thicknessValue) : "");
    setEditThicknessUnit(defaultMember?.thicknessUnit ?? "none");
    setEditSizeValue(defaultMember?.sizeValue ?? "");
    setEditSizeUnit(defaultMember?.sizeUnit ?? "none");
    setEditGsm(defaultMember?.gsm !== null && defaultMember?.gsm !== undefined ? String(defaultMember.gsm) : "");
    setEditMicron(defaultMember?.micron !== null && defaultMember?.micron !== undefined ? String(defaultMember.micron) : "");
    setEditNotes(defaultMember?.notes ?? "");
    setShowEditDialog(true);
  };

  const handleEditWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseForEdit(warehouseId);
    const member = editingMaterial?.members.find((item) => item.warehouseId === warehouseId);
    if (!member) {
      return;
    }

    setEditThicknessValue(member.thicknessValue !== null ? String(member.thicknessValue) : "");
    setEditThicknessUnit(member.thicknessUnit ?? "none");
    setEditSizeValue(member.sizeValue ?? "");
    setEditSizeUnit(member.sizeUnit ?? "none");
    setEditGsm(member.gsm !== null ? String(member.gsm) : "");
    setEditMicron(member.micron !== null ? String(member.micron) : "");
    setEditNotes(member.notes ?? "");
  };

  const openTransfer = (material: AggregatedMaterialItem) => {
    setTransferMaterial(material);
    setSelectedWarehouseForTransfer(material.members.length === 1 ? material.members[0].warehouseId : "");
    setTransferQuantity("");
    setTransferRecipientId("");
    setTransferReferenceNumber("");
    setTransferNotes("");
    setShowTransferDialog(true);
  };

  const openBulkTransfer = () => {
    setBulkTransferRows([createBulkTransferRow()]);
    setBulkTransferRecipientId("");
    setBulkTransferReferenceNumber(buildBulkBatchReference());
    setBulkTransferNotes("");
    setShowBulkTransferDialog(true);
  };

  const updateBulkTransferRow = (rowId: string, updates: Partial<BulkTransferRow>) => {
    setBulkTransferRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextRow = { ...row, ...updates };

        if (updates.materialKey !== undefined) {
          const material = aggregatedMaterialsByKey.get(updates.materialKey);
          if (!material) {
            return { ...nextRow, warehouseId: "" };
          }

          if (material.members.length === 1) {
            return { ...nextRow, warehouseId: material.members[0].warehouseId };
          }

          return { ...nextRow, warehouseId: "" };
        }

        return nextRow;
      })
    );
  };

  const removeBulkTransferRow = (rowId: string) => {
    setBulkTransferRows((rows) => {
      if (rows.length === 1) {
        return rows;
      }
      return rows.filter((row) => row.id !== rowId);
    });
  };

  const addBulkTransferRow = () => {
    setBulkTransferRows((rows) => [...rows, createBulkTransferRow()]);
  };

  const handleSubmit = () => {
    if (!selectedMaterial || !selectedAdjustMember || !quantity) return;
    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    startTransition(async () => {
      try {
        const result = await adjustStock({
          rawMaterialId: selectedAdjustMember.id,
          warehouseId: selectedAdjustMember.warehouseId,
          adjustmentType,
          quantity: parsedQty,
          reason: reason.trim() || undefined,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(
          `Stock adjusted for ${selectedMaterial.name}`,
          {
            description: `${adjustmentType === "set" ? "Set to" : adjustmentType === "add" ? "Added" : "Subtracted"} ${parsedQty} ${selectedAdjustMember.baseUnit} in ${selectedAdjustMember.warehouseCode}`,
          }
        );
        setShowDialog(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to adjust stock");
      }
    });
  };

  const previewNewStock = useMemo(() => {
    if (!selectedAdjustMember || !quantity) return null;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) return null;
    switch (adjustmentType) {
      case "set": return qty;
      case "add": return selectedAdjustMember.currentStock + qty;
      case "subtract": return Math.max(0, selectedAdjustMember.currentStock - qty);
    }
  }, [selectedAdjustMember, quantity, adjustmentType]);

  const handleSaveSpecifications = () => {
    if (!selectedEditMember) return;

    const trimmedThicknessValue = editThicknessValue.trim();
    const parsedThicknessValue = trimmedThicknessValue === "" ? undefined : Number(trimmedThicknessValue);
    if (parsedThicknessValue !== undefined && (!Number.isFinite(parsedThicknessValue) || parsedThicknessValue < 0)) {
      toast.error("Thickness must be a valid non-negative number");
      return;
    }

    const trimmedGsm = editGsm.trim();
    const parsedGsm = trimmedGsm === "" ? undefined : Number(trimmedGsm);
    if (parsedGsm !== undefined && (!Number.isFinite(parsedGsm) || parsedGsm < 0)) {
      toast.error("GSM must be a valid non-negative number");
      return;
    }

    const trimmedMicron = editMicron.trim();
    const parsedMicron = trimmedMicron === "" ? undefined : Number(trimmedMicron);
    if (parsedMicron !== undefined && (!Number.isFinite(parsedMicron) || parsedMicron < 0)) {
      toast.error("Micron must be a valid non-negative number");
      return;
    }

    const normalizedSizeValue = editSizeValue.trim();

    if (parsedThicknessValue !== undefined && editThicknessUnit === "none") {
      toast.error("Select a thickness unit");
      return;
    }

    if (normalizedSizeValue && editSizeUnit === "none") {
      toast.error("Select a size unit");
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRawMaterialSpecifications({
          rawMaterialId: selectedEditMember.id,
          warehouseId: selectedEditMember.warehouseId,
          thicknessValue: parsedThicknessValue,
          thicknessUnit: editThicknessUnit === "none" ? undefined : editThicknessUnit,
          sizeValue: normalizedSizeValue || undefined,
          sizeUnit: editSizeUnit === "none" ? undefined : editSizeUnit,
          gsm: parsedGsm,
          micron: parsedMicron,
          notes: editNotes.trim() || undefined,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(`Updated specifications for ${selectedEditMember.name} in ${selectedEditMember.warehouseCode}`);
        setShowEditDialog(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update specifications");
      }
    });
  };

  const transferProjectedBalance = useMemo(() => {
    if (!selectedTransferMember || !transferQuantity) {
      return null;
    }

    const quantity = Number(transferQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    return Math.max(0, selectedTransferMember.currentStock - quantity);
  }, [selectedTransferMember, transferQuantity]);

  const handleTransferSubmit = () => {
    if (!selectedTransferMember) {
      toast.error("Select a source warehouse");
      return;
    }

    if (!transferRecipientId) {
      toast.error("Select a recipient");
      return;
    }

    const quantity = Number(transferQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid transfer quantity");
      return;
    }

    if (quantity > selectedTransferMember.currentStock) {
      toast.error(
        `Cannot transfer ${formatNumber(quantity)} ${selectedTransferMember.baseUnit}. Only ${formatNumber(selectedTransferMember.currentStock)} ${selectedTransferMember.baseUnit} available in ${selectedTransferMember.warehouseCode}.`
      );
      return;
    }

    startTransition(async () => {
      try {
        const result = await performTransfer({
          warehouseId: selectedTransferMember.warehouseId,
          rawMaterialId: selectedTransferMember.id,
          quantity,
          recipientId: transferRecipientId,
          referenceNumber: transferReferenceNumber.trim() || undefined,
          notes: transferNotes.trim() || undefined,
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        toast.success(
          `Transferred ${formatNumber(quantity)} ${selectedTransferMember.baseUnit} from ${selectedTransferMember.warehouseCode}`
        );
        setShowTransferDialog(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Transfer failed");
      }
    });
  };

  const handleBulkTransferSubmit = () => {
    if (!bulkTransferRecipientId) {
      toast.error("Select a recipient");
      return;
    }

    const preparedRows: Array<{ rowId: string; member: MaterialItem; quantity: number }> = [];

    for (const row of bulkTransferRows) {
      const aggregate = aggregatedMaterialsByKey.get(row.materialKey);
      if (!aggregate) {
        toast.error("Select a raw material for every row");
        return;
      }

      const member = aggregate.members.find((item) => item.warehouseId === row.warehouseId);
      if (!member) {
        toast.error(`Select source warehouse for ${aggregate.name}`);
        return;
      }

      const quantity = Number(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error(`Enter a valid quantity for ${aggregate.name} (${member.warehouseCode})`);
        return;
      }

      preparedRows.push({ rowId: row.id, member, quantity });
    }

    if (preparedRows.length === 0) {
      toast.error("Add at least one material row");
      return;
    }

    const consolidated = new Map<string, { member: MaterialItem; quantity: number }>();
    for (const row of preparedRows) {
      const existing = consolidated.get(row.member.id);
      if (existing) {
        existing.quantity += row.quantity;
      } else {
        consolidated.set(row.member.id, { member: row.member, quantity: row.quantity });
      }
    }

    const consolidatedEntries = Array.from(consolidated.values());
    for (const entry of consolidatedEntries) {
      if (entry.quantity > entry.member.currentStock) {
        toast.error(
          `Cannot transfer ${formatNumber(entry.quantity)} ${entry.member.baseUnit} from ${entry.member.warehouseCode}. Only ${formatNumber(entry.member.currentStock)} ${entry.member.baseUnit} is available.`
        );
        return;
      }
    }

    const batchReference = bulkTransferReferenceNumber.trim() || buildBulkBatchReference();
    const extraNotes = bulkTransferNotes.trim();

    startTransition(async () => {
      let completed = 0;

      try {
        for (let index = 0; index < consolidatedEntries.length; index += 1) {
          const entry = consolidatedEntries[index];
          const notesPrefix = `Bulk transfer batch ${batchReference} | Item ${index + 1}/${consolidatedEntries.length}`;
          const result = await performTransfer({
            warehouseId: entry.member.warehouseId,
            rawMaterialId: entry.member.id,
            quantity: entry.quantity,
            recipientId: bulkTransferRecipientId,
            referenceNumber: batchReference,
            notes: extraNotes ? `${notesPrefix} | ${extraNotes}` : notesPrefix,
          });

          if (!result.ok) {
            throw new Error(result.message);
          }

          completed += 1;
        }

        toast.success(`Bulk transfer completed (${completed} item${completed > 1 ? "s" : ""})`, {
          description: `Batch reference: ${batchReference}`,
        });
        setShowBulkTransferDialog(false);
        router.refresh();
      } catch (error) {
        toast.error(
          completed > 0
            ? `Bulk transfer stopped after ${completed}/${consolidatedEntries.length} items. ${error instanceof Error ? error.message : "Please review and retry."}`
            : error instanceof Error
              ? error.message
              : "Bulk transfer failed"
        );
        router.refresh();
      }
    });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Inventory management"
          title="Stock Adjustments"
          description={
            canManage
              ? "Manually adjust raw material stock levels. Use this for opening stock, corrections, damaged goods, or any manual inventory changes."
              : "Read-only stock overview. You can review stock levels and filters, but adjustments are disabled for your role."
          }
          badge={
            <Badge variant="secondary">
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              {filteredMaterials.length} materials
            </Badge>
          }
          actions={
            canTransfer ? (
              <Button type="button" variant="outline" onClick={openBulkTransfer}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                Bulk transfer
              </Button>
            ) : null
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
                        {material.warehouseCodes.join(", ")} · {material.category}
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
                      <p className="numeric-polished mt-1 text-2xl font-semibold">
                        {formatNumber(material.currentStock)}{" "}
                        <span className="text-sm font-normal text-muted-foreground">{material.baseUnit}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => canManage && openAdjust(material)} disabled={!canManage}>
                        <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                        {canManage ? "Adjust" : "View"}
                      </Button>
                      {canTransfer ? (
                        <Button size="sm" variant="outline" onClick={() => openTransfer(material)}>
                          <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                          Transfer
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => canEditMaterials && openEditSpecifications(material)}
                        disabled={!canEditMaterials}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min: <span className="numeric-polished-soft">{formatNumber(material.minimumStock)}</span> {material.baseUnit}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={showDialog && canManage} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedMaterial
                ? `${selectedMaterial.name} — total ${formatNumber(selectedMaterial.currentStock)} ${selectedMaterial.baseUnit} across ${selectedMaterial.warehouseCodes.length} warehouse${selectedMaterial.warehouseCodes.length > 1 ? "s" : ""}`
                : "Select a material to adjust"}
            </DialogDescription>
          </DialogHeader>

          {selectedMaterial ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="adjust-warehouse">
                  Warehouse <span aria-hidden="true">*</span>
                </label>
                <Select value={selectedWarehouseForAdjust} onValueChange={setSelectedWarehouseForAdjust}>
                  <SelectTrigger id="adjust-warehouse">
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedMaterial.members.map((member) => (
                      <SelectItem key={member.id} value={member.warehouseId}>
                        {member.warehouseCode} - {formatNumber(member.currentStock)} {member.baseUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  Quantity ({selectedAdjustMember?.baseUnit ?? selectedMaterial.baseUnit})
                </label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`Enter ${selectedAdjustMember?.baseUnit ?? selectedMaterial.baseUnit}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {previewNewStock !== null ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    New stock after adjustment{selectedAdjustMember ? ` (${selectedAdjustMember.warehouseCode})` : ""}
                  </p>
                  <p className="numeric-polished mt-1 text-xl font-semibold">
                    {formatNumber(previewNewStock)} {selectedAdjustMember?.baseUnit ?? selectedMaterial.baseUnit}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reason">
                  Reason (optional)
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
              disabled={isPending || !quantity || !selectedAdjustMember}
            >
              {isPending ? "Adjusting…" : "Confirm adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog && canEditMaterials} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Raw Material Specs</DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? `${editingMaterial.name} — choose warehouse and update thickness, size, GSM, micron, and notes.`
                : "Select a material to edit"}
            </DialogDescription>
          </DialogHeader>

          {editingMaterial ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-warehouse">
                  Warehouse <span aria-hidden="true">*</span>
                </label>
                <Select value={selectedWarehouseForEdit} onValueChange={handleEditWarehouseChange}>
                  <SelectTrigger id="edit-warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {editingMaterial.members.map((member) => (
                      <SelectItem key={member.id} value={member.warehouseId}>
                        {member.warehouseCode} - {formatNumber(member.currentStock)} {member.baseUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,150px]">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="edit-thickness-value">
                    Thickness
                  </label>
                  <Input
                    id="edit-thickness-value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional thickness"
                    value={editThicknessValue}
                    onChange={(event) => setEditThicknessValue(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="edit-thickness-unit">
                    Thickness unit
                  </label>
                  <Select value={editThicknessUnit} onValueChange={setEditThicknessUnit}>
                    <SelectTrigger id="edit-thickness-unit">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No unit</SelectItem>
                      {THICKNESS_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,150px]">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="edit-size-value">
                    Size
                  </label>
                  <Input
                    id="edit-size-value"
                    placeholder="e.g. 1000x5000"
                    value={editSizeValue}
                    onChange={(event) => setEditSizeValue(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="edit-size-unit">
                    Size unit
                  </label>
                  <Select value={editSizeUnit} onValueChange={setEditSizeUnit}>
                    <SelectTrigger id="edit-size-unit">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No unit</SelectItem>
                      {SIZE_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-gsm">
                  GSM
                </label>
                <Input
                  id="edit-gsm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional GSM"
                  value={editGsm}
                  onChange={(event) => setEditGsm(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-micron">
                  Micron
                </label>
                <Input
                  id="edit-micron"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional Micron"
                  value={editMicron}
                  onChange={(event) => setEditMicron(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-notes">
                  Notes
                </label>
                <Textarea
                  id="edit-notes"
                  placeholder="Optional notes"
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSpecifications} disabled={isPending || !selectedEditMember}>
              {isPending ? "Saving…" : "Save specifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog && canTransfer} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Raw Material</DialogTitle>
            <DialogDescription>
              {transferMaterial
                ? `${transferMaterial.name} — choose warehouse and transfer quantity.`
                : "Select a material to transfer"}
            </DialogDescription>
          </DialogHeader>

          {transferMaterial ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transfer-warehouse">
                  Source warehouse <span aria-hidden="true">*</span>
                </label>
                <Select value={selectedWarehouseForTransfer} onValueChange={setSelectedWarehouseForTransfer}>
                  <SelectTrigger id="transfer-warehouse">
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferMaterial.members.map((member) => (
                      <SelectItem key={member.id} value={member.warehouseId}>
                        {member.warehouseCode} - {formatNumber(member.currentStock)} {member.baseUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transfer-quantity">
                  Quantity ({selectedTransferMember?.baseUnit ?? transferMaterial.baseUnit}) <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="transfer-quantity"
                  type="number"
                  min="0.01"
                  step="any"
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  placeholder="Enter transfer quantity"
                />
                {selectedTransferMember ? (
                  <p className="text-xs text-muted-foreground">
                    Available in {selectedTransferMember.warehouseCode}: {formatNumber(selectedTransferMember.currentStock)} {selectedTransferMember.baseUnit}
                  </p>
                ) : null}
              </div>

              {transferProjectedBalance !== null && selectedTransferMember ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Projected balance ({selectedTransferMember.warehouseCode})
                  </p>
                  <p className="numeric-polished mt-1 text-xl font-semibold">
                    {formatNumber(transferProjectedBalance)} {selectedTransferMember.baseUnit}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transfer-recipient">
                  Recipient <span aria-hidden="true">*</span>
                </label>
                <Select value={transferRecipientId} onValueChange={setTransferRecipientId}>
                  <SelectTrigger id="transfer-recipient">
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transfer-reference">
                  Reference number (optional)
                </label>
                <Input
                  id="transfer-reference"
                  value={transferReferenceNumber}
                  onChange={(event) => setTransferReferenceNumber(event.target.value)}
                  placeholder="e.g. TRF-2026-041"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="transfer-notes">
                  Notes (optional)
                </label>
                <Textarea
                  id="transfer-notes"
                  value={transferNotes}
                  onChange={(event) => setTransferNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional transfer remarks"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowTransferDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleTransferSubmit}
              disabled={isPending || !selectedTransferMember || !transferRecipientId || !transferQuantity}
            >
              {isPending ? "Processing..." : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkTransferDialog && canTransfer} onOpenChange={setShowBulkTransferDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Transfer Raw Materials</DialogTitle>
            <DialogDescription>
              Select multiple raw materials with quantities, use one recipient, and transfer in a single batch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bulk-transfer-recipient">
                  Recipient <span aria-hidden="true">*</span>
                </label>
                <Select value={bulkTransferRecipientId} onValueChange={setBulkTransferRecipientId}>
                  <SelectTrigger id="bulk-transfer-recipient">
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="bulk-transfer-reference">
                  Batch reference
                </label>
                <Input
                  id="bulk-transfer-reference"
                  value={bulkTransferReferenceNumber}
                  onChange={(event) => setBulkTransferReferenceNumber(event.target.value)}
                  placeholder="BULK-YYYYMMDDHHMM"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="bulk-transfer-notes">
                Batch notes (optional)
              </label>
              <Textarea
                id="bulk-transfer-notes"
                value={bulkTransferNotes}
                onChange={(event) => setBulkTransferNotes(event.target.value)}
                rows={2}
                placeholder="These notes will be attached to every transfer item in this batch"
              />
            </div>

            <div className="space-y-3">
              {bulkTransferRows.map((row, index) => {
                const selectedAggregate = aggregatedMaterialsByKey.get(row.materialKey);
                const selectedMember = selectedAggregate?.members.find((member) => member.warehouseId === row.warehouseId) ?? null;

                return (
                  <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">Item {index + 1}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={bulkTransferRows.length === 1}
                        onClick={() => removeBulkTransferRow(row.id)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Raw material</label>
                        <Select
                          value={row.materialKey}
                          onValueChange={(value) => updateBulkTransferRow(row.id, { materialKey: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {aggregatedMaterials.map((material) => (
                              <SelectItem key={material.normalizedKey} value={material.normalizedKey}>
                                {material.name} ({material.warehouseCodes.join(", ")})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quantity</label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={row.quantity}
                          onChange={(event) => updateBulkTransferRow(row.id, { quantity: event.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Source warehouse</label>
                        <Select
                          value={row.warehouseId}
                          onValueChange={(value) => updateBulkTransferRow(row.id, { warehouseId: value })}
                          disabled={!selectedAggregate}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={selectedAggregate ? "Select source warehouse" : "Select material first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {(selectedAggregate?.members ?? []).map((member) => (
                              <SelectItem key={member.id} value={member.warehouseId}>
                                {member.warehouseCode} - {formatNumber(member.currentStock)} {member.baseUnit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        {selectedMember ? (
                          <p className="text-xs text-muted-foreground">
                            Available: {formatNumber(selectedMember.currentStock)} {selectedMember.baseUnit}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Choose warehouse to view availability</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" onClick={addBulkTransferRow}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add material row
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowBulkTransferDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkTransferSubmit}
              disabled={isPending || !bulkTransferRecipientId}
            >
              {isPending ? "Processing..." : "Confirm bulk transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
