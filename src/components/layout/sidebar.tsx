"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Warehouse, ArrowRightLeft, ClipboardList,
  Users, Tag, UserCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { label: "Warehouses", href: "/warehouses", icon: Warehouse, permission: "warehouses:view" },
];

const activityNav: NavItem[] = [
  { label: "Transfer History", href: "/transfer-history", icon: ArrowRightLeft, permission: "transfer_history:view" },
  { label: "Material History", href: "/raw-materials-history", icon: ClipboardList, permission: "raw_materials_history:view" },
];

const settingsNav: NavItem[] = [
  { label: "Categories", href: "/settings/categories", icon: Tag, permission: "categories:manage" },
  { label: "Recipients", href: "/settings/recipients", icon: UserCheck, permission: "recipients:manage" },
  { label: "Users", href: "/settings/users", icon: Users, permission: "users:manage" },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || "VIEWER";

  const renderNavItem = (item: NavItem) => {
    if (item.permission && !hasPermission(role, item.permission)) return null;
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

    const link = (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive && "text-sidebar-primary")} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{link}</div>;
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar-background border-r border-sidebar-border flex flex-col"
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm shrink-0">
          PP
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <div className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap">Premium Polymers</div>
              <div className="text-[11px] text-sidebar-foreground/50 whitespace-nowrap">Stock Management</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold mb-2">Main</p>}
          {mainNav.map(renderNavItem)}
        </div>

        <Separator className="!my-4 bg-sidebar-border" />

        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold mb-2">Activity</p>}
          {activityNav.map(renderNavItem)}
        </div>

        {settingsNav.some(item => !item.permission || hasPermission(role, item.permission)) && (
          <>
            <Separator className="!my-4 bg-sidebar-border" />
            <div className="space-y-1">
              {!collapsed && <p className="px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold mb-2">Settings</p>}
              {settingsNav.map(renderNavItem)}
            </div>
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </motion.aside>
  );
}
