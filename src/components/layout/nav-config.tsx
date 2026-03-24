import {
  ArrowRightLeft,
  ClipboardList,
  LayoutDashboard,
  Shield,
  SlidersHorizontal,
  Tag,
  UserCheck,
  Users,
  Warehouse,
} from "lucide-react";
import type { Permission } from "@/lib/rbac";

export type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: Permission;
};

export type NavSection = {
  items: NavItem[];
  label: string;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
      { label: "Warehouses", href: "/warehouses", icon: Warehouse, permission: "warehouses:view" },
    ],
  },
  {
    label: "Activity",
    items: [
      { label: "Stock Adjustments", href: "/stock-adjustments", icon: SlidersHorizontal, permission: "stock_adjustments:view" },
      { label: "Transfer History", href: "/transfer-history", icon: ArrowRightLeft, permission: "transfer_history:view" },
      { label: "Material History", href: "/raw-materials-history", icon: ClipboardList, permission: "raw_materials_history:view" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Categories", href: "/settings/categories", icon: Tag, permission: "categories:view" },
      { label: "Recipients", href: "/settings/recipients", icon: UserCheck, permission: "recipients:view" },
      { label: "Users", href: "/settings/users", icon: Users, permission: "users:view" },
      { label: "System Admin", href: "/settings/system", icon: Shield, permission: "settings:view" },
    ],
  },
];
