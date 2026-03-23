import { MaterialStatus } from "@prisma/client";
import type { QuantityValue } from "@/lib/quantities";
import { quantityToString, toDecimal } from "@/lib/quantities";

type MaterialSnapshotInput = {
  id: string;
  name: string;
  warehouse: { code: string; name: string };
  category: { id: string; name: string };
  baseUnit: string;
  currentStock: QuantityValue;
  minimumStock: QuantityValue;
  thicknessValue?: number | null;
  thicknessUnit?: string | null;
  sizeValue?: string | null;
  sizeUnit?: string | null;
  gsm?: number | null;
  notes?: string | null;
  status: MaterialStatus;
};

export function resolveMaterialStatus(currentStock: QuantityValue, minimumStock: QuantityValue): MaterialStatus {
  const current = toDecimal(currentStock);
  const minimum = toDecimal(minimumStock);

  if (current.lte(0)) {
    return MaterialStatus.OUT_OF_STOCK;
  }

  if (current.lte(minimum)) {
    return MaterialStatus.LOW_STOCK;
  }

  return MaterialStatus.IN_STOCK;
}

export function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function daysAgo(days: number, from = new Date()) {
  const result = new Date(from);
  result.setDate(result.getDate() - days);
  return result;
}

export function createMaterialSnapshot(material: MaterialSnapshotInput) {
  return {
    id: material.id,
    name: material.name,
    warehouse: material.warehouse,
    category: material.category,
    baseUnit: material.baseUnit,
    currentStock: quantityToString(material.currentStock),
    minimumStock: quantityToString(material.minimumStock),
    thicknessValue: material.thicknessValue ?? null,
    thicknessUnit: material.thicknessUnit ?? null,
    sizeValue: material.sizeValue ?? null,
    sizeUnit: material.sizeUnit ?? null,
    gsm: material.gsm ?? null,
    notes: material.notes ?? null,
    status: material.status,
  };
}
