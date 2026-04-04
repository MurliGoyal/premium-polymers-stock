import { requirePagePermission } from "@/lib/auth";
import {
  WAREHOUSE_STATUS_FILTERS,
  getAllowedSearchParam,
  getMatchingOptionValue,
  getTrimmedSearchParam,
} from "@/lib/drilldowns";
import { getTotalRawMaterialsData } from "./actions";
import { TotalMaterialsClient } from "./total-materials-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TOTAL_SORT_OPTIONS = [
  "name-asc",
  "name-desc",
  "stock-desc",
  "stock-asc",
  "category-asc",
  "updated-desc",
  "updated-asc",
] as const;

const TOTAL_PAGE_SIZE_OPTIONS = ["10", "20", "50"] as const;

export default async function TotalRawMaterialsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("raw_materials:view");

  const data = await getTotalRawMaterialsData();
  const resolvedSearchParams = await searchParams;

  const categories = [...new Set(data.materials.map((material) => material.category))].sort();
  const warehouseCodes = [
    ...new Set(data.materials.flatMap((material) => material.sourceWarehouses.map((source) => source.warehouseCode))),
  ].sort();
  const units = [...new Set(data.materials.map((material) => material.baseUnit))].sort();

  const initialSearch = getTrimmedSearchParam(resolvedSearchParams.search);
  const initialCategoryFilter = getMatchingOptionValue(categories, resolvedSearchParams.category);
  const initialWarehouseFilter = getMatchingOptionValue(warehouseCodes, resolvedSearchParams.warehouse);
  const initialStatusFilter = getAllowedSearchParam(resolvedSearchParams.status, WAREHOUSE_STATUS_FILTERS, "all");
  const initialUnitFilter = getMatchingOptionValue(units, resolvedSearchParams.unit);
  const initialSort = getAllowedSearchParam(resolvedSearchParams.sort, TOTAL_SORT_OPTIONS, "name-asc");
  const initialGsmMin = getTrimmedSearchParam(resolvedSearchParams.gsmMin);
  const initialGsmMax = getTrimmedSearchParam(resolvedSearchParams.gsmMax);
  const initialSizeMin = getTrimmedSearchParam(resolvedSearchParams.sizeMin);
  const initialSizeMax = getTrimmedSearchParam(resolvedSearchParams.sizeMax);
  const initialPageSize = Number(
    getAllowedSearchParam(resolvedSearchParams.pageSize, TOTAL_PAGE_SIZE_OPTIONS, "20")
  );

  const clientKey = [
    initialSearch,
    initialCategoryFilter,
    initialWarehouseFilter,
    initialStatusFilter,
    initialUnitFilter,
    initialSort,
    initialGsmMin,
    initialGsmMax,
    initialSizeMin,
    initialSizeMax,
    initialPageSize,
  ].join("|");

  return (
    <TotalMaterialsClient
      key={clientKey}
      categories={categories}
      initialCategoryFilter={initialCategoryFilter}
      initialGsmMax={initialGsmMax}
      initialGsmMin={initialGsmMin}
      initialPageSize={initialPageSize}
      initialSearch={initialSearch}
      initialSizeMax={initialSizeMax}
      initialSizeMin={initialSizeMin}
      initialSort={initialSort}
      initialStatusFilter={initialStatusFilter}
      initialUnitFilter={initialUnitFilter}
      initialWarehouseFilter={initialWarehouseFilter}
      materials={data.materials}
      units={units}
      warehouseCodes={warehouseCodes}
    />
  );
}