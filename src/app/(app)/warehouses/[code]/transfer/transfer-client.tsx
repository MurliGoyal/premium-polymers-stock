"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type DefaultValues, useForm, useWatch } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { AlertTriangle, ArrowRightLeft, CalendarClock, Plus } from "lucide-react";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { transferFormSchema } from "@/lib/validation";
import { createRecipient, performTransfer } from "../actions";

type Props = {
  warehouse: { id: string; code: string; name: string; slug: string };
  materials: Array<{ id: string; name: string; currentStock: number; baseUnit: string; minimumStock: number }>;
  recipients: Array<{ id: string; name: string }>;
};

type TransferFormValues = z.input<typeof transferFormSchema>;

const defaultValues = (warehouseId: string): DefaultValues<TransferFormValues> => ({
  warehouseId,
  rawMaterialId: "",
  quantity: undefined,
  recipientId: "",
  notes: "",
  referenceNumber: "",
});

export function TransferClient({ warehouse, materials, recipients: initialRecipients }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [recipients, setRecipients] = useState(initialRecipients);
  const [showRecipientDialog, setShowRecipientDialog] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: defaultValues(warehouse.id),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = form;

  const selectedMaterialId = useWatch({ control, name: "rawMaterialId" });
  const selectedQuantity = useWatch({ control, name: "quantity" });
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
        description: `${formatNumber(material.currentStock)} ${material.baseUnit} available`,
      })),
    [materials]
  );

  const recipientOptions = useMemo(
    () =>
      recipients.map((recipient) => ({
        value: recipient.id,
        label: recipient.name,
      })),
    [recipients]
  );

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await performTransfer(values);
        toast.success("Transfer completed successfully");
        router.push(`/warehouses/${warehouse.slug}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Transfer failed");
      }
    });
  });

  const handleCreateRecipient = async () => {
    if (!newRecipientName.trim()) return;

    try {
      const recipient = await createRecipient(newRecipientName.trim());
      const nextRecipients = [...recipients, { id: recipient.id, name: recipient.name }].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setRecipients(nextRecipients);
      setValue("recipientId", recipient.id, { shouldValidate: true });
      setNewRecipientName("");
      setShowRecipientDialog(false);
      toast.success("Recipient added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add recipient");
    }
  };

  const projectedBalance =
    selectedMaterial && Number.isFinite(selectedQuantity) ? selectedMaterial.currentStock - selectedQuantity : null;
  const crossesMinimum =
    selectedMaterial && projectedBalance !== null ? projectedBalance <= selectedMaterial.minimumStock : false;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/warehouses" className="transition-colors hover:text-foreground">
          Warehouses
        </Link>
        <span>/</span>
        <Link href={`/warehouses/${warehouse.slug}`} className="transition-colors hover:text-foreground">
          {warehouse.code}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Transfer</span>
      </div>

      <div className="rounded-[28px] border bg-card/95 p-6 shadow-lg shadow-slate-950/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
              Deduction workflow
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Transfer stock</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Deduct approved quantities from {warehouse.code} and create a full transfer and audit trail entry.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Warehouse</p>
            <p className="mt-1 text-base font-semibold">
              {warehouse.code} <span className="text-sm font-normal text-muted-foreground">/ {warehouse.name}</span>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
          <CardHeader>
            <CardTitle>Transfer details</CardTitle>
            <CardDescription>
              All validations are enforced on the server before stock is deducted or history is written.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Input value={`${warehouse.code} / ${warehouse.name}`} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Transfer date</Label>
                <div className="flex h-10 items-center gap-2 rounded-xl border bg-muted/30 px-3 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  {formatDateTime(new Date().toISOString())}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Raw material *</Label>
              <Controller
                control={control}
                name="rawMaterialId"
                render={({ field }) => (
                  <SearchableSelect
                    error={!!errors.rawMaterialId}
                    options={materialOptions}
                    placeholder="Select a material"
                    searchPlaceholder="Search materials..."
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">Only materials with available stock in this warehouse are shown.</p>
              {errors.rawMaterialId ? <p className="text-xs text-destructive">{errors.rawMaterialId.message}</p> : null}
            </div>

            {selectedMaterial ? (
              <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Available stock</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatNumber(selectedMaterial.currentStock)}{" "}
                    <span className="text-base font-normal text-muted-foreground">{selectedMaterial.baseUnit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Minimum stock</p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatNumber(selectedMaterial.minimumStock)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">{selectedMaterial.baseUnit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projected balance</p>
                  <p className="mt-2 text-lg font-semibold">
                    {projectedBalance !== null && Number.isFinite(projectedBalance)
                      ? `${formatNumber(projectedBalance)} ${selectedMaterial.baseUnit}`
                      : `Waiting for quantity`}
                  </p>
                  {crossesMinimum ? (
                    <Badge variant="warning" className="mt-2">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Balance reaches low stock
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to transfer *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  {...register("quantity", {
                    setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                    validate: (value) => {
                      if (!selectedMaterial || !Number.isFinite(value)) return true;
                      return value <= selectedMaterial.currentStock || "Quantity cannot exceed available stock";
                    },
                  })}
                  className={errors.quantity ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">Transfers always deduct stock from the selected warehouse material.</p>
                {errors.quantity ? <p className="text-xs text-destructive">{errors.quantity.message}</p> : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipient *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowRecipientDialog(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add recipient
                  </Button>
                </div>
                <Controller
                  control={control}
                  name="recipientId"
                  render={({ field }) => (
                    <SearchableSelect
                      error={!!errors.recipientId}
                      options={recipientOptions}
                      placeholder="Select a recipient"
                      searchPlaceholder="Search recipients..."
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">Recipients are reusable master records for departments, people, or destinations.</p>
                {errors.recipientId ? <p className="text-xs text-destructive">{errors.recipientId.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference / slip number</Label>
                <Input id="referenceNumber" placeholder="e.g. TRF-2026-041" {...register("referenceNumber")} />
                {errors.referenceNumber ? <p className="text-xs text-destructive">{errors.referenceNumber.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes / remarks</Label>
                <Textarea id="notes" rows={3} placeholder="Optional transfer remarks" {...register("notes")} />
                {errors.notes ? <p className="text-xs text-destructive">{errors.notes.message}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-20 rounded-[24px] border bg-background/92 p-4 shadow-xl shadow-slate-950/10 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" asChild>
              <Link href={`/warehouses/${warehouse.slug}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              <ArrowRightLeft className="mr-1.5 h-4 w-4" />
              {isPending ? "Processing..." : "Confirm transfer"}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={showRecipientDialog} onOpenChange={setShowRecipientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new recipient</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="recipientName">Recipient name</Label>
            <Input
              id="recipientName"
              autoFocus
              value={newRecipientName}
              onChange={(event) => setNewRecipientName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateRecipient();
                }
              }}
              placeholder="e.g. Production Floor C"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecipientDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateRecipient()} disabled={!newRecipientName.trim()}>
              Add recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
