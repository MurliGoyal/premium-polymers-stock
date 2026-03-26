"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type DefaultValues, useForm, useWatch } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ChevronDown, Plus, RotateCcw, Save, X } from "lucide-react";
import { MATERIAL_UNITS, SIZE_UNITS, THICKNESS_UNITS } from "@/lib/constants";
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
  vendorNames: string[];
};

type RawMaterialFormValues = z.input<typeof rawMaterialFormSchema>;

const defaultValues = (warehouseId: string): DefaultValues<RawMaterialFormValues> => ({
  warehouseId,
  name: "",
  categoryId: "",
  vendorName: "",
  baseUnit: "",
  currentStock: undefined,
  minimumStock: undefined,
  thicknessValue: undefined,
  thicknessUnit: undefined,
  sizeValue: "",
  sizeUnit: undefined,
  gsm: undefined,
  micron: undefined,
  notes: "",
});

export function AddMaterialClient({ warehouse, categories: initialCategories, vendorNames }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [rollWeightKg, setRollWeightKg] = useState("");
  const [rollGsm, setRollGsm] = useState("");
  const [rollWidthValue, setRollWidthValue] = useState("");
  const [rollWidthUnit, setRollWidthUnit] = useState<(typeof SIZE_UNITS)[number]>("mm");
  const [isRollCalculatorOpenMobile, setIsRollCalculatorOpenMobile] = useState(false);

  const form = useForm<RawMaterialFormValues>({
    resolver: zodResolver(rawMaterialFormSchema),
    defaultValues: defaultValues(warehouse.id),
    mode: "onChange",
    reValidateMode: "onChange",
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
  const vendorName = useWatch({ control, name: "vendorName" });
  const knownVendorNames = useMemo(
    () => [...new Set(vendorNames.map((name) => name.trim()).filter(Boolean))],
    [vendorNames]
  );
  const filteredVendorNames = useMemo(() => {
    const normalizedQuery = (vendorName ?? "").trim().toLowerCase();

    if (!normalizedQuery) {
      return knownVendorNames.slice(0, 8);
    }

    return knownVendorNames
      .filter((name) => name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [knownVendorNames, vendorName]);

  const onSubmit = handleSubmit((values, event) => {
    const submitter =
      event && "nativeEvent" in event
        ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)
        : null;
    const mode = submitter?.value === "saveAndAddAnother" ? "saveAndAddAnother" : "save";

    startTransition(async () => {
      try {
        await createRawMaterial(values);
        toast.success("Raw material created successfully");

        if (mode === "saveAndAddAnother") {
          reset(defaultValues(warehouse.id));
          setRollWeightKg("");
          setRollGsm("");
          setRollWidthValue("");
          setRollWidthUnit("mm");
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
      const result = await createCategory(newCategoryName.trim());
      const alreadyPresent = categories.some((category) => category.id === result.entity.id);
      const nextCategories = alreadyPresent
        ? categories
        : [...categories, { id: result.entity.id, name: result.entity.name }].sort((a, b) => a.name.localeCompare(b.name));

      setCategories(nextCategories);
      setValue("categoryId", result.entity.id, { shouldValidate: true });
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success(result.created ? "Category added" : "Category already existed and was selected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add category");
    }
  };

  const stockHealthLabel =
    Number.isFinite(currentStock) && Number.isFinite(minimumStock)
      ? currentStock <= 0
        ? "Will start as out of stock"
        : currentStock <= minimumStock
        ? "Will start as low stock"
        : "Will start as in stock"
      : "Set stock values to preview status";

  const rollLengthMeters = useMemo(() => {
    const weightKg = Number(rollWeightKg);
    const gsm = Number(rollGsm);
    const widthValue = Number(rollWidthValue);

    if (!Number.isFinite(weightKg) || !Number.isFinite(gsm) || !Number.isFinite(widthValue)) {
      return null;
    }

    if (weightKg === 0 || gsm === 0 || widthValue === 0) {
      return null;
    }

    const widthInMeters = convertWidthToMeters(Math.abs(widthValue), rollWidthUnit);

    if (!Number.isFinite(widthInMeters) || widthInMeters === 0) {
      return null;
    }

    const calculatedLength = Math.abs((Math.abs(weightKg) * 1000) / (Math.abs(gsm) * widthInMeters));
    return calculatedLength.toFixed(2);
  }, [rollGsm, rollWeightKg, rollWidthUnit, rollWidthValue]);

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
        description="Add a new material record to this warehouse, including optional thickness and material specs."
        badge={<Badge variant="secondary">{warehouse.code}</Badge>}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-2xl border-0 bg-gradient-to-br from-white/10 to-white/[0.02] shadow-xl shadow-slate-950/5 sm:rounded-[28px]">
          <CardHeader>
            <CardTitle>Core stock definition</CardTitle>
            <CardDescription>
              Enter the main stock fields first. Required fields are validated on both client and server, and every save creates inventory and audit entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[1.4fr,1fr]">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Raw material name <span aria-hidden="true">*</span>
                  <span className="sr-only">required</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. HDPE Resin HM9450F"
                  {...register("name")}
                  required
                  aria-required="true"
                  className={errors.name ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">Use the vendor or specification identifier your warehouse team recognizes.</p>
                {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Category <span aria-hidden="true">*</span>
                    <span className="sr-only">required</span>
                  </Label>
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
                      <SelectTrigger
                        aria-required="true"
                        className={errors.categoryId ? "border-destructive" : ""}
                      >
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

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  Unit <span aria-hidden="true">*</span>
                  <span className="sr-only">required</span>
                </Label>
                <Controller
                  control={control}
                  name="baseUnit"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger
                        aria-required="true"
                        className={errors.baseUnit ? "border-destructive" : ""}
                      >
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
                <p className="text-xs text-muted-foreground">Optional GSM for film, sheet, paper, and coated material tracking.</p>
                {errors.gsm ? <p className="text-xs text-destructive">{errors.gsm.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="micron">Micron</Label>
                <Input
                  id="micron"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional Micron"
                  {...register("micron", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
                <p className="text-xs text-muted-foreground">Optional micron value when your warehouse tracks material grade that way.</p>
                {errors.micron ? <p className="text-xs text-destructive">{errors.micron.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="thicknessValue">Thickness</Label>
                <div className="grid grid-cols-[1fr,110px] gap-2">
                  <Input
                    id="thicknessValue"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    {...register("thicknessValue", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value)),
                    })}
                  />
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
                </div>
                <p className="text-xs text-muted-foreground">Optional thickness for films, laminates, and sheet materials.</p>
                {errors.thicknessValue ? <p className="text-xs text-destructive">{errors.thicknessValue.message}</p> : null}
                {errors.thicknessUnit ? <p className="text-xs text-destructive">{errors.thicknessUnit.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentStock">
                  Total stock <span aria-hidden="true">*</span>
                  <span className="sr-only">required</span>
                </Label>
                <Input
                  id="currentStock"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...register("currentStock", {
                    setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                  })}
                  required
                  aria-required="true"
                  className={errors.currentStock ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">Total available stock at creation time.</p>
                {errors.currentStock ? <p className="text-xs text-destructive">{errors.currentStock.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumStock">
                  Minimum stock <span aria-hidden="true">*</span>
                  <span className="sr-only">required</span>
                </Label>
                <Input
                  id="minimumStock"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...register("minimumStock", {
                    setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                  })}
                  required
                  aria-required="true"
                  className={errors.minimumStock ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">{stockHealthLabel}</p>
                {errors.minimumStock ? <p className="text-xs text-destructive">{errors.minimumStock.message}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card/95 shadow-sm shadow-slate-950/5 sm:rounded-[28px]">
          <CardHeader>
            <CardTitle>Material specifications</CardTitle>
            <CardDescription>Capture roll size, vendor details, and additional notes for stronger traceability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-5 sm:grid-cols-[1fr,180px]">
                <div className="space-y-2">
                  <Label htmlFor="sizeValue">Roll size / Roll width</Label>
                  <Input id="sizeValue" placeholder="e.g. 1000x5000" {...register("sizeValue")} />
                  <p className="text-xs text-muted-foreground">Use format like width x length or the shop-floor notation you already use.</p>
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

              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor name</Label>
                <Input
                  id="vendorName"
                  placeholder="Search, select, or type vendor name"
                  {...register("vendorName")}
                />
                {filteredVendorNames.length > 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {filteredVendorNames.map((knownVendorName) => (
                        <Button
                          key={knownVendorName}
                          type="button"
                          variant={knownVendorName === vendorName ? "secondary" : "outline"}
                          size="sm"
                          onClick={() =>
                            setValue("vendorName", knownVendorName, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          {knownVendorName}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Known vendor names are reusable. Type a new one if it is not listed.</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No saved vendor matches yet. Type a new vendor name and it will be available next time.</p>
                )}
                {errors.vendorName ? <p className="text-xs text-destructive">{errors.vendorName.message}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Material handling notes, internal storage guidance, or special remarks"
                {...register("notes")}
              />
              <p className="text-xs text-muted-foreground">Notes are optional and saved to the audit trail snapshot.</p>
              {errors.notes ? <p className="text-xs text-destructive">{errors.notes.message}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card/95 shadow-sm shadow-slate-950/5 sm:rounded-[28px]">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Roll calculator</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsRollCalculatorOpenMobile((current) => !current)}
                aria-expanded={isRollCalculatorOpenMobile}
                aria-controls="roll-calculator-content"
              >
                {isRollCalculatorOpenMobile ? "Hide" : "Show"}
                <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isRollCalculatorOpenMobile ? "rotate-180" : ""}`} />
              </Button>
            </div>
            <CardDescription>
              Estimate roll length in meters from product weight, GSM, and width. The result uses the absolute value and is rounded to 2 decimal places.
            </CardDescription>
          </CardHeader>
          <CardContent
            id="roll-calculator-content"
            className={`${isRollCalculatorOpenMobile ? "block" : "hidden"} space-y-5 md:block`}
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr,1fr,1fr,180px]">
              <div className="space-y-2">
                <Label htmlFor="rollWeightKg">Product weight (kg)</Label>
                <Input
                  id="rollWeightKg"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 12.50"
                  value={rollWeightKg}
                  onChange={(event) => setRollWeightKg(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter the total roll weight in kilograms.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollGsm">Product GSM</Label>
                <Input
                  id="rollGsm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 25"
                  value={rollGsm}
                  onChange={(event) => setRollGsm(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Use GSM in grams per square meter.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rollWidthValue">Size / Roll Size / Roll Width</Label>
                <Input
                  id="rollWidthValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter width"
                  value={rollWidthValue}
                  onChange={(event) => setRollWidthValue(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter the roll width using the selected unit.</p>
              </div>

              <div className="space-y-2">
                <Label>Size / Roll Size / Roll Width unit</Label>
                <Select value={rollWidthUnit} onValueChange={(value) => setRollWidthUnit(value as (typeof SIZE_UNITS)[number])}>
                  <SelectTrigger>
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
                <p className="text-xs text-muted-foreground">Width is converted to meters before calculating roll length.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:rounded-[24px] sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Roll length</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                {rollLengthMeters ? `${rollLengthMeters} m` : "--"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Formula: roll length = abs((weight in kg × 1000) / (gsm × width in meters)).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="safe-bottom sticky bottom-4 z-20 rounded-2xl border border-white/10 bg-background/92 p-3.5 shadow-xl shadow-slate-950/10 backdrop-blur sm:rounded-[28px] sm:p-4">
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
                name="submissionMode"
                value="saveAndAddAnother"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Save & add another
              </Button>
              <Button type="submit" disabled={isPending} name="submissionMode" value="save">
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

function convertWidthToMeters(value: number, unit: (typeof SIZE_UNITS)[number]) {
  switch (unit) {
    case "mm":
      return value / 1000;
    case "cm":
      return value / 100;
    case "inch":
      return value * 0.0254;
    case "foot":
      return value * 0.3048;
    default:
      return value;
  }
}
