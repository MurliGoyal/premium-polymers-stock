"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { APP_TIME_ZONE } from "@/lib/constants";
import { computeDurationLabel } from "@/lib/pdf-utils";

type PdfDurationPreset = "today" | "this-week" | "this-month" | "this-year" | "custom";

type ConfirmPayload = {
  fromDate: Date;
  includeAllMaterials: boolean;
  label: string;
  toDate: Date;
};

type DurationPickerDialogProps = {
  defaultIncludeAllMaterials?: boolean;
  description: string;
  isLoading?: boolean;
  onConfirm: (value: ConfirmPayload) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  showIncludeAllMaterials?: boolean;
  title: string;
};

const PRESET_LABELS: Record<Exclude<PdfDurationPreset, "custom">, string> = {
  today: "Today",
  "this-month": "This Month",
  "this-week": "This Week",
  "this-year": "This Year",
};

function getZonedNow(timeZone: string) {
  const zonedText = new Date().toLocaleString("en-US", { timeZone });
  return new Date(zonedText);
}

function resolvePresetRange(preset: Exclude<PdfDurationPreset, "custom">) {
  const now = getZonedNow(APP_TIME_ZONE);
  const fromDate = new Date(now);
  const toDate = new Date(now);
  toDate.setHours(23, 59, 59, 999);

  if (preset === "today") {
    fromDate.setHours(0, 0, 0, 0);
    return { fromDate, label: PRESET_LABELS[preset], toDate };
  }

  if (preset === "this-week") {
    const day = now.getDay();
    const diffFromMonday = day === 0 ? 6 : day - 1;
    fromDate.setDate(now.getDate() - diffFromMonday);
    fromDate.setHours(0, 0, 0, 0);
    return { fromDate, label: PRESET_LABELS[preset], toDate };
  }

  if (preset === "this-month") {
    fromDate.setDate(1);
    fromDate.setHours(0, 0, 0, 0);
    return { fromDate, label: PRESET_LABELS[preset], toDate };
  }

  fromDate.setMonth(0, 1);
  fromDate.setHours(0, 0, 0, 0);
  return { fromDate, label: PRESET_LABELS[preset], toDate };
}

function parseCustomDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function DurationPickerDialog({
  defaultIncludeAllMaterials = false,
  description,
  isLoading = false,
  onConfirm,
  onOpenChange,
  open,
  showIncludeAllMaterials = false,
  title,
}: DurationPickerDialogProps) {
  const [preset, setPreset] = useState<PdfDurationPreset>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [includeAllMaterials, setIncludeAllMaterials] = useState(defaultIncludeAllMaterials);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setPreset("today");
    setFromDate("");
    setToDate("");
    setIncludeAllMaterials(defaultIncludeAllMaterials);
    setError(null);
  };

  const previewLabel = useMemo(() => {
    if (preset !== "custom") {
      return PRESET_LABELS[preset];
    }

    const previewFromDate = parseCustomDate(fromDate);
    const previewToDate = parseCustomDate(toDate, true);

    if (!previewFromDate || !previewToDate || previewFromDate > previewToDate) {
      return "Custom range";
    }

    return computeDurationLabel(previewFromDate, previewToDate);
  }, [fromDate, preset, toDate]);

  const handleConfirm = async () => {
    setError(null);

    if (preset === "custom") {
      const parsedFromDate = parseCustomDate(fromDate);
      const parsedToDate = parseCustomDate(toDate, true);

      if (!parsedFromDate || !parsedToDate) {
        setError("Select both from and to dates.");
        return;
      }

      if (parsedFromDate > parsedToDate) {
        setError("From date must be before to date.");
        return;
      }

      await onConfirm({
        fromDate: parsedFromDate,
        includeAllMaterials,
        label: computeDurationLabel(parsedFromDate, parsedToDate),
        toDate: parsedToDate,
      });
      return;
    }

    const { fromDate: resolvedFromDate, label, toDate: resolvedToDate } = resolvePresetRange(preset);

    await onConfirm({
      fromDate: resolvedFromDate,
      includeAllMaterials,
      label,
      toDate: resolvedToDate,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetState();
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Duration</p>
            <Select value={preset} onValueChange={(value) => setPreset(value as PdfDurationPreset)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">From</p>
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">To</p>
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </div>
            </div>
          ) : null}

          {showIncludeAllMaterials ? (
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground/90">
              <input
                checked={includeAllMaterials}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-primary accent-primary"
                type="checkbox"
                onChange={(event) => setIncludeAllMaterials(event.target.checked)}
              />
              <span>Include all materials regardless of period.</span>
            </label>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-muted-foreground">
            Period preview: {previewLabel}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <p className="text-xs text-muted-foreground">Date calculations use timezone {APP_TIME_ZONE}.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isLoading} onClick={() => void handleConfirm()}>
            {isLoading ? "Generating..." : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}