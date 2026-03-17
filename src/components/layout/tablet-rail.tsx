"use client";

import { IconChip } from "@/components/ui/icon-chip";
import { SidebarNavigation } from "./sidebar";
import type { AppShellUser } from "./types";

export function TabletRail({ user }: { user: AppShellUser }) {
  const initials = user.name
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="fixed inset-y-4 left-4 z-40 hidden w-[104px] md:block lg:hidden">
      <div className="flex h-full flex-col rounded-[32px] border border-sidebar-border/80 bg-sidebar-background/90 p-3 text-sidebar-foreground shadow-[0_28px_90px_rgba(2,6,23,0.48)] backdrop-blur-2xl">
        <div className="flex justify-center px-2 py-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/8 bg-sidebar-primary/16 text-sm font-black tracking-[0.2em] text-sidebar-primary shadow-[0_18px_40px_rgba(91,102,255,0.12)]">
            PP
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-1">
          <SidebarNavigation collapsed role={user.role} />
        </div>

        <div className="mt-4 flex justify-center px-1">
          <IconChip size="lg" tone="primary" className="text-xs font-semibold tracking-[0.08em]">
            {initials}
          </IconChip>
        </div>
      </div>
    </aside>
  );
}
