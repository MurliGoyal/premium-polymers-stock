import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quantityToNumber } from "@/lib/quantities";
import { formatRawMaterialDisplayName } from "@/lib/raw-materials";
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
      select: {
        id: true,
        name: true,
        currentStock: true,
        baseUnit: true,
        minimumStock: true,
        thicknessValue: true,
        thicknessUnit: true,
        sizeValue: true,
        sizeUnit: true,
        gsm: true,
        micron: true,
      },
      orderBy: [{ name: "asc" }, { gsm: "asc" }, { micron: "asc" }, { sizeValue: "asc" }],
    }),
    prisma.recipient.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <TransferClient
      warehouse={{ id: warehouse.id, code: warehouse.code, name: warehouse.name, slug: warehouse.slug }}
      materials={materials.map((material) => ({
        id: material.id,
        name: material.name,
        displayName: formatRawMaterialDisplayName({
          name: material.name,
          thicknessValue: material.thicknessValue,
          thicknessUnit: material.thicknessUnit,
          sizeValue: material.sizeValue,
          sizeUnit: material.sizeUnit,
          gsm: material.gsm,
          micron: material.micron,
        }),
        currentStock: quantityToNumber(material.currentStock),
        baseUnit: material.baseUnit,
        minimumStock: quantityToNumber(material.minimumStock),
      }))}
      recipients={recipients.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}
