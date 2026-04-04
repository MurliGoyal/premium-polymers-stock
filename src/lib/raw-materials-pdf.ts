export type RawMaterialPdfSource = {
  currentStock: number;
  updatedAt: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseSlug?: string;
};

export type RawMaterialPdfMaterial = {
  baseUnit: string;
  category: string;
  currentStock: number;
  displayName: string;
  gsm: number | null;
  id: string;
  micron: number | null;
  name: string;
  sizeUnit: string | null;
  sizeValue: string | null;
  sourceWarehouses: RawMaterialPdfSource[];
  thicknessUnit: string | null;
  thicknessValue: number | null;
  updatedAt: string;
  vendorName: string | null;
};

export type RawMaterialPdfCategory = {
  categoryName: string;
  materials: RawMaterialPdfMaterial[];
};

export type BuildRawMaterialsPdfCategoriesOptions = {
  fromDate: Date;
  includeAllMaterials?: boolean;
  toDate: Date;
  warehouseCode?: string | null;
};

function normalizePdfText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isWithinRange(value: Date, fromDate: Date, toDate: Date) {
  return value.getTime() >= fromDate.getTime() && value.getTime() <= toDate.getTime();
}

export function formatRawMaterialPdfSizeText(
  material: Pick<RawMaterialPdfMaterial, "micron" | "sizeUnit" | "sizeValue" | "thicknessUnit" | "thicknessValue">,
) {
  const sizeValue = normalizePdfText(material.sizeValue);

  if (sizeValue) {
    return material.sizeUnit ? `${sizeValue} ${material.sizeUnit}` : sizeValue;
  }

  if (material.thicknessValue !== null && material.thicknessValue !== undefined) {
    return material.thicknessUnit ? `${material.thicknessValue} ${material.thicknessUnit}` : String(material.thicknessValue);
  }

  if (material.micron !== null && material.micron !== undefined) {
    return `${material.micron} micron`;
  }

  return "—";
}

export function buildRawMaterialsPdfCategories(
  materials: RawMaterialPdfMaterial[],
  options: BuildRawMaterialsPdfCategoriesOptions,
): RawMaterialPdfCategory[] {
  const groupedByCategory = new Map<string, RawMaterialPdfMaterial[]>();

  for (const material of materials) {
    if (
      options.warehouseCode &&
      !material.sourceWarehouses.some((source) => source.warehouseCode === options.warehouseCode)
    ) {
      continue;
    }

    if (!options.includeAllMaterials) {
      const updatedAt = new Date(material.updatedAt);
      if (Number.isNaN(updatedAt.getTime()) || !isWithinRange(updatedAt, options.fromDate, options.toDate)) {
        continue;
      }
    }

    const categoryMaterials = groupedByCategory.get(material.category) ?? [];
    categoryMaterials.push({
      ...material,
      sourceWarehouses: [...material.sourceWarehouses].sort((left, right) =>
        left.warehouseCode.localeCompare(right.warehouseCode),
      ),
    });
    groupedByCategory.set(material.category, categoryMaterials);
  }

  return Array.from(groupedByCategory.entries())
    .sort(([leftCategory], [rightCategory]) => leftCategory.localeCompare(rightCategory))
    .map(([categoryName, categoryMaterials]) => ({
      categoryName,
      materials: categoryMaterials.sort((left, right) =>
        left.displayName.localeCompare(right.displayName) || left.name.localeCompare(right.name),
      ),
    }));
}