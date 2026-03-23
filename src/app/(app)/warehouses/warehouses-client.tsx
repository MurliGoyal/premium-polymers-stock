"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  OctagonAlert,
  Package,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type WarehouseHealthFilter, getWarehousesHref } from "@/lib/drilldowns";
import { cn, formatNumber } from "@/lib/utils";

type WarehouseData = {
  id: string;
  code: string;
  name: string;
  slug: string;
  subtitle: string;
  gradient: string;
  totalMaterials: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStock: number;
  recentTransfers: number;
  totalTransferQty: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.2, 1, 0.22, 1] as [number, number, number, number] } },
};

export function WarehousesClient({
  warehouses,
  initialHealthFilter,
}: {
  warehouses: WarehouseData[];
  initialHealthFilter: WarehouseHealthFilter;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [healthFilter, setHealthFilter] = useState<WarehouseHealthFilter>(initialHealthFilter);

  const filteredWarehouses = useMemo(() => {
    switch (healthFilter) {
      case "low-stock":
        return warehouses.filter((warehouse) => warehouse.lowStockCount > 0);
      case "out-of-stock":
        return warehouses.filter((warehouse) => warehouse.outOfStockCount > 0);
      default:
        return warehouses;
    }
  }, [healthFilter, warehouses]);

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: "All", count: warehouses.length },
      {
        key: "low-stock" as const,
        label: "Low stock",
        count: warehouses.filter((warehouse) => warehouse.lowStockCount > 0).length,
      },
      {
        key: "out-of-stock" as const,
        label: "Out of stock",
        count: warehouses.filter((warehouse) => warehouse.outOfStockCount > 0).length,
      },
    ],
    [warehouses]
  );

  const applyHealthFilter = (nextFilter: WarehouseHealthFilter) => {
    setHealthFilter(nextFilter);
    router.replace(nextFilter === "all" ? pathname : getWarehousesHref(nextFilter), { scroll: false });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={cardVariants}>
        <ResponsivePageHeader
          eyebrow="Warehouse directory"
          title="Warehouses"
          description="Select a warehouse to view stock, health status, and materials."
          badge={
            <Badge variant="secondary">
              {healthFilter === "all" ? `${warehouses.length} active warehouses` : `${filteredWarehouses.length} matching warehouses`}
            </Badge>
          }
        />
      </motion.div>

      {warehouses.length === 0 ? (
        <Card className="glass-panel border-white/10">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Warehouse className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No warehouses found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Warehouse records are not available right now. Refresh the view or return to the dashboard.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => router.refresh()}>
                Refresh
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={healthFilter === option.key ? "default" : "outline"}
                onClick={() => applyHealthFilter(option.key)}
              >
                {option.label}
                <span className="text-xs text-current/80">{option.count}</span>
              </Button>
            ))}
          </div>

          {filteredWarehouses.length === 0 ? (
            <Card className="glass-panel border-white/10">
              <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <Warehouse className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold">No warehouses match this filter</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clear the active health filter to see the full warehouse directory again.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={() => applyHealthFilter("all")}>
                    Show all
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {filteredWarehouses.map((warehouse) => {
                const totalMaterials = warehouse.totalMaterials;
                const healthSummary =
                  totalMaterials === 0
                    ? "No materials yet"
                    : `${Math.round((warehouse.inStockCount / totalMaterials) * 100)}% healthy · ${Math.round((warehouse.lowStockCount / totalMaterials) * 100)}% low · ${Math.round((warehouse.outOfStockCount / totalMaterials) * 100)}% empty`;

                return (
                  <motion.div key={warehouse.id} variants={cardVariants}>
                    <Link href={`/warehouses/${warehouse.slug}`} className="block">
                      <Card className="group relative overflow-hidden border-white/10 glass-panel hover-glow">
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${warehouse.gradient} opacity-70`} />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_36%)]" />

                        <CardContent className="relative space-y-3 sm:space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-primary/14 text-primary shadow-[0_18px_38px_rgba(91,102,255,0.18)] sm:h-14 sm:w-14 sm:rounded-[20px]">
                                <Warehouse className="h-5 w-5 sm:h-6 sm:w-6" />
                              </div>
                              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                                <h2 className="text-xl font-semibold tracking-[-0.04em] sm:text-2xl">{warehouse.code}</h2>
                                <p className="line-clamp-2 text-[13px] text-muted-foreground sm:text-sm">{warehouse.subtitle || warehouse.name}</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 sm:text-xs">{healthSummary}</p>
                              </div>
                            </div>
                            <div className="rounded-full border border-white/8 bg-white/[0.05] p-2 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-foreground sm:p-3">
                              <ArrowRight className="h-4 w-4" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <MetricCell label="Healthy" tone="emerald" value={warehouse.inStockCount} />
                            <MetricCell label="Low" tone="amber" value={warehouse.lowStockCount} />
                            <MetricCell label="Empty" tone="red" value={warehouse.outOfStockCount} />
                            <MetricCell label="Moves" tone="blue" value={warehouse.recentTransfers} />
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <DetailStat icon={Package} label="Materials" value={warehouse.totalMaterials} />
                            <DetailStat icon={BarChart3} label="Total stock" value={formatNumber(warehouse.totalStock)} accent="emerald" />
                            <DetailStat
                              className="col-span-2 sm:col-span-1"
                              icon={ArrowRightLeft}
                              label="Transfer qty"
                              value={formatNumber(warehouse.totalTransferQty)}
                              accent="blue"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge variant="success">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {warehouse.inStockCount} in stock
                            </Badge>
                            {warehouse.lowStockCount > 0 ? (
                              <Badge variant="warning">{warehouse.lowStockCount} low stock</Badge>
                            ) : null}
                            {warehouse.outOfStockCount > 0 ? (
                              <Badge variant="danger">
                                <OctagonAlert className="mr-1 h-3 w-3" />
                                {warehouse.outOfStockCount} out of stock
                              </Badge>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function MetricCell({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "amber" | "blue" | "emerald" | "red";
  value: number;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-500/12 text-amber-300",
    blue: "bg-sky-500/12 text-sky-300",
    emerald: "bg-emerald-500/12 text-emerald-300",
    red: "bg-red-500/12 text-red-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-white/[0.06] sm:rounded-[20px] sm:p-3">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <p className="text-lg font-semibold sm:text-xl">{value}</p>
        <div className={`h-2 w-8 rounded-full sm:h-2.5 sm:w-10 ${tones[tone]}`} />
      </div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:mt-2 sm:text-[11px]">{label}</p>
    </div>
  );
}

function DetailStat({
  accent = "default",
  className,
  icon: Icon,
  label,
  value,
}: {
  accent?: "blue" | "default" | "emerald";
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  const accents: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-300",
    blue: "text-sky-300",
  };

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-white/[0.06] sm:rounded-[22px] sm:p-4", className)}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className={`mt-2 text-base font-semibold sm:mt-3 sm:text-xl ${accents[accent]}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:mt-1 sm:text-[11px]">{label}</p>
    </div>
  );
}
