"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type DefaultValues, useForm, useWatch } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { MATERIAL_UNITS, SIZE_UNITS, THICKNESS_UNITS, WEIGHT_UNITS } from "@/lib/constants";
import { rawMaterialFormSchema } from "@/lib/validation";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCategory, createRawMaterial } from "../../actions";

type Props = {
  warehouse: { id: string; code: string; name: string; slug: string };
  categories: Array<{ id: string; name: string }>;
};

type RawMaterialFormValues = z.input<typeof rawMaterialFormSchema>;

const defaultValues = (warehouseId: string): DefaultValues<RawMaterialFormValues> => ({
  warehouseId,
  name: "",
  categoryId: "",
  baseUnit: "",
  currentStock: undefined,
  minimumStock: undefined,
  thicknessValue: undefined,
  thicknessUnit: undefined,
  sizeValue: "",
  sizeUnit: undefined,
  weightValue: undefined,
  weightUnit: undefined,
  gsm: undefined,
  notes: "",
});

export function AddMaterialClient({ warehouse, categories: initialCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [submissionMode, setSubmissionMode] = useState<"save" | "saveAndAddAnother">("save");

  const form = useForm<RawMaterialFormValues>({
    resolver: zodResolver(rawMaterialFormSchema),
    defaultValues: defaultValues(warehouse.id),
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = form;

  const currentStock = useWatch({ control, name: "currentStock" });
  const minimumStock = useWatch({ control, name: "minimumStock" });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await createRawMaterial(values);
        toast.success("Raw material created successfully");

        if (submissionMode === "saveAndAddAnother") {
          reset(defaultValues(warehouse.id));
          return;
        }

        router.push(`/warehouses/${warehouse.slug}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create raw material");
      }
    });
  });

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const category = await createCategory(newCategoryName.trim());
      const nextCategories = [...categories, { id: category.id, name: category.name }].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setCategories(nextCategories);
      setValue("categoryId", category.id, { shouldValidate: true });
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("Category added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add category");
    }
  };

  const stockHealthLabel =
    Number.isFinite(currentStock) && Number.isFinite(minimumStock)
      ? currentStock <= minimumStock
        ? "Will start as low stock"
        : "Will start as in stock"
      : "Set stock values to preview status";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/warehouses" className="transition-colors hover:text-foreground">
          Warehouses
        </Link>
        <span>/</span>
        <Link href={`/warehouses/${warehouse.slug}`} className="transition-colors hover:text-foreground">
          {warehouse.code}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Add Raw Material</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Warehouse context"
        title="Add raw material"
        description="Create a warehouse-bound material record with stock controls, optional dimensions, and audit logging."
        badge={<Badge variant="secondary">{warehouse.code}</Badge>}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-[28px] border-0 bg-gradient-to-br from-white/10 to-white/[0.02] shadow-xl shadow-slate-950/5">
          <CardHeader>
            <CardTitle>Core stock definition</CardTitle>
            <CardDescription>
              Required fields are validated on both client and server. Every save creates inventory and audit entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[1.4fr,1fr]">
              <div className="space-y-2">
                <Label htmlFor="name">Raw material name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. HDPE Resin HM9450F"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">Use the vendor or specification identifier your warehouse team recognizes.</p>
                {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Category *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCategory(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add category
                  </Button>
                </div>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">Categories are shared across both warehouses and available for future materials.</p>
                {errors.categoryId ? <p className="text-xs text-destructive">{errors.categoryId.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Controller
                  control={control}
                  name="baseUnit"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className={errors.baseUnit ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select a unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">Choose the normalized unit used for all transfers and analytics.</p>
                {errors.baseUnit ? <p className="text-xs text-destructive">{errors.baseUnit.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentStock">Current stock *</Label>
                <Input
                  id="currentStock"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...register("currentStock", {
                    setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                  })}
                  className={errors.currentStock ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">Opening stock becomes the first inventory transaction for this material.</p>
                {errors.currentStock ? <p className="text-xs text-destructive">{errors.currentStock.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumStock">Minimum stock *</Label>
                <Input
                  id="minimumStock"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...register("minimumStock", {
                    setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                  })}
                  className={errors.minimumStock ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">{stockHealthLabel}</p>
                {errors.minimumStock ? <p className="text-xs text-destructive">{errors.minimumStock.message}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border bg-card/95 shadow-sm shadow-slate-950/5">
          <CardHeader>
            <CardTitle>Material specifications</CardTitle>
            <CardDescription>Optional dimensional metadata improves traceability for sheets, rolls, resins, and additives.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-5 sm:grid-cols-[1fr,180px]">
                <div className="space-y-2">
                  <Label htmlFor="thicknessValue">Thickness</Label>
                  <Input
                    id="thicknessValue"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional thickness"
                    {...register("thicknessValue", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value)),
                    })}
                  />
                  {errors.thicknessValue ? <p className="text-xs text-destructive">{errors.thicknessValue.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Thickness unit</Label>
                  <Controller
                    control={control}
                    name="thicknessUnit"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.thicknessUnit ? "border-destructive" : ""}>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {THICKNESS_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.thicknessUnit ? <p className="text-xs text-destructive">{errors.thicknessUnit.message}</p> : null}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-[1fr,180px]">
                <div className="space-y-2">
                  <Label htmlFor="sizeValue">Size</Label>
                  <Input id="sizeValue" placeholder="e.g. 1000x5000" {...register("sizeValue")} />
                  <p className="text-xs text-muted-foreground">Use a compact dimension notation such as length x width or length x width x depth.</p>
                </div>
                <div className="space-y-2">
                  <Label>Size unit</Label>
                  <Controller
                    control={control}
                    name="sizeUnit"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.sizeUnit ? "border-destructive" : ""}>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZE_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.sizeUnit ? <p className="text-xs text-destructive">{errors.sizeUnit.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr,200px,1fr]">
              <div className="space-y-2">
                <Label htmlFor="weightValue">Weight</Label>
                <Input
                  id="weightValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional weight"
                  {...register("weightValue", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
                {errors.weightValue ? <p className="text-xs text-destructive">{errors.weightValue.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Weight unit</Label>
                <Controller
                  control={control}
                  name="weightUnit"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className={errors.weightUnit ? "border-destructive" : ""}>
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEIGHT_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.weightUnit ? <p className="text-xs text-destructive">{errors.weightUnit.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gsm">GSM</Label>
                <Input
                  id="gsm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional GSM"
                  {...register("gsm", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
                <p className="text-xs text-muted-foreground">Useful for films, sheets, coated materials, and paper-like inputs.</p>
                {errors.gsm ? <p className="text-xs text-destructive">{errors.gsm.message}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / description</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Material handling notes, vendor details, internal storage guidance, or special remarks"
                {...register("notes")}
              />
              <p className="text-xs text-muted-foreground">Notes are saved into the audit trail snapshot for future transfer review.</p>
              {errors.notes ? <p className="text-xs text-destructive">{errors.notes.message}</p> : null}
            </div>
          </CardContent>
        </Card>

        <div className="safe-bottom sticky bottom-4 z-20 rounded-[28px] border border-white/10 bg-background/92 p-4 shadow-xl shadow-slate-950/10 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" asChild>
              <Link href={`/warehouses/${warehouse.slug}`}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="outline"
                disabled={isPending}
                onClick={() => setSubmissionMode("saveAndAddAnother")}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Save & add another
              </Button>
              <Button type="submit" disabled={isPending} onClick={() => setSubmissionMode("save")}>
                <Save className="mr-1.5 h-4 w-4" />
                {isPending ? "Saving..." : "Save material"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new category</DialogTitle>
            <DialogDescription>Create a reusable category and attach it to this material without leaving the form.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="newCategory">Category name</Label>
            <Input
              id="newCategory"
              autoFocus
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddCategory();
                }
              }}
              placeholder="e.g. Barrier Film"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddCategory()} disabled={!newCategoryName.trim()}>
              Add category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
