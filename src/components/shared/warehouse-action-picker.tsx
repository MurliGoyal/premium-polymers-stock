"use client";

import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Plus, Search, Warehouse } from "lucide-react";
import type { AppShellWarehouse } from "@/components/layout/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type WarehouseActionType = "add-material" | "open" | "transfer";

type WarehouseActionPickerProps = {
  action: WarehouseActionType;
  trigger: ReactNode;
  warehouses: AppShellWarehouse[];
};

const ACTION_COPY: Record<
  WarehouseActionType,
  {
    description: string;
    empty: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
  }
> = {
  "add-material": {
    description: "Choose a warehouse before creating a new stock record.",
    empty: "No warehouses match the current filter.",
    icon: Plus,
    title: "Add raw material",
  },
  open: {
    description: "Pick a warehouse to continue into the inventory detail view.",
    empty: "No warehouses are available.",
    icon: Warehouse,
    title: "Open warehouse",
  },
  transfer: {
    description: "Choose the source warehouse for the transfer workflow.",
    empty: "No warehouses match the current filter.",
    icon: ArrowRightLeft,
    title: "Make transfer",
  },
};

export function getWarehouseActionHref(action: WarehouseActionType, slug: string) {
  switch (action) {
    case "add-material":
      return `/warehouses/${slug}/raw-materials/add`;
    case "transfer":
      return `/warehouses/${slug}/transfer`;
    default:
      return `/warehouses/${slug}`;
  }
}

export function WarehouseActionPicker({
  action,
  trigger,
  warehouses,
}: WarehouseActionPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const config = ACTION_COPY[action];

  const filteredWarehouses = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return warehouses;
    }

    return warehouses.filter((warehouse) =>
      [warehouse.code, warehouse.name, warehouse.slug].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [deferredQuery, warehouses]);

  const ActionIcon = config.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-b border-white/8 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className="h-4 w-4 text-primary" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Filter warehouses by code or name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-11"
            />
          </div>

          {filteredWarehouses.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-muted-foreground">
              {config.empty}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWarehouses.map((warehouse) => (
                <Button
                  key={warehouse.slug}
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between rounded-[24px] px-4 py-4 text-left"
                  onClick={() => {
                    setOpen(false);
                    router.push(getWarehouseActionHref(action, warehouse.slug));
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{warehouse.code}</span>
                      <Badge variant="secondary">{config.title}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{warehouse.name}</p>
                  </div>
                  <ActionIcon className="h-4 w-4 text-primary" />
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
