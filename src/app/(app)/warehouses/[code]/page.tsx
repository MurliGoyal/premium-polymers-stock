import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth";
import { getWarehouseData } from "./actions";
import { WarehouseDetailClient } from "./warehouse-detail-client";

export default async function WarehouseDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requirePagePermission("raw_materials:view");
  const { code } = await params;
  const data = await getWarehouseData(code);

  if (!data) notFound();

  return <WarehouseDetailClient data={data} userRole={user.role} />;
}
