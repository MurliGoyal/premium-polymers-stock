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
  | "categories:view"
  | "categories:manage"
  | "recipients:view"
  | "recipients:manage"
  | "stock_adjustments:view"
  | "stock_adjustments:manage"
  | "finished_goods:view"
  | "finished_goods:manage"
  | "finished_goods_history:view"
  | "users:view"
  | "users:manage"
  | "settings:view"
  | "settings:manage";

const rolePermissions: Record<string, Permission[]> = {
  MANAGER: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view", "raw_materials:create", "raw_materials:edit", "raw_materials:delete",
    "transfers:view", "transfers:create", "transfer_history:view", "raw_materials_history:view",
    "stock_adjustments:view", "stock_adjustments:manage",
    "finished_goods:view", "finished_goods:manage", "finished_goods_history:view",
    "categories:view", "categories:manage",
    "recipients:view", "recipients:manage",
    "users:view", "users:manage",
    "settings:view", "settings:manage",
  ],
  FINISHED_GOODS_MANAGER: [
    "finished_goods:view",
    "finished_goods:manage",
    "finished_goods_history:view",
  ],
  STOCK_MANAGEMENT: [
    "warehouses:view",
    "raw_materials:view",
    "transfers:view",
    "transfers:create",
    "transfer_history:view",
    "stock_adjustments:view",
    "stock_adjustments:manage",
    "finished_goods:view", "finished_goods:manage", "finished_goods_history:view",
  ],
  RAW_MATERIAL_MANAGER: [
    "warehouses:view",
    "raw_materials:view",
    "raw_materials:create",
    "raw_materials:edit",
    "raw_materials:delete",
    "transfers:view",
    "transfers:create",
    "transfer_history:view",
    "raw_materials_history:view",
    "stock_adjustments:view",
    "stock_adjustments:manage",
    "categories:view",
    "categories:manage",
    "recipients:view",
    "recipients:manage",
  ],
  VIEWER: [
    "dashboard:view", "warehouses:view",
    "raw_materials:view", "transfers:view",
    "transfer_history:view", "raw_materials_history:view",
    "stock_adjustments:view",
    "finished_goods:view", "finished_goods_history:view",
    "categories:view",
    "recipients:view",
    "users:view",
    "settings:view",
  ],
};

export function normalizeRole(role: string): string {
  const normalizedRole = role.trim().toUpperCase();

  if (normalizedRole === "ADMIN") {
    return "MANAGER";
  }

  if (normalizedRole === "OPERATOR") {
    return "STOCK_MANAGEMENT";
  }

  return normalizedRole;
}

export function isFinishedGoodsWarehouseScopedRole(role: string): boolean {
  return normalizeRole(role) === "FINISHED_GOODS_MANAGER";
}

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = rolePermissions[normalizeRole(role)];
  return perms ? perms.includes(permission) : false;
}

export function listPermissions(role: string): Permission[] {
  return rolePermissions[normalizeRole(role)] ?? [];
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    MANAGER: "Manager",
    FINISHED_GOODS_MANAGER: "Finished Goods Manager",
    STOCK_MANAGEMENT: "Stock Management",
    RAW_MATERIAL_MANAGER: "Raw Material Manager",
    VIEWER: "Viewer",
  };
  return labels[normalizeRole(role)] || role;
}

export function getRoleColor(role: string): string {
  switch (normalizeRole(role)) {
    case "MANAGER": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400";
    case "FINISHED_GOODS_MANAGER": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
    case "STOCK_MANAGEMENT": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400";
    case "RAW_MATERIAL_MANAGER": return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400";
    case "VIEWER": return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400";
    default: return "bg-slate-50 text-slate-700";
  }
}
