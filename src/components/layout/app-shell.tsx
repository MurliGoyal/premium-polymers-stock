"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { AppShellUser } from "./types";

const SIDEBAR_STORAGE_KEY = "premium-polymers.sidebar-collapsed";
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

  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AppShellUser;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(subscribe, getSidebarSnapshot, () => false);

  const desktopOffset = useMemo(
    () => `${(sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) + SHELL_GUTTER}px`,
    [sidebarCollapsed]
  );

  const toggleSidebar = useCallback(() => {
    const nextValue = !getSidebarSnapshot();
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextValue ? "true" : "false");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }, []);

  return (
    <div
      className="relative min-h-screen"
      style={{ "--shell-sidebar-offset": desktopOffset } as CSSProperties}
    >
      <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} user={user} />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={user}
      />

      <div className="min-h-screen transition-[padding] duration-300 ease-out lg:pl-[var(--shell-sidebar-offset)]">
        <Topbar
          onDesktopSidebarToggle={toggleSidebar}
          onMobileNavOpen={() => setMobileNavOpen(true)}
          user={user}
        />
        <main className="px-4 pb-10 pt-5 sm:px-6 lg:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
