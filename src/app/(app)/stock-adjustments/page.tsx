import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getStockAdjustmentData } from "./actions";
import { StockAdjustmentsClient } from "./stock-adjustments-client";

export default async function StockAdjustmentsPage() {
  const user = await requirePagePermission("stock_adjustments:view");
  const data = await getStockAdjustmentData();

  return (
    <StockAdjustmentsClient
      warehouses={data.warehouses}
      materials={data.materials}
      canManage={hasPermission(user.role, "stock_adjustments:manage")}
    />
  );
}
