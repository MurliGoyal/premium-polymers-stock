"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Moon, PanelLeft, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getRoleLabel, getRoleColor } from "@/lib/rbac";
import type { AppShellUser } from "./types";

type TopbarProps = {
  onDesktopSidebarToggle: () => void;
  onMobileNavOpen: () => void;
  user: AppShellUser;
};

export function Topbar({ onDesktopSidebarToggle, onMobileNavOpen, user }: TopbarProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/count")
      .then((response) => (response.ok ? response.json() : { count: 0 }))
      .then((data) => setNotificationCount(data.count))
      .catch(() => {});
  }, []);

  const initials = useMemo(
    () =>
      user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [user.name]
  );

  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="surface-panel flex min-h-[72px] items-center gap-3 rounded-[28px] px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 lg:hidden">
            <Button type="button" variant="outline" size="icon" onClick={onMobileNavOpen}>
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Button type="button" variant="outline" size="icon" onClick={onDesktopSidebarToggle}>
              <PanelLeft className="h-4 w-4" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>

          <div className="hidden max-w-xl flex-1 lg:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search materials, transfers, recipients, or history"
                className="pl-11"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <Button type="button" variant="outline" size="icon" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
              <span className="sr-only">Open search</span>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Operations cockpit</p>
              <p className="truncate text-xs text-muted-foreground">Mobile-first warehouse control</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="relative text-muted-foreground"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground"
              onClick={() => router.push("/dashboard")}
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 ? (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
              <span className="sr-only">Notifications</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto rounded-2xl px-2 py-1.5 sm:px-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{getRoleLabel(user.role)}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant="outline" className={`mt-2 ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="rounded-b-[28px]">
          <SheetHeader className="text-left">
            <SheetTitle>Quick search</SheetTitle>
            <SheetDescription>Search stays compact on mobile while preserving the layout width.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search materials, transfers, recipients, or history"
                className="pl-11"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchOpen(false);
                  router.push("/dashboard");
                }}
              >
                Dashboard
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchOpen(false);
                  router.push("/warehouses");
                }}
              >
                Warehouses
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
