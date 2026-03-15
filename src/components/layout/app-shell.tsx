"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <motion.div
        animate={{ marginLeft: sidebarCollapsed ? 68 : 256 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        className="flex flex-col min-h-screen"
      >
        <Topbar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </motion.div>
    </div>
  );
}
