"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Menu, PanelLeft, Search } from "lucide-react";
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
import type { ApiResponse } from "@/lib/api-response";
import { getRoleColor, getRoleLabel } from "@/lib/rbac";
import { CommandPalette } from "./command-palette";
import { NotificationSheet } from "./notification-sheet";
import type { AppShellNotification, AppShellUser, AppShellWarehouse } from "./types";

type TopbarProps = {
  onDesktopSidebarToggle: () => void;
  onMobileNavOpen: () => void;
  user: AppShellUser;
  warehouses: AppShellWarehouse[];
};

type NotificationsPayload = {
  notifications: AppShellNotification[];
  unreadCount: number;
};

type MarkReadPayload = {
  markedIds: string[];
  unreadCount: number;
};

export function Topbar({
  onDesktopSidebarToggle,
  onMobileNavOpen,
  user,
  warehouses,
}: TopbarProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppShellNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationActionPending, setNotificationActionPending] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<NotificationsPayload>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Notifications could not be loaded right now." : payload.error.message);
      }

      setNotifications(payload.data.notifications);
      setNotificationCount(payload.data.unreadCount);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Notifications could not be loaded right now.");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationsRead = useCallback(
    async (payload: { ids?: string[]; markAll?: boolean }) => {
      setNotificationActionPending(true);

      try {
        const response = await fetch("/api/notifications/mark-read", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = (await response.json()) as ApiResponse<MarkReadPayload>;

        if (!response.ok || !result.ok) {
          throw new Error(result.ok ? "Notifications could not be updated right now." : result.error.message);
        }

        setNotifications((current) =>
          current.map((notification) =>
            payload.markAll || result.data.markedIds.includes(notification.id)
              ? { ...notification, isRead: true }
              : notification
          )
        );
        setNotificationCount(result.data.unreadCount);
        setNotificationsError(null);
      } catch (error) {
        setNotificationsError(error instanceof Error ? error.message : "Notifications could not be updated right now.");
      } finally {
        setNotificationActionPending(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (notificationsOpen) {
      void loadNotifications();
    }
  }, [loadNotifications, notificationsOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
        return;
      }

      event.preventDefault();
      setCommandOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
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
          <div className="flex items-center gap-2 md:hidden">
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

          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <Button type="button" variant="outline" size="icon" onClick={() => setCommandOpen(true)}>
              <Search className="h-4 w-4" />
              <span className="sr-only">Open search</span>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Operations cockpit</p>
              <p className="truncate text-xs text-muted-foreground">Mobile-first warehouse control</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="hidden min-w-0 flex-1 items-center justify-between rounded-[22px] px-4 text-left md:flex"
            onClick={() => setCommandOpen(true)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">Search pages and warehouse actions</span>
            </span>
            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Ctrl K
            </span>
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <p className="sr-only" aria-live="polite">
              {notificationCount} unread notifications
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground"
              onClick={() => setNotificationsOpen(true)}
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
                <Button type="button" variant="ghost" className="h-auto rounded-2xl px-2 py-1.5 sm:px-2.5">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left lg:block">
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

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} role={user.role} warehouses={warehouses} />
      <NotificationSheet
        errorMessage={notificationsError}
        isActionPending={notificationActionPending}
        isLoading={notificationsLoading}
        notifications={notifications}
        onMarkAllRead={() => void markNotificationsRead({ markAll: true })}
        onMarkRead={(id) => void markNotificationsRead({ ids: [id] })}
        onOpenChange={setNotificationsOpen}
        open={notificationsOpen}
        onRetry={() => void loadNotifications()}
        unreadCount={notificationCount}
      />
    </>
  );
}
