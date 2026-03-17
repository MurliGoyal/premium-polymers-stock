"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/icon-chip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getRoleLabel } from "@/lib/rbac";
import type { AppShellUser } from "./types";
import { SidebarNavigation } from "./sidebar";

type MobileNavSheetProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AppShellUser;
};

export function MobileNavSheet({ onOpenChange, open, user }: MobileNavSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="safe-bottom flex h-full w-[88vw] max-w-sm flex-col border-white/10 bg-sidebar-background/95 px-0 pb-5 pt-0 text-sidebar-foreground"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Main navigation</SheetTitle>
          <SheetDescription>Browse core areas of Premium Polymers and access account actions.</SheetDescription>
        </SheetHeader>

        <div className="border-b border-sidebar-border/80 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/8 bg-sidebar-primary/16 text-sm font-black tracking-[0.2em] text-sidebar-primary shadow-[0_18px_40px_rgba(91,102,255,0.12)]">
              PP
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground">Premium Polymers</p>
              <p className="text-xs text-sidebar-foreground/55">Premium stock management</p>
            </div>
          </div>
        </div>

        <div className="px-3 py-3">
          <SidebarNavigation onItemClick={() => onOpenChange(false)} role={user.role} />
        </div>

        <div className="mt-auto space-y-4 border-t border-sidebar-border/70 px-5 pt-5">
          <div className="surface-subtle rounded-[24px] p-4">
            <p className="text-sm font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="mt-1 truncate text-xs text-sidebar-foreground/55">{user.email}</p>
            <Badge variant="outline" className="mt-3 border-white/10 text-sidebar-foreground/82">
              {getRoleLabel(user.role)}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center gap-3 text-sidebar-foreground/78 hover:text-sidebar-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <IconChip size="sm" tone="slate">
              <LogOut className="h-4 w-4" />
            </IconChip>
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
