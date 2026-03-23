"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowRightLeft, Plus, Search, Warehouse, X } from "lucide-react";
import Fuse from "fuse.js";
import { getWarehouseActionHref } from "@/components/shared/warehouse-action-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconChip } from "@/components/ui/icon-chip";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/rbac";
import { NAV_SECTIONS } from "./nav-config";
import type { AppShellWarehouse } from "./types";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  warehouses: AppShellWarehouse[];
};

type CommandItem = {
  badge?: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  keywords: string;
  title: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  role,
  warehouses,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const navigationCommands = useMemo(
    () =>
      NAV_SECTIONS.flatMap((section) =>
        section.items
          .filter((item) => !item.permission || hasPermission(role, item.permission))
          .map((item) => ({
            badge: section.label,
            description: `Open ${item.label.toLowerCase()}`,
            href: item.href,
            icon: item.icon,
            id: `nav-${item.href}`,
            keywords: `${section.label} ${item.label} ${item.href}`,
            title: item.label,
          }))
      ),
    [role]
  );

  const warehouseCommands = useMemo(() => {
    const items: CommandItem[] = [];

    warehouses.forEach((warehouse) => {
      items.push({
        badge: "Warehouse",
        description: warehouse.name,
        href: getWarehouseActionHref("open", warehouse.slug),
        icon: Warehouse,
        id: `warehouse-open-${warehouse.slug}`,
        keywords: `${warehouse.code} ${warehouse.name} open warehouse`,
        title: `Open ${warehouse.code}`,
      });

      if (hasPermission(role, "raw_materials:create")) {
        items.push({
          badge: "Add material",
          description: `Create stock in ${warehouse.code}`,
          href: getWarehouseActionHref("add-material", warehouse.slug),
          icon: Plus,
          id: `warehouse-add-${warehouse.slug}`,
          keywords: `${warehouse.code} ${warehouse.name} add material stock create`,
          title: `Add material in ${warehouse.code}`,
        });
      }

      if (hasPermission(role, "transfers:create")) {
        items.push({
          badge: "Transfer",
          description: `Start a transfer from ${warehouse.code}`,
          href: getWarehouseActionHref("transfer", warehouse.slug),
          icon: ArrowRightLeft,
          id: `warehouse-transfer-${warehouse.slug}`,
          keywords: `${warehouse.code} ${warehouse.name} transfer move stock`,
          title: `Transfer from ${warehouse.code}`,
        });
      }
    });

    return items;
  }, [role, warehouses]);

  const filteredNavigationCommands = useMemo(() => {
    const normalizedQuery = deferredQuery.trim();

    if (!normalizedQuery) {
      return navigationCommands;
    }

    const fuse = new Fuse(navigationCommands, {
      keys: ["title", "keywords", "description"],
      threshold: 0.3,
      distance: 100,
    });
    
    return fuse.search(normalizedQuery).map((result) => result.item);
  }, [deferredQuery, navigationCommands]);

  const filteredWarehouseCommands = useMemo(() => {
    const normalizedQuery = deferredQuery.trim();

    if (!normalizedQuery) {
      return warehouseCommands;
    }

    const fuse = new Fuse(warehouseCommands, {
      keys: ["title", "keywords", "description", "badge"],
      threshold: 0.3,
      distance: 100,
    });
    
    return fuse.search(normalizedQuery).map((result) => result.item);
  }, [deferredQuery, warehouseCommands]);

  const hasResults =
    filteredNavigationCommands.length > 0 || filteredWarehouseCommands.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <DialogContent className="flex max-h-[min(90vh,760px)] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b border-white/8 px-4 py-4 shrink-0 sm:px-6 sm:py-5">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search pages and warehouse workflows with one shortcut.</DialogDescription>
        </DialogHeader>

        <div className="px-4 pt-4 shrink-0 sm:px-6 sm:pt-5">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search pages and warehouse actions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-11 pr-11"
            />
            {query.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 text-muted-foreground hover:bg-transparent hover:text-foreground h-8 w-8 rounded-full"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-0 overflow-y-auto min-h-0 mt-4 sm:px-6 sm:pb-5 sm:mt-5">
          {!hasResults ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-muted-foreground animate-in fade-in duration-300">
              <Search className="mb-4 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-foreground">No matches found</p>
              <p className="mt-1">Try searching for a different keyword or check for typos.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <CommandGroup
                items={filteredNavigationCommands}
                title="Navigation"
                onSelect={(href) => {
                  onOpenChange(false);
                  router.push(href);
                }}
              />
              <CommandGroup
                items={filteredWarehouseCommands}
                title="Warehouse actions"
                onSelect={(href) => {
                  onOpenChange(false);
                  router.push(href);
                }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandGroup({
  items,
  onSelect,
  title,
}: {
  items: CommandItem[];
  onSelect: (href: string) => void;
  title: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/8 bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
          No entries
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              className="h-auto w-full justify-between rounded-[22px] px-4 py-4 text-left"
              onClick={() => onSelect(item.href)}
            >
              <div className="flex min-w-0 items-start gap-3">
                <IconChip size="sm" tone="primary" className="mt-0.5">
                  <item.icon className="h-4 w-4" />
                </IconChip>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
