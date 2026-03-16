import { requirePagePermission } from "@/lib/auth";
import { getDashboardData } from "./actions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const data = await getDashboardData();
  return <DashboardClient data={data} userRole={user.role} />;
}
