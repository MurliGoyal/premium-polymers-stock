import { requirePagePermission } from "@/lib/auth";
import { getStockAdjustmentData } from "./actions";
import { StockAdjustmentsClient } from "./stock-adjustments-client";

export default async function StockAdjustmentsPage() {
  await requirePagePermission("stock_adjustments:manage");
  const data = await getStockAdjustmentData();

  return <StockAdjustmentsClient warehouses={data.warehouses} materials={data.materials} />;
}
