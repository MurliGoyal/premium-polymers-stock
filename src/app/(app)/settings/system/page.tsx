import { requirePagePermission } from "@/lib/auth";
import { getOperationalDataSummary } from "../actions";
import { SystemAdminClient } from "./system-admin-client";

export default async function SystemAdminPage() {
  await requirePagePermission("settings:manage");
  const summary = await getOperationalDataSummary();

  return <SystemAdminClient summary={summary} />;
}
