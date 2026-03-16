import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIME_ZONE,
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "short",
  timeZone: APP_TIME_ZONE,
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: APP_TIME_ZONE,
  year: "numeric",
});

const dayLabelFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "numeric",
  timeZone: APP_TIME_ZONE,
  weekday: "short",
});

const numberFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 3,
});

export function formatDate(date: Date | number | string): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | number | string): string {
  return dateTimeFormatter.format(new Date(date));
}

export function formatNumber(num: number | string): string {
  const parsed = typeof num === "string" ? Number(num) : num;

  if (!Number.isFinite(parsed)) {
    return "-";
  }

  return numberFormatter.format(parsed);
}

export function getAppDateKey(date: Date | number | string) {
  const parts = dateKeyFormatter.formatToParts(new Date(date));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "day" || part.type === "month" || part.type === "year")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatAppDayLabel(date: Date | number | string) {
  return dayLabelFormatter.format(new Date(date));
}

export function getAppStartOfDay(date: Date | number | string = new Date()) {
  const current = new Date(date);
  const parts = dateKeyFormatter.formatToParts(current);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "day" || part.type === "month" || part.type === "year")
      .map((part) => [part.type, part.value])
  );

  const approximateUtcMidnight = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 0, 0, 0, 0)
  );
  const offsetName =
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      timeZone: APP_TIME_ZONE,
      timeZoneName: "shortOffset",
    })
      .formatToParts(approximateUtcMidnight)
      .find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  const offsetMatch = offsetName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);

  if (!offsetMatch) {
    return approximateUtcMidnight;
  }

  const [, direction, hours, minutes = "0"] = offsetMatch;
  const offsetMinutes = (Number(hours) * 60 + Number(minutes)) * (direction === "-" ? -1 : 1);
  return new Date(approximateUtcMidnight.getTime() - offsetMinutes * 60_000);
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
