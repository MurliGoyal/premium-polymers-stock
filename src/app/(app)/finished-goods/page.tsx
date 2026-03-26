import { requirePagePermission } from "@/lib/auth";
import { FINISHED_GOODS_WAREHOUSE_CODE } from "@/lib/constants";
import { hasPermission } from "@/lib/rbac";
import { getFinishedGoodsData } from "./actions";
import { FinishedGoodsClient } from "./finished-goods-client";

export default async function FinishedGoodsPage() {
  const user = await requirePagePermission("finished_goods:view");
  const goods = await getFinishedGoodsData();

  return (
    <FinishedGoodsClient
      goods={goods}
      warehouseCode={FINISHED_GOODS_WAREHOUSE_CODE}
      canManage={hasPermission(user.role, "finished_goods:manage")}
    />
  );
}
