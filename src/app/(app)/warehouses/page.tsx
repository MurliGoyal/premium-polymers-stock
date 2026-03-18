import { MaterialStatus } from "@prisma/client";
import { requirePagePermission } from "@/lib/auth";
import { SEEDED_WAREHOUSE_CODES, WAREHOUSE_CATALOG } from "@/lib/constants";
import { WAREHOUSE_HEALTH_FILTERS, getAllowedSearchParam } from "@/lib/drilldowns";
import { daysAgo } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { quantityToNumber, sumQuantities } from "@/lib/quantities";
import { WarehousesClient } from "./warehouses-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getWarehouseSortIndex(code: string) {
  return SEEDED_WAREHOUSE_CODES.indexOf(code as (typeof SEEDED_WAREHOUSE_CODES)[number]);
}

export default async function WarehousesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("warehouses:view");
  const resolvedSearchParams = await searchParams;
  const initialHealthFilter = getAllowedSearchParam(resolvedSearchParams.health, WAREHOUSE_HEALTH_FILTERS, "all");

  const sevenDaysAgo = daysAgo(6);
  const warehouses = await prisma.warehouse.findMany({
    where: { code: { in: SEEDED_WAREHOUSE_CODES } },
    include: {
      rawMaterials: { select: { id: true, status: true, currentStock: true, baseUnit: true } },
      transfers: {
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { id: true, quantity: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const data = warehouses
    .sort((left, right) => getWarehouseSortIndex(left.code) - getWarehouseSortIndex(right.code))
    .map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      slug: w.slug,
      subtitle: WAREHOUSE_CATALOG.find((warehouse) => warehouse.code === w.code)?.subtitle ?? "",
      gradient: WAREHOUSE_CATALOG.find((warehouse) => warehouse.code === w.code)?.gradient ?? "",
      totalMaterials: w.rawMaterials.length,
      inStockCount: w.rawMaterials.filter((m) => m.status === MaterialStatus.IN_STOCK).length,
      lowStockCount: w.rawMaterials.filter((m) => m.status === MaterialStatus.LOW_STOCK).length,
      outOfStockCount: w.rawMaterials.filter((m) => m.status === MaterialStatus.OUT_OF_STOCK).length,
      totalStock: quantityToNumber(sumQuantities(w.rawMaterials.map((material) => material.currentStock))),
      recentTransfers: w.transfers.length,
      totalTransferQty: quantityToNumber(sumQuantities(w.transfers.map((transfer) => transfer.quantity))),
    }));

  return <WarehousesClient key={initialHealthFilter} warehouses={data} initialHealthFilter={initialHealthFilter} />;
}
