"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Clock,
  Layers,
  OctagonAlert,
  Package,
  Plus,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppShellWarehouse } from "@/components/layout/types";
import { WarehouseActionPicker } from "@/components/shared/warehouse-action-picker";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/rbac";
import { formatDateTime, formatNumber, getActivityColor, getActivityLabel } from "@/lib/utils";

type DashboardData = Awaited<ReturnType<typeof import("./actions").getDashboardData>>;

const CHART_COLORS = [
  "hsl(250 95% 70%)",
  "hsl(190 92% 56%)",
  "hsl(36 96% 62%)",
  "hsl(206 93% 62%)",
  "hsl(340 82% 66%)",
  "hsl(146 76% 52%)",
  "hsl(283 82% 72%)",
  "hsl(205 88% 64%)",
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.2, 1, 0.22, 1] as [number, number, number, number] },
  },
};

export function DashboardClient({
  data,
  userRole,
}: {
  data: DashboardData;
  userRole: string;
}) {
  const {
    kpis,
    warehouseOverview,
    recentTransfers,
    recentActivities,
    categoryChartData,
    warehouseStockChart,
    transferTrendData,
    lowStockMaterials,
  } = data;

  const canCreateMaterials = hasPermission(userRole, "raw_materials:create");
  const canCreateTransfers = hasPermission(userRole, "transfers:create");
  const warehouseOptions: AppShellWarehouse[] = warehouseOverview.map((warehouse) => ({
    code: warehouse.code,
    name: warehouse.name,
    slug: warehouse.slug,
  }));

  const kpiCards = [
    { label: "Total materials", value: kpis.totalMaterials, icon: Package, tone: "indigo" },
    { label: "Categories", value: kpis.totalCategories, icon: Layers, tone: "violet" },
    { label: "Total stock", value: kpis.totalStock, icon: BarChart3, tone: "emerald" },
    { label: "Low stock", value: kpis.lowStockItems, icon: AlertTriangle, tone: "amber" },
    { label: "Transfers today", value: kpis.transfersToday, icon: ArrowRightLeft, tone: "blue" },
    { label: "Transfers (7d)", value: kpis.transfersThisWeek, icon: TrendingUp, tone: "cyan" },
    { label: "Warehouses", value: kpis.warehouseCount, icon: Warehouse, tone: "slate" },
    { label: "Out of stock", value: kpis.outOfStockItems, icon: OctagonAlert, tone: "red" },
  ];

  const categorySummary = categoryChartData.slice(0, 4);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Operations overview"
          title="Dashboard"
          description="High-contrast warehouse health, transfer movement, and stock risk with mobile-friendly summaries first."
          badge={<Badge variant="secondary">Live seeded metrics</Badge>}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/warehouses">
                  <Warehouse className="h-4 w-4" />
                  Warehouses
                </Link>
              </Button>
              {canCreateMaterials ? (
                <WarehouseActionPicker
                  action="add-material"
                  warehouses={warehouseOptions}
                  trigger={
                    <Button type="button">
                      <Plus className="h-4 w-4" />
                      Add material
                    </Button>
                  }
                />
              ) : null}
            </>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiCards.map((kpi) => (
          <MetricCard key={kpi.label} label={kpi.label} tone={kpi.tone} value={kpi.value} icon={kpi.icon} />
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.03em]">Warehouse overview</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/warehouses">
              Open warehouses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {warehouseOverview.map((warehouse) => (
            <Card key={warehouse.id} className="group overflow-hidden">
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                      <Warehouse className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{warehouse.code}</h3>
                      <p className="text-sm text-muted-foreground">{warehouse.name}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/warehouses/${warehouse.slug}`}>
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricPill label="Materials" value={warehouse.totalMaterials} />
                  <MetricPill label="Stock" value={formatNumber(Math.round(warehouse.totalStock))} tone="emerald" />
                  <MetricPill label="Low stock" value={warehouse.lowStockCount} tone="amber" />
                  <MetricPill label="Transfers" value={warehouse.recentTransfers} tone="blue" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
        <Card className="md:hidden">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Transfer activity snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transferTrendData.map((point) => (
              <div
                key={point.label}
                className="flex items-center justify-between rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">{point.label}</span>
                <span className="text-base font-semibold">{point.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Transfer activity (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={transferTrendData}>
                <defs>
                  <linearGradient id="colorTransfers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(250 95% 70%)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(250 95% 70%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(12, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(250 95% 70%)"
                  fill="url(#colorTransfers)"
                  strokeWidth={2.5}
                  name="Transfers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:hidden">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Category mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorySummary.map((category, index) => (
              <div key={category.name} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <p className="text-sm font-medium">{category.name}</p>
                  </div>
                  <p className="text-lg font-semibold">{category.count}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Materials by category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} stroke="rgba(255,255,255,0.48)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(12, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} name="Materials">
                  {categoryChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stock by warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={warehouseStockChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(12, 17, 31, 0.96)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "18px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="totalMaterials" fill="hsl(250 95% 70%)" radius={[8, 8, 0, 0]} name="Materials" />
                <Bar dataKey="lowStock" fill="hsl(36 96% 62%)" radius={[8, 8, 0, 0]} name="Low stock" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                Low stock alerts
              </CardTitle>
              <Badge variant="warning">{lowStockMaterials.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {lowStockMaterials.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground md:col-span-2">
                  All stock levels are healthy.
                </p>
              ) : (
                lowStockMaterials.map((material) => (
                  <div key={material.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{material.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {material.warehouseCode} / {material.category}
                        </p>
                      </div>
                      <Badge variant={material.status === "OUT_OF_STOCK" ? "danger" : "warning"}>
                        {material.currentStock} / {material.minimumStock} {material.baseUnit}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-3"
              >
                <div className={`mt-0.5 rounded-xl p-2 ${getActivityColor(activity.activityType)}`}>
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activity.materialName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getActivityLabel(activity.activityType)} / {activity.warehouseCode}
                    {activity.quantityChange ? ` / ${activity.quantityChange > 0 ? "+" : ""}${activity.quantityChange}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {activity.performedBy} / {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ArrowRightLeft className="h-4 w-4 text-sky-300" />
                Recent transfers
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/transfer-history">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="flex items-start gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-3"
              >
                <div className="mt-0.5 rounded-xl bg-sky-500/12 p-2 text-sky-300">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{transfer.materialName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {transfer.quantity} {transfer.materialUnit} {"->"} {transfer.recipientName}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {transfer.warehouseCode} / {transfer.createdBy} / {formatDateTime(transfer.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="h-auto w-full items-start justify-start whitespace-normal rounded-[22px] px-4 py-4">
              <Link href="/warehouses">
                <QuickActionContent
                  description="Select a warehouse to manage."
                  icon={Warehouse}
                  title="Go to warehouses"
                />
              </Link>
            </Button>
            {canCreateMaterials ? (
              <WarehouseActionPicker
                action="add-material"
                warehouses={warehouseOptions}
                trigger={
                  <Button variant="outline" className="h-auto w-full items-start justify-start whitespace-normal rounded-[22px] px-4 py-4">
                    <QuickActionContent
                      description="Add stock into a warehouse record."
                      icon={Plus}
                      title="Add raw material"
                    />
                  </Button>
                }
              />
            ) : null}
            {canCreateTransfers ? (
              <WarehouseActionPicker
                action="transfer"
                warehouses={warehouseOptions}
                trigger={
                  <Button variant="outline" className="h-auto w-full items-start justify-start whitespace-normal rounded-[22px] px-4 py-4">
                    <QuickActionContent
                      description="Deduct approved stock and log the movement."
                      icon={ArrowRightLeft}
                      title="Make transfer"
                    />
                  </Button>
                }
              />
            ) : null}
            <Button asChild variant="outline" className="h-auto w-full items-start justify-start whitespace-normal rounded-[22px] px-4 py-4">
              <Link href="/transfer-history">
                <QuickActionContent
                  description="Audit every outbound quantity."
                  icon={Clock}
                  title="Transfer history"
                />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
  value: number;
}) {
  const toneClasses: Record<string, string> = {
    amber: "bg-amber-500/14 text-amber-300",
    blue: "bg-sky-500/14 text-sky-300",
    cyan: "bg-cyan-500/14 text-cyan-300",
    emerald: "bg-emerald-500/14 text-emerald-300",
    indigo: "bg-indigo-500/14 text-indigo-300",
    red: "bg-red-500/14 text-red-300",
    slate: "bg-slate-500/14 text-slate-200",
    violet: "bg-violet-500/14 text-violet-300",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-[148px] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[10rem] text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-semibold tracking-[-0.04em]">{formatNumber(value)}</p>
      </CardContent>
    </Card>
  );
}

function MetricPill({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "blue" | "default" | "emerald" | "amber";
  value: number | string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    blue: "text-sky-300",
  };

  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function QuickActionContent({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-left">
        <p className="text-sm font-semibold normal-case tracking-normal">{title}</p>
        <p className="mt-1 text-xs normal-case tracking-normal text-muted-foreground">{description}</p>
      </div>
    </>
  );
}
