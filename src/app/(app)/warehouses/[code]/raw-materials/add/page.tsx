import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddMaterialClient } from "./add-material-client";

export default async function AddRawMaterialPage({ params }: { params: Promise<{ code: string }> }) {
  await requirePagePermission("raw_materials:create");
  const { code } = await params;
  const warehouse = await prisma.warehouse.findUnique({ where: { slug: code } });
  if (!warehouse) notFound();

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <AddMaterialClient
      warehouse={{ id: warehouse.id, code: warehouse.code, name: warehouse.name, slug: warehouse.slug }}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
