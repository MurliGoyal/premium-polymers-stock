import { requirePagePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getUsers } from "../actions";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const user = await requirePagePermission("users:view");
  const users = await getUsers();
  return (
    <UsersClient
      canManage={hasPermission(user.role, "users:manage")}
      currentUserId={user.id}
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
