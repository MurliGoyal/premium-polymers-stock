import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MaterialHistoryClient } from "./material-history-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RawMaterialsHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("raw_materials_history:view");

  const [activities, warehouses, categories, materials, users] = await Promise.all([
    prisma.rawMaterialActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        rawMaterial: { select: { name: true, baseUnit: true, category: { select: { name: true } } } },
        warehouse: { select: { code: true } },
        performedBy: { select: { name: true } },
      },
    }),
    prisma.warehouse.findMany({ select: { code: true } }),
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.rawMaterial.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const resolvedSearchParams = await searchParams;
  const requestedWarehouse = Array.isArray(resolvedSearchParams.warehouse)
    ? resolvedSearchParams.warehouse[0]
    : resolvedSearchParams.warehouse;
  const initialWarehouseFilter =
    warehouses.find((warehouse) => warehouse.code.toLowerCase() === requestedWarehouse?.toLowerCase())?.code ?? "all";

  const data = activities.map((a) => ({
    id: a.id,
    materialName: a.rawMaterial.name,
    materialUnit: a.rawMaterial.baseUnit,
    category: a.rawMaterial.category.name,
    warehouseCode: a.warehouse.code,
    activityType: a.activityType,
    beforeSnapshot: a.beforeSnapshot as Record<string, unknown> | null,
    afterSnapshot: a.afterSnapshot as Record<string, unknown> | null,
    quantityChange: a.quantityChange,
    sourceType: a.sourceType,
    performedBy: a.performedBy?.name || "System",
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <MaterialHistoryClient
      activities={data}
      warehouses={warehouses.map((w) => w.code)}
      categories={categories.map((category) => category.name)}
      materials={materials.map((material) => material.name)}
      users={users.map((user) => user.name)}
      initialWarehouseFilter={initialWarehouseFilter}
    />
  );
}
