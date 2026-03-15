import { requirePagePermission } from "@/lib/auth";
import { getRecipientsWithCount } from "../actions";
import { RecipientsClient } from "./recipients-client";

export default async function RecipientsPage() {
  await requirePagePermission("recipients:manage");
  const recipients = await getRecipientsWithCount();
  return (
    <RecipientsClient
      recipients={recipients.map((r) => ({
        id: r.id,
        name: r.name,
        transferCount: r._count.transfers,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}
