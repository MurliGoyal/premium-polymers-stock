import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getStockAdjustmentData } from "./actions";
import { StockAdjustmentsClient } from "./stock-adjustments-client";

export default async function StockAdjustmentsPage() {
  const user = await requirePagePermission("stock_adjustments:view");
  const data = await getStockAdjustmentData();
  const canManageStockAdjustments = hasPermission(user.role, "stock_adjustments:manage");

  return (
    <StockAdjustmentsClient
      warehouses={data.warehouses}
      recipients={data.recipients}
      materials={data.materials}
      canManage={canManageStockAdjustments}
      canEditMaterials={hasPermission(user.role, "raw_materials:edit")}
      canTransfer={hasPermission(user.role, "transfers:create") || canManageStockAdjustments}
    />
  );
}
