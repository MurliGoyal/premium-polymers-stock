import { requirePagePermission } from "@/lib/auth";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  const user = await requirePagePermission();

  return (
    <AccountClient
      user={{
        email: user.email,
        name: user.name,
        role: user.role,
      }}
    />
  );
}