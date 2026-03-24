import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getRecipientsWithCount } from "../actions";
import { RecipientsClient } from "./recipients-client";

export default async function RecipientsPage() {
  const user = await requirePagePermission("recipients:view");
  const recipients = await getRecipientsWithCount();
  return (
    <RecipientsClient
      canManage={hasPermission(user.role, "recipients:manage")}
      recipients={recipients.map((r) => ({
        id: r.id,
        name: r.name,
        transferCount: r._count.transfers,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
