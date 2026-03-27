import { redirect } from "next/navigation";
import {
  getAllowedFinishedGoodsWarehouseCodes,
  requirePagePermission,
} from "@/lib/auth";
import { FINISHED_GOODS_WAREHOUSES } from "@/lib/constants";
import { getFinishedGoodsDirectoryData } from "./actions";
import { FinishedGoodsWarehousesClient } from "./finished-goods-warehouses-client";

function getFinishedGoodsWarehousePath(code: string) {
  const warehouse =
    FINISHED_GOODS_WAREHOUSES.find((entry) => entry.code === code) ??
    FINISHED_GOODS_WAREHOUSES[0];

  return `/finished-goods/${warehouse.slug}`;
}

export default async function FinishedGoodsPage() {
  const user = await requirePagePermission("finished_goods:view");
  const allowedWarehouseCodes = getAllowedFinishedGoodsWarehouseCodes(user);

  if (allowedWarehouseCodes.length === 0) {
    redirect("/login");
  }

  if (allowedWarehouseCodes.length === 1) {
    redirect(getFinishedGoodsWarehousePath(allowedWarehouseCodes[0]));
  }

  const warehouses = await getFinishedGoodsDirectoryData();
  return <FinishedGoodsWarehousesClient warehouses={warehouses} />;
}
