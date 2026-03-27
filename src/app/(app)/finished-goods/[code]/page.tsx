import { notFound, redirect } from "next/navigation";
import {
  requirePagePermission,
  resolveFinishedGoodsWarehouseForUser,
} from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { FINISHED_GOODS_WAREHOUSES } from "@/lib/constants";
import { getFinishedGoodsWarehouseData } from "../actions";
import { FinishedGoodsClient } from "../finished-goods-client";

function getFinishedGoodsWarehousePath(code: string) {
  const warehouse =
    FINISHED_GOODS_WAREHOUSES.find((entry) => entry.code === code) ??
    FINISHED_GOODS_WAREHOUSES[0];

  return `/finished-goods/${warehouse.slug}`;
}

export default async function FinishedGoodsWarehousePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const user = await requirePagePermission("finished_goods:view");
  const { code } = await params;
  const normalizedCode = code.trim().toLowerCase();
  const requestedWarehouse =
    FINISHED_GOODS_WAREHOUSES.find(
      (entry) =>
        entry.slug === normalizedCode ||
        entry.code.toLowerCase() === normalizedCode,
    ) ?? null;
  const resolvedWarehouseCode = resolveFinishedGoodsWarehouseForUser(
    user,
    requestedWarehouse?.code,
  );

  if (!resolvedWarehouseCode) {
    redirect("/login");
  }

  if (!requestedWarehouse || requestedWarehouse.code !== resolvedWarehouseCode) {
    redirect(getFinishedGoodsWarehousePath(resolvedWarehouseCode));
  }

  const data = await getFinishedGoodsWarehouseData(resolvedWarehouseCode);
  if (!data) {
    notFound();
  }

  return (
    <FinishedGoodsClient
      data={data}
      canManage={hasPermission(user.role, "finished_goods:manage")}
    />
  );
}
