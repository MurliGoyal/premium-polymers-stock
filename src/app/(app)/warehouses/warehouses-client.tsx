"use client";

import Link from "next/link";
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
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

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

export function WarehousesClient({ warehouses }: { warehouses: WarehouseData[] }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={cardVariants}>
        <ResponsivePageHeader
          eyebrow="Warehouse directory"
          title="Warehouses"
          description="Choose a warehouse to manage stock, inspect health signals, and move into material-level workflows without losing context on mobile."
          badge={<Badge variant="secondary">{warehouses.length} active warehouses</Badge>}
        />
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-2">
        {warehouses.map((warehouse) => (
          <motion.div key={warehouse.id} variants={cardVariants}>
            <Link href={`/warehouses/${warehouse.slug}`} className="block">
              <Card className="group relative overflow-hidden">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${warehouse.gradient} opacity-70`} />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_36%)]" />

                <CardContent className="relative space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary/14 text-primary shadow-[0_18px_38px_rgba(91,102,255,0.18)]">
                        <Warehouse className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-semibold tracking-[-0.04em]">{warehouse.code}</h2>
                        <p className="text-sm text-muted-foreground">{warehouse.subtitle || warehouse.name}</p>
                      </div>
                    </div>
                    <div className="rounded-full border border-white/8 bg-white/[0.05] p-3 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-foreground">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricCell label="Healthy" tone="emerald" value={warehouse.inStockCount} />
                    <MetricCell label="Low" tone="amber" value={warehouse.lowStockCount} />
                    <MetricCell label="Empty" tone="red" value={warehouse.outOfStockCount} />
                    <MetricCell label="Moves" tone="blue" value={warehouse.recentTransfers} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <DetailStat icon={Package} label="Materials" value={warehouse.totalMaterials} />
                    <DetailStat icon={BarChart3} label="Total stock" value={formatNumber(warehouse.totalStock)} accent="emerald" />
                    <DetailStat icon={ArrowRightLeft} label="Transfer qty" value={formatNumber(warehouse.totalTransferQty)} accent="blue" />
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
        ))}
      </div>
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
    <div className="rounded-[20px] border border-white/8 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xl font-semibold">{value}</p>
        <div className={`h-2.5 w-10 rounded-full ${tones[tone]}`} />
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailStat({
  accent = "default",
  icon: Icon,
  label,
  value,
}: {
  accent?: "blue" | "default" | "emerald";
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
    <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className={`mt-3 text-xl font-semibold ${accents[accent]}`}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}
