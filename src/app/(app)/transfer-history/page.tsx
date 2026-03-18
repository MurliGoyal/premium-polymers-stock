import { requirePagePermission } from "@/lib/auth";
import { getDateOnlySearchParam, getMatchingOptionValue } from "@/lib/drilldowns";
import { prisma } from "@/lib/prisma";
import { quantityToNumber } from "@/lib/quantities";
import { TransferHistoryClient } from "./transfer-history-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TransferHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("transfer_history:view");

  const [transfers, warehouses, recipients, categories, materials] = await Promise.all([
    prisma.transfer.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        warehouse: { select: { code: true } },
        rawMaterial: { select: { name: true, baseUnit: true, category: { select: { name: true } } } },
        recipient: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.warehouse.findMany({ select: { code: true } }),
    prisma.recipient.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.rawMaterial.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const resolvedSearchParams = await searchParams;
  const requestedWarehouse = Array.isArray(resolvedSearchParams.warehouse)
    ? resolvedSearchParams.warehouse[0]
    : resolvedSearchParams.warehouse;
  const initialWarehouseFilter =
    warehouses.find((warehouse) => warehouse.code.toLowerCase() === requestedWarehouse?.toLowerCase())?.code ?? "all";
  const initialMaterialFilter = getMatchingOptionValue(
    materials.map((material) => material.name),
    resolvedSearchParams.material
  );
  const initialRecipientFilter = getMatchingOptionValue(
    recipients.map((recipient) => recipient.name),
    resolvedSearchParams.recipient
  );
  const initialCategoryFilter = getMatchingOptionValue(
    categories.map((category) => category.name),
    resolvedSearchParams.category
  );
  const initialFromDate = getDateOnlySearchParam(resolvedSearchParams.from);
  const initialToDate = getDateOnlySearchParam(resolvedSearchParams.to);
  const clientKey = [
    initialWarehouseFilter,
    initialMaterialFilter,
    initialRecipientFilter,
    initialCategoryFilter,
    initialFromDate,
    initialToDate,
  ].join("|");

  const data = transfers.map((t) => ({
    id: t.id,
    warehouseCode: t.warehouse.code,
    materialName: t.rawMaterial.name,
    category: t.rawMaterial.category.name,
    quantity: quantityToNumber(t.quantity),
    unit: t.rawMaterial.baseUnit,
    recipientName: t.recipient.name,
    referenceNumber: t.referenceNumber,
    notes: t.notes,
    createdBy: t.createdBy?.name || "System",
    createdAt: t.createdAt.toISOString(),
    materialSnapshot: (t.materialSnapshot as Record<string, unknown> | null) ?? null,
  }));

  return (
    <TransferHistoryClient
      key={clientKey}
      transfers={data}
      warehouses={warehouses.map((w) => w.code)}
      recipients={recipients.map((r) => r.name)}
      categories={categories.map((category) => category.name)}
      materials={materials.map((material) => material.name)}
      initialWarehouseFilter={initialWarehouseFilter}
      initialMaterialFilter={initialMaterialFilter}
      initialRecipientFilter={initialRecipientFilter}
      initialCategoryFilter={initialCategoryFilter}
      initialFromDate={initialFromDate}
      initialToDate={initialToDate}
    />
  );
}
