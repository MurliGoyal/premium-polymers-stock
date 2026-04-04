export const APP_NAME = "Premium Polymers";
export const APP_DESCRIPTION =
  "Enterprise-grade stock and raw material management for warehouse-led operations.";
export const APP_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE || "en-IN";
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || "Asia/Kolkata";

export const COMPANY_LETTERHEAD = {
  address:
    process.env.NEXT_PUBLIC_COMPANY_ADDRESS ||
    "Industrial Estate, Gujarat, India",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@premiumpolymers.in",
  gstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN || "GSTIN: N/A",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+91 00000 00000",
  tagline:
    process.env.NEXT_PUBLIC_COMPANY_TAGLINE ||
    "Specialists in Polymer Packaging Solutions",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "www.premiumpolymers.in",
} as const;

export const WAREHOUSE_CATALOG = [
  {
    code: "E-219",
    slug: "e-219",
    name: "Warehouse E-219",
    subtitle: "Primary resin and film storage",
    gradient: "from-indigo-500/18 via-sky-500/10 to-transparent",
  },
  {
    code: "F-11",
    slug: "f-11",
    name: "Warehouse F-11",
    subtitle: "Secondary additives and packaging zone",
    gradient: "from-teal-500/16 via-cyan-500/8 to-transparent",
  },
] as const;

export const SEEDED_WAREHOUSE_CODES = WAREHOUSE_CATALOG.map((warehouse) => warehouse.code);

export const MATERIAL_UNITS = [
  "pcs",
  "kg",
  "gm",
  "litre",
  "ml",
  "meter",
  "foot",
  "inch",
  "cm",
  "mm",
  "roll",
  "sheet",
  "box",
  "packet",
  "bundle",
] as const;

export const THICKNESS_UNITS = ["mm", "cm", "inch"] as const;
export const SIZE_UNITS = ["mm", "cm", "inch", "foot"] as const;

export const TRANSFER_PAGE_SIZE = 12;
export const HISTORY_PAGE_SIZE = 12;
export const WAREHOUSE_MATERIAL_PAGE_SIZE = 10;
export const FINISHED_GOODS_PAGE_SIZE = 12;

export const FINISHED_GOODS_WAREHOUSE_CATALOG = [
  {
    code: "F-12",
    slug: "f-12",
    name: "Warehouse F-12",
    subtitle: "Primary production and dispatch staging",
    gradient: "from-amber-500/18 via-orange-500/10 to-transparent",
  },
  {
    code: "E-221",
    slug: "e-221",
    name: "Warehouse E-221",
    subtitle: "Finished rolls and reserve dispatch storage",
    gradient: "from-rose-500/18 via-pink-500/10 to-transparent",
  },
] as const;

export const FINISHED_GOODS_WAREHOUSES = FINISHED_GOODS_WAREHOUSE_CATALOG;

export const FINISHED_GOODS_WAREHOUSE_CODES = FINISHED_GOODS_WAREHOUSES.map((warehouse) => warehouse.code);
export const DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE = FINISHED_GOODS_WAREHOUSES[0].code;
export const FINISHED_GOODS_WAREHOUSE_CODE = DEFAULT_FINISHED_GOODS_WAREHOUSE_CODE;
