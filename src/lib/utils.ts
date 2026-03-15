import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getStatusColor(status: string) {
  switch (status) {
    case "IN_STOCK":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800";
    case "LOW_STOCK":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800";
    case "OUT_OF_STOCK":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800";
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case "IN_STOCK": return "In Stock";
    case "LOW_STOCK": return "Low Stock";
    case "OUT_OF_STOCK": return "Out of Stock";
    default: return status;
  }
}

export function getActivityLabel(type: string) {
  const labels: Record<string, string> = {
    CREATED: "Created",
    UPDATED: "Updated",
    STOCK_ADJUSTED: "Stock Adjusted",
    TRANSFER_DEDUCTION: "Transfer Deduction",
    MINIMUM_STOCK_CHANGED: "Min. Stock Changed",
    CATEGORY_CHANGED: "Category Changed",
    UNIT_CHANGED: "Unit Changed",
    METADATA_CHANGED: "Metadata Changed",
    DELETED: "Deleted",
  };
  return labels[type] || type;
}

export function getActivityColor(type: string) {
  switch (type) {
    case "CREATED": return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400";
    case "UPDATED": return "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400";
    case "STOCK_ADJUSTED": return "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400";
    case "TRANSFER_DEDUCTION": return "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400";
    case "MINIMUM_STOCK_CHANGED": return "text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-400";
    case "DELETED": return "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400";
    default: return "text-slate-600 bg-slate-50 dark:bg-slate-950 dark:text-slate-400";
  }
}
