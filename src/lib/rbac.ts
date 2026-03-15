import { Role } from "@prisma/client";

export type Permission =
  | "dashboard:view"
  | "warehouses:view"
  | "raw_materials:view"
  | "raw_materials:create"
  | "raw_materials:edit"
  | "raw_materials:delete"
  | "transfers:view"
  | "transfers:create"
  | "transfer_history:view"
  | "raw_materials_history:view"
  | "categories:manage"
  | "recipients:manage"
  | "users:manage"
  | "settings:manage";

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view", "raw_materials:create", "raw_materials:edit", "raw_materials:delete",
    "transfers:view", "transfers:create", "transfer_history:view", "raw_materials_history:view",
    "categories:manage", "recipients:manage", "users:manage", "settings:manage",
  ],
  MANAGER: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view", "raw_materials:create", "raw_materials:edit",
    "transfers:view", "transfers:create", "transfer_history:view", "raw_materials_history:view",
    "categories:manage", "recipients:manage",
  ],
  OPERATOR: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view",
    "transfers:view", "transfers:create", "transfer_history:view", "raw_materials_history:view",
  ],
  VIEWER: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view", "transfers:view",
    "transfer_history:view", "raw_materials_history:view",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = rolePermissions[role as Role];
  return perms ? perms.includes(permission) : false;
}

export function listPermissions(role: string): Permission[] {
  return rolePermissions[role as Role] ?? [];
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Admin",
    MANAGER: "Manager",
    OPERATOR: "Operator",
    VIEWER: "Viewer",
  };
  return labels[role] || role;
}

export function getRoleColor(role: string): string {
  switch (role) {
    case "ADMIN": return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400";
    case "MANAGER": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400";
    case "OPERATOR": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400";
    case "VIEWER": return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
    default: return "bg-slate-50 text-slate-700";
  }
}
