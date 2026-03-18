import { getAppDateKey, getAppStartOfDay } from "@/lib/utils";

export const WAREHOUSE_HEALTH_FILTERS = ["all", "low-stock", "out-of-stock"] as const;
export const WAREHOUSE_STATUS_FILTERS = ["all", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;
export const WAREHOUSE_UPDATED_FILTERS = ["all", "7d", "30d"] as const;

export type WarehouseHealthFilter = (typeof WAREHOUSE_HEALTH_FILTERS)[number];
export type WarehouseStatusFilter = (typeof WAREHOUSE_STATUS_FILTERS)[number];
export type WarehouseUpdatedFilter = (typeof WAREHOUSE_UPDATED_FILTERS)[number];
export type TransferRangePreset = "last-7-days" | "today";

type QueryValue = string | null | undefined;

function setQueryParam(searchParams: URLSearchParams, key: string, value: QueryValue) {
  const normalized = value?.trim();

  if (!normalized || normalized === "all") {
    return;
  }

  searchParams.set(key, normalized);
}

export function buildHref(pathname: string, params: Record<string, QueryValue> = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    setQueryParam(searchParams, key, value);
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getTrimmedSearchParam(value: string | string[] | undefined) {
  return getSingleSearchParam(value)?.trim() ?? "";
}

export function getAllowedSearchParam<T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number]
) {
  const normalized = getTrimmedSearchParam(value);
  return allowed.includes(normalized as T[number]) ? (normalized as T[number]) : fallback;
}

export function getMatchingOptionValue(
  options: string[],
  value: string | string[] | undefined,
  fallback = "all"
) {
  const normalized = getTrimmedSearchParam(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return options.find((option) => option.toLowerCase() === normalized) ?? fallback;
}

export function getDateOnlySearchParam(value: string | string[] | undefined) {
  const normalized = getTrimmedSearchParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

export function getDateRangeParams(range: TransferRangePreset) {
  const to = getAppDateKey(new Date());

  if (range === "today") {
    return { from: to, to };
  }

  const fromDate = getAppStartOfDay(new Date());
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);

  return {
    from: getAppDateKey(fromDate),
    to,
  };
}

export function getWarehousesHref(health: WarehouseHealthFilter = "all") {
  return buildHref("/warehouses", { health });
}

export function getWarehouseDetailHref(
  warehouseRef: string,
  filters: {
    category?: string;
    search?: string;
    status?: WarehouseStatusFilter;
    unit?: string;
    updated?: WarehouseUpdatedFilter;
  } = {}
) {
  return buildHref(`/warehouses/${warehouseRef}`, filters);
}

export function getMaterialHistoryHref(
  filters: {
    category?: string;
    from?: string;
    material?: string;
    to?: string;
    type?: string;
    user?: string;
    warehouse?: string;
  } = {}
) {
  return buildHref("/raw-materials-history", filters);
}

export function getTransferHistoryHref(
  filters: {
    category?: string;
    from?: string;
    material?: string;
    recipient?: string;
    to?: string;
    warehouse?: string;
  } = {}
) {
  return buildHref("/transfer-history", filters);
}

export function getTransferHistoryRangeHref(
  range: TransferRangePreset,
  filters: {
    category?: string;
    material?: string;
    recipient?: string;
    warehouse?: string;
  } = {}
) {
  return getTransferHistoryHref({
    ...filters,
    ...getDateRangeParams(range),
  });
}
