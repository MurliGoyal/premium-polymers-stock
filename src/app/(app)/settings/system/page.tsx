import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getOperationalDataSummary } from "../actions";
import { SystemAdminClient } from "./system-admin-client";

export default async function SystemAdminPage() {
  const user = await requirePagePermission("settings:view");
  const summary = await getOperationalDataSummary();

  return <SystemAdminClient summary={summary} canManage={hasPermission(user.role, "settings:manage")} />;
}
