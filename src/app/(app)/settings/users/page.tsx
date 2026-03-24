import { requirePagePermission } from "@/lib/auth";
import { getUsers } from "../actions";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  await requirePagePermission("users:view");
  const users = await getUsers();
  return (
    <UsersClient
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
