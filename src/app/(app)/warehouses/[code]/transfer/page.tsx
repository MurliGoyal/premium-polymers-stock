import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransferClient } from "./transfer-client";

export default async function TransferPage({ params }: { params: Promise<{ code: string }> }) {
  await requirePagePermission("transfers:create");
  const { code } = await params;
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      OR: [{ slug: code }, { code: { equals: code, mode: "insensitive" } }],
    },
  });
  if (!warehouse) notFound();

  const [materials, recipients] = await Promise.all([
    prisma.rawMaterial.findMany({
      where: { warehouseId: warehouse.id, currentStock: { gt: 0 } },
      select: { id: true, name: true, currentStock: true, baseUnit: true, minimumStock: true },
      orderBy: { name: "asc" },
    }),
    prisma.recipient.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <TransferClient
      warehouse={{ id: warehouse.id, code: warehouse.code, name: warehouse.name, slug: warehouse.slug }}
      materials={materials}
      recipients={recipients.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}
