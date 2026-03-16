"use client";

import { Bell, CheckCheck, CircleAlert } from "lucide-react";
import type { AppShellNotification } from "@/components/layout/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/utils";

type NotificationSheetProps = {
  errorMessage: string | null;
  isActionPending: boolean;
  isLoading: boolean;
  notifications: AppShellNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
  unreadCount: number;
};

export function NotificationSheet({
  errorMessage,
  isActionPending,
  isLoading,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onOpenChange,
  onRetry,
  open,
  unreadCount,
}: NotificationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `${unreadCount} unread updates need review.`
              : "All recent alerts have been reviewed."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Badge variant={unreadCount > 0 ? "warning" : "secondary"}>
              {notifications.length} recent items
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0 || isLoading || isActionPending}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </div>

          {errorMessage ? (
            <div className="flex items-center justify-between gap-3 rounded-[24px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p>{errorMessage}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
                Retry
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-10 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-10 text-center text-sm text-muted-foreground">
              No recent notifications.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={notification.isRead ? "secondary" : "warning"}>
                          {notification.type.replaceAll("_", " ")}
                        </Badge>
                        {notification.warehouseCode ? (
                          <Badge variant="outline">{notification.warehouseCode}</Badge>
                        ) : null}
                        {notification.rawMaterialName ? (
                          <Badge variant="outline">{notification.rawMaterialName}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-foreground/88">{notification.message}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
                    </div>

                    {notification.isRead ? (
                      <Badge variant="secondary">Read</Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkRead(notification.id)}
                        className="shrink-0"
                        disabled={isActionPending}
                      >
                        <CircleAlert className="h-4 w-4" />
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
