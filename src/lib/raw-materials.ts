import { collapseWhitespace, normalizeRecordName } from "@/lib/naming";

type RawMaterialIdentityInput = {
  name: string;
  thicknessValue?: number | null;
  thicknessUnit?: string | null;
  sizeValue?: string | null;
  sizeUnit?: string | null;
  gsm?: number | null;
  micron?: number | null;
};

export type RawMaterialFingerprintInput = RawMaterialIdentityInput & {
  baseUnit: string;
  normalizedName?: string | null;
};

function normalizeOptionalTextSegment(value?: string | null) {
  const normalized = collapseWhitespace(value ?? "").toLowerCase();
  return normalized || "na";
}

function normalizeOptionalNumberSegment(value?: number | null) {
  return value === undefined || value === null ? "na" : String(value);
}

function formatOptionalNumber(value?: number | null) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

export function buildRawMaterialNormalizedKey(material: RawMaterialIdentityInput) {
  const hasThicknessValue = material.thicknessValue !== undefined && material.thicknessValue !== null;
  const normalizedSizeValue = collapseWhitespace(material.sizeValue ?? "");
  const hasSizeValue = normalizedSizeValue.length > 0;

  return [
    normalizeRecordName(material.name),
    `gsm=${normalizeOptionalNumberSegment(material.gsm)}`,
    `micron=${normalizeOptionalNumberSegment(material.micron)}`,
    `thickness=${normalizeOptionalNumberSegment(hasThicknessValue ? material.thicknessValue : null)}`,
    `thickness-unit=${normalizeOptionalTextSegment(hasThicknessValue ? material.thicknessUnit : null)}`,
    `size=${normalizeOptionalTextSegment(hasSizeValue ? normalizedSizeValue : null)}`,
    `size-unit=${normalizeOptionalTextSegment(hasSizeValue ? material.sizeUnit : null)}`,
  ].join("::");
}

export function formatRawMaterialVariantDetails(material: Omit<RawMaterialIdentityInput, "name">) {
  const parts = [
    material.gsm !== undefined && material.gsm !== null ? `GSM ${formatOptionalNumber(material.gsm)}` : null,
    material.micron !== undefined && material.micron !== null ? `Micron ${formatOptionalNumber(material.micron)}` : null,
    material.thicknessValue !== undefined && material.thicknessValue !== null
      ? `Thickness ${formatOptionalNumber(material.thicknessValue)}${material.thicknessUnit ? ` ${material.thicknessUnit}` : ""}`
      : null,
    material.sizeValue ? `Size ${collapseWhitespace(material.sizeValue)}${material.sizeUnit ? ` ${material.sizeUnit}` : ""}` : null,
  ].filter(Boolean) as string[];

  return parts.join(" / ");
}

export function formatRawMaterialDisplayName(material: RawMaterialIdentityInput) {
  const details = formatRawMaterialVariantDetails(material);
  return details ? `${material.name} (${details})` : material.name;
}

function normalizeFingerprintSegment(value?: string | null) {
  return collapseWhitespace(value ?? "").toLowerCase();
}

function normalizeFingerprintNumber(value?: number | null) {
  return value === undefined || value === null ? "" : String(value);
}

export function buildRawMaterialFingerprint(material: RawMaterialFingerprintInput) {
  return [
    material.normalizedName ?? normalizeRecordName(material.name),
    normalizeFingerprintNumber(material.gsm),
    normalizeFingerprintSegment(material.sizeValue),
    normalizeFingerprintSegment(material.sizeUnit),
    normalizeFingerprintNumber(material.thicknessValue),
    normalizeFingerprintSegment(material.thicknessUnit),
    normalizeFingerprintNumber(material.micron),
    normalizeFingerprintSegment(material.baseUnit),
  ].join("|");
}
