import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import {
  WAREHOUSE_STATUS_FILTERS,
  WAREHOUSE_UPDATED_FILTERS,
  getAllowedSearchParam,
  getMatchingOptionValue,
  getTrimmedSearchParam,
} from "@/lib/drilldowns";
import { getWarehouseData } from "./actions";
import { WarehouseDetailClient } from "./warehouse-detail-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WarehouseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: SearchParams;
}) {
  const user = await requirePagePermission("raw_materials:view");
  const { code } = await params;
  const data = await getWarehouseData(code);
  const resolvedSearchParams = await searchParams;

  if (!data) notFound();

  const categories = [...new Set(data.materials.map((material) => material.category))].sort();
  const units = [...new Set(data.materials.map((material) => material.baseUnit))].sort();
  const initialSearch = getTrimmedSearchParam(resolvedSearchParams.search);
  const initialStatusFilter = getAllowedSearchParam(resolvedSearchParams.status, WAREHOUSE_STATUS_FILTERS, "all");
  const initialCategoryFilter = getMatchingOptionValue(categories, resolvedSearchParams.category);
  const initialUnitFilter = getMatchingOptionValue(units, resolvedSearchParams.unit);
  const initialUpdatedFilter = getAllowedSearchParam(resolvedSearchParams.updated, WAREHOUSE_UPDATED_FILTERS, "all");
  const clientKey = [code, initialSearch, initialStatusFilter, initialCategoryFilter, initialUnitFilter, initialUpdatedFilter].join("|");

  return (
    <WarehouseDetailClient
      key={clientKey}
      data={data}
      userRole={user.role}
      initialSearch={initialSearch}
      initialStatusFilter={initialStatusFilter}
      initialCategoryFilter={initialCategoryFilter}
      initialUnitFilter={initialUnitFilter}
      initialUpdatedFilter={initialUpdatedFilter}
    />
  );
}
