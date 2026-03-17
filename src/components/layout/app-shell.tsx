"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { Sidebar } from "./sidebar";
import { TabletRail } from "./tablet-rail";
import { Topbar } from "./topbar";
import type { AppShellUser, AppShellWarehouse } from "./types";

const SIDEBAR_STORAGE_KEY = "premium-polymers.sidebar-collapsed";
const TABLET_RAIL_WIDTH = 104;
const COLLAPSED_WIDTH = 104;
const EXPANDED_WIDTH = 296;
const SHELL_GUTTER = 32;
const SIDEBAR_EVENT = "premium-polymers:sidebar";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();
  window.addEventListener(SIDEBAR_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(SIDEBAR_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getSidebarSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({
  children,
  user,
  warehouses,
}: {
  children: React.ReactNode;
  user: AppShellUser;
  warehouses: AppShellWarehouse[];
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(subscribe, getSidebarSnapshot, () => false);
  const tabletOffset = useMemo(() => `${TABLET_RAIL_WIDTH + SHELL_GUTTER}px`, []);

  const desktopOffset = useMemo(
    () => `${(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) + SHELL_GUTTER}px`,
    [sidebarCollapsed]
  );

  const toggleSidebar = useCallback(() => {
    const nextValue = !getSidebarSnapshot();
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextValue ? "true" : "false");
    } catch {
      return;
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }, []);

  return (
    <div
      className="relative min-h-screen"
      style={{
        "--shell-sidebar-offset": desktopOffset,
        "--shell-tablet-offset": tabletOffset,
      } as CSSProperties}
    >
      <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} user={user} />
      <TabletRail user={user} />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={user}
      />

      <div className="min-h-screen transition-[padding] duration-500 ease-[cubic-bezier(0.2,1,0.22,1)] md:pl-[var(--shell-tablet-offset)] lg:pl-[var(--shell-sidebar-offset)]">
        <Topbar
          onDesktopSidebarToggle={toggleSidebar}
          onMobileNavOpen={() => setMobileNavOpen(true)}
          user={user}
          warehouses={warehouses}
        />
        <main className="px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-5 lg:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
