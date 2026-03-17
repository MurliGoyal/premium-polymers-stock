"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getRoleLabel, hasPermission } from "@/lib/rbac";
import { NAV_SECTIONS } from "./nav-config";
import type { AppShellUser } from "./types";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  user: AppShellUser;
};

type SidebarNavigationProps = {
  collapsed?: boolean;
  onItemClick?: () => void;
  role: string;
};

export function SidebarNavigation({
  collapsed = false,
  onItemClick,
  role,
}: SidebarNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter((item) => !item.permission || hasPermission(role, item.permission));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label} className="space-y-2">
            {!collapsed ? (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/35">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "text-sidebar-foreground/64 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <IconChip
                      size="md"
                      tone={isActive ? "primary" : "slate"}
                      className={cn(
                        !isActive && "text-sidebar-foreground/72 group-hover:border-white/10 group-hover:bg-white/[0.06] group-hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </IconChip>
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </Link>
                );

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={item.href}>{link}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle, user }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 104 : 296 }}
      transition={{ duration: 0.28, ease: [0.2, 1, 0.22, 1] as [number, number, number, number] }}
      className="fixed inset-y-4 left-4 z-40 hidden lg:block"
    >
      <div className="flex h-full flex-col rounded-[32px] border border-sidebar-border/80 bg-sidebar-background/90 p-3 text-sidebar-foreground shadow-[0_28px_90px_rgba(2,6,23,0.48)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/8 bg-sidebar-primary/16 text-sm font-black tracking-[0.2em] text-sidebar-primary shadow-[0_18px_40px_rgba(91,102,255,0.12)]">
            PP
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">Premium Polymers</p>
              <p className="text-xs text-sidebar-foreground/48">Premium stock management</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-1">
          <SidebarNavigation collapsed={collapsed} role={user.role} />
        </div>

        <div className="mt-4 px-1">
          <Separator className="bg-sidebar-border/70" />
          <div className={cn("mt-4 rounded-[24px] border border-white/6 bg-white/[0.03] p-3", collapsed && "px-2 py-3")}>
            {!collapsed ? (
              <>
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</p>
                <p className="mt-1 truncate text-xs text-sidebar-foreground/48">{user.email}</p>
                <Badge variant="outline" className="mt-3 border-white/10 text-sidebar-foreground/82">
                  <Shield className="mr-1 h-3 w-3" />
                  {getRoleLabel(user.role)}
                </Badge>
              </>
            ) : (
              <div className="flex items-center justify-center text-xs font-semibold text-sidebar-primary">
                {user.name
                  .split(" ")
                  .map((segment) => segment[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            className="mt-3 h-11 w-full rounded-2xl border border-white/6 text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.aside>
  );
}
