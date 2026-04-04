import { notFound, redirect } from "next/navigation";
import {
  getWritableFinishedGoodsWarehouseCodes,
  requirePagePermission,
  resolveFinishedGoodsWarehouseForUser,
} from "@/lib/auth";
import {
  hasPermission,
  isFinishedGoodsWarehouseScopedRole,
} from "@/lib/rbac";
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
  const writableWarehouseCodes = getWritableFinishedGoodsWarehouseCodes(user);
  const resolvedWarehouseCode = resolveFinishedGoodsWarehouseForUser(
    user,
    requestedWarehouse?.code,
  );

  if (!resolvedWarehouseCode) {
    redirect("/login");
  }

  if (!requestedWarehouse) {
    redirect(getFinishedGoodsWarehousePath(resolvedWarehouseCode));
  }

  const isOwnWarehouse = writableWarehouseCodes.includes(requestedWarehouse.code);
  const isReadOnlyView =
    isFinishedGoodsWarehouseScopedRole(user.role) && !isOwnWarehouse;

  const data = await getFinishedGoodsWarehouseData(requestedWarehouse.code);
  if (!data) {
    notFound();
  }

  return (
    <FinishedGoodsClient
      data={data}
      canManage={
        hasPermission(user.role, "finished_goods:manage") && isOwnWarehouse
      }
      isReadOnlyView={isReadOnlyView}
      ownWarehouseCode={writableWarehouseCodes[0] ?? null}
    />
  );
}
