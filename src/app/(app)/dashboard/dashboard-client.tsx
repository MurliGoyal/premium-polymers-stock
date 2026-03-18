"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { IconChip } from "@/components/ui/icon-chip";
import {
  getMaterialHistoryHref,
  getTransferHistoryHref,
  getTransferHistoryRangeHref,
  getWarehouseDetailHref,
  getWarehousesHref,
} from "@/lib/drilldowns";
import { hasPermission } from "@/lib/rbac";
import { cn, formatDateTime, formatNumber, getActivityColor, getActivityLabel } from "@/lib/utils";

type DashboardData = Awaited<ReturnType<typeof import("./actions").getDashboardData>>;
type MobileChartView = "categories" | "stock" | "transfers";

const CHART_COLORS = [
  "hsl(250 95% 70%)",
  "hsl(190 92% 56%)",
  "hsl(36 96% 62%)",
  "hsl(206 93% 62%)",
  "hsl(340 82% 66%)",
  "hsl(146 76% 52%)",
];

const chartTooltipStyle = {
  backgroundColor: "rgba(12, 17, 31, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  fontSize: "12px",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const hoverTransition = {
  type: "spring" as const,
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

function truncateLabel(label: string, max = 12) {
  return label.length > max ? `${label.slice(0, Math.max(max - 3, 1))}...` : label;
}

export function DashboardClient({
  data,
  userRole,
}: {
  data: DashboardData;
  userRole: string;
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [mobileChartView, setMobileChartView] = useState<MobileChartView>("transfers");
  const {
    categoryChartData,
    kpis,
    lowStockMaterials,
    recentActivities,
    recentTransfers,
    transferTrendData,
    warehouseOverview,
    warehouseStockChart,
  } = data;

  const canCreateMaterials = hasPermission(userRole, "raw_materials:create");
  const canCreateTransfers = hasPermission(userRole, "transfers:create");
  const canManageCategories = hasPermission(userRole, "categories:manage");
  const warehouseOptions: AppShellWarehouse[] = warehouseOverview.map((warehouse) => ({
    code: warehouse.code,
    name: warehouse.name,
    slug: warehouse.slug,
  }));
  const hasWarehouses = warehouseOptions.length > 0;
  const warehousesHref = getWarehousesHref();
  const categoriesHref = canManageCategories ? "/settings/categories" : getMaterialHistoryHref();
  const transferTodayHref = getTransferHistoryRangeHref("today");
  const transferWeekHref = getTransferHistoryRangeHref("last-7-days");

  const chartOptions = useMemo(
    () => [
      { key: "transfers" as const, label: "Transfers", description: "7 day movement", icon: TrendingUp },
      { key: "categories" as const, label: "Categories", description: "material mix", icon: Layers },
      { key: "stock" as const, label: "Warehouse stock", description: "site comparison", icon: BarChart3 },
    ],
    []
  );

  const kpiCards = [
    { href: warehousesHref, label: "Total materials", value: kpis.totalMaterials, icon: Package, tone: "indigo" },
    { href: categoriesHref, label: "Categories", value: kpis.totalCategories, icon: Layers, tone: "violet" },
    { href: warehousesHref, label: "Total stock", value: kpis.totalStock, icon: BarChart3, tone: "emerald" },
    { href: getWarehousesHref("low-stock"), label: "Low stock", value: kpis.lowStockItems, icon: AlertTriangle, tone: "amber" },
    { href: transferTodayHref, label: "Transfers today", value: kpis.transfersToday, icon: ArrowRightLeft, tone: "blue" },
    { href: transferWeekHref, label: "Transfers (7d)", value: kpis.transfersThisWeek, icon: TrendingUp, tone: "cyan" },
    { href: warehousesHref, label: "Warehouses", value: kpis.warehouseCount, icon: Warehouse, tone: "slate" },
    { href: getWarehousesHref("out-of-stock"), label: "Out of stock", value: kpis.outOfStockItems, icon: OctagonAlert, tone: "red" },
  ];

  const topCategory = categoryChartData[0];
  const peakTransferDay = transferTrendData.reduce(
    (best, point) => (point.count > best.count ? point : best),
    transferTrendData[0] ?? { count: 0, date: "", label: "-", quantity: 0 }
  );
  const topWarehouse = warehouseOverview.reduce(
    (best, warehouse) => (warehouse.totalStock > best.totalStock ? warehouse : best),
    warehouseOverview[0] ?? { code: "-", slug: "", totalStock: 0 }
  );
  const peakTransferHref = peakTransferDay.date
    ? getTransferHistoryHref({ from: peakTransferDay.date, to: peakTransferDay.date })
    : transferWeekHref;
  const topCategoryHref = topCategory ? getMaterialHistoryHref({ category: topCategory.name }) : categoriesHref;
  const topWarehouseHref = topWarehouse.slug ? getWarehouseDetailHref(topWarehouse.slug) : warehousesHref;
  const hoverLift = prefersReducedMotion ? undefined : { y: -4, scale: 1.008 };
  const hoverLiftSoft = prefersReducedMotion ? undefined : { y: -2, scale: 1.003 };
  const tapScale = prefersReducedMotion ? undefined : { scale: 0.985 };

  const handleSummaryCardKeyDown = (event: KeyboardEvent<HTMLElement>, href: string) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
      event.preventDefault();
      router.push(href);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4 sm:space-y-5">
      <motion.div variants={itemVariants}>
        <ResponsivePageHeader
          eyebrow="Operations overview"
          title="Dashboard"
          description="A cleaner mobile-first view of warehouse health, transfers, and stock risk with one-chart-at-a-time analytics on phones."
          badge={
            <Badge variant="secondary">
              {kpis.unreadNotifications > 0
                ? `${formatNumber(kpis.unreadNotifications)} unread alerts`
                : "All alerts clear"}
            </Badge>
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/warehouses">
                  <Warehouse className="h-4 w-4" />
                  Warehouses
                </Link>
              </Button>
              {canCreateMaterials && hasWarehouses ? (
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

      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <motion.div key={card.label} whileHover={hoverLift} transition={hoverTransition}>
            <MetricCard href={card.href} icon={card.icon} label={card.label} tone={card.tone} value={card.value} />
          </motion.div>
        ))}
      </motion.div>

      <motion.section variants={itemVariants} className="space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em]">Warehouse overview</h2>
            <p className="text-sm text-muted-foreground">Quick access to every site with compact health summaries.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/warehouses">
              Open warehouses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {warehouseOverview.length === 0 ? (
          <Card className="glass-panel">
            <CardContent className="py-12">
              <EmptyState
                description="Warehouse cards will appear here once warehouse records are available."
                icon={Warehouse}
                title="No warehouse overview yet"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {warehouseOverview.map((warehouse) => {
              const healthyCount = Math.max(
                warehouse.totalMaterials - warehouse.lowStockCount - warehouse.outOfStockCount,
                0
              );
              const warehouseHref = getWarehouseDetailHref(warehouse.slug);
              const lowStockHref = getWarehouseDetailHref(warehouse.slug, { status: "LOW_STOCK" });
              const transfersHref = getTransferHistoryRangeHref("last-7-days", { warehouse: warehouse.code });

              return (
                <motion.div key={warehouse.id} whileHover={hoverLiftSoft} transition={hoverTransition}>
                  <Card
                    aria-label={`Open ${warehouse.code} warehouse`}
                    className="glass-panel hover-glow cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(warehouseHref)}
                    onKeyDown={(event) => handleSummaryCardKeyDown(event, warehouseHref)}
                  >
                    <CardContent className="relative space-y-3.5 sm:space-y-4">
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-3xl"
                        animate={prefersReducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.24, 0.34, 0.24] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-start gap-3">
                            <IconChip size="lg" tone="primary">
                              <Warehouse className="h-5 w-5" />
                            </IconChip>
                            <div className="min-w-0">
                              <h3 className="text-lg font-semibold">{warehouse.code}</h3>
                              <p className="truncate text-sm text-muted-foreground">{warehouse.name}</p>
                            </div>
                          </div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {warehouse.totalMaterials === 0
                              ? "No materials yet"
                              : `${Math.round((healthyCount / warehouse.totalMaterials) * 100)}% healthy`}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                          <Link href={warehouseHref} onClick={(event) => event.stopPropagation()}>
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>

                      <div className="relative grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
                        <MetricPill href={warehouseHref} label="Materials" value={warehouse.totalMaterials} />
                        <MetricPill href={warehouseHref} label="Stock" value={formatNumber(warehouse.totalStock)} tone="emerald" />
                        <MetricPill href={lowStockHref} label="Low" value={warehouse.lowStockCount} tone="amber" />
                        <MetricPill href={transfersHref} label="Transfers" value={warehouse.recentTransfers} tone="blue" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      <motion.section variants={itemVariants} className="space-y-3.5 sm:space-y-4 md:hidden">
        <Card className="glass-panel">
          <CardHeader className="space-y-3.5 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Mobile analytics</CardTitle>
              <p className="text-sm text-muted-foreground">Choose which chart to show so the dashboard stays clean on small screens.</p>
            </div>
            <div className="scroll-x-contain flex gap-2 pb-1">
              {chartOptions.map((option) => {
                const Icon = option.icon;
                const isActive = mobileChartView === option.key;

                return (
                  <motion.button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setMobileChartView(option.key)}
                    whileHover={hoverLiftSoft}
                    whileTap={tapScale}
                    transition={hoverTransition}
                    className={cn(
                      "surface-subtle flex min-w-[148px] shrink-0 items-center gap-3 rounded-[20px] px-3 py-2.5 text-left transition-all duration-200",
                      isActive
                        ? "border-primary/30 bg-primary/[0.10] text-foreground shadow-[0_18px_38px_rgba(91,102,255,0.16)]"
                        : "text-muted-foreground hover:border-white/15 hover:bg-white/[0.05]"
                    )}
                  >
                    <IconChip size="md" tone={isActive ? "primary" : "default"}>
                      <Icon className="h-4 w-4" />
                    </IconChip>
                    <div>
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={mobileChartView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: [0.2, 1, 0.22, 1] }}
                className="space-y-4"
              >
                {mobileChartView === "transfers" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <InsightTile href={transferTodayHref} label="Today" value={formatNumber(kpis.transfersToday)} />
                      <InsightTile href={transferWeekHref} label="7 days" value={formatNumber(kpis.transfersThisWeek)} />
                      <InsightTile href={peakTransferHref} label="Peak day" value={peakTransferDay.label} compact />
                    </div>
                    <ChartFrame title="Transfer activity">
                      {transferTrendData.length === 0 ? (
                        <EmptyState description="Transfer analytics will appear once stock movements are recorded." icon={TrendingUp} title="No transfer data yet" />
                      ) : (
                        <TransferTrendChart data={transferTrendData} height={240} />
                      )}
                    </ChartFrame>
                  </>
                ) : null}

                {mobileChartView === "categories" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <InsightTile href={topCategoryHref} label="Top category" value={topCategory ? topCategory.name : "-"} compact />
                      <InsightTile href={topCategoryHref} label="Count" value={topCategory ? formatNumber(topCategory.count) : "0"} />
                    </div>
                    <ChartFrame title="Category mix">
                      {categoryChartData.length === 0 ? (
                        <EmptyState description="Category distribution will appear once materials are added." icon={Layers} title="No category data yet" />
                      ) : (
                        <CategoryChart data={categoryChartData} height={230} mobile />
                      )}
                    </ChartFrame>
                  </>
                ) : null}

                {mobileChartView === "stock" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <InsightTile href={topWarehouseHref} label="Top warehouse" value={topWarehouse.code} compact />
                      <InsightTile href={topWarehouseHref} label="Stock" value={formatNumber(topWarehouse.totalStock)} />
                    </div>
                    <ChartFrame title="Warehouse stock">
                      {warehouseStockChart.length === 0 ? (
                        <EmptyState description="Warehouse stock totals will appear once materials are available." icon={BarChart3} title="No stock data yet" />
                      ) : (
                        <WarehouseStockChart data={warehouseStockChart} height={240} mobile />
                      )}
                    </ChartFrame>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                Low stock alerts
              </CardTitle>
              <Badge variant="warning">{lowStockMaterials.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {lowStockMaterials.length === 0 ? (
              <EmptyState description="All tracked materials are above their minimum stock levels." icon={AlertTriangle} title="No low stock alerts" />
            ) : (
              lowStockMaterials.map((material) => (
                <AlertRow
                  key={material.id}
                  href={getWarehouseDetailHref(material.warehouseCode, { search: material.name, status: material.status })}
                  material={material}
                />
              ))
            )}
          </CardContent>
        </Card>
      </motion.section>

      <motion.section variants={itemVariants} className="hidden gap-4 md:grid xl:grid-cols-[1.2fr_1fr]">
        <motion.div whileHover={hoverLiftSoft} transition={hoverTransition}>
          <Card className="glass-panel hover-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Transfer activity (last 7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {transferTrendData.length === 0 ? (
                <EmptyState description="Transfer analytics will appear once stock movements are recorded." icon={TrendingUp} title="No transfer data yet" />
              ) : (
                <TransferTrendChart data={transferTrendData} height={280} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={hoverLiftSoft} transition={hoverTransition}>
          <Card className="glass-panel hover-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Materials by category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryChartData.length === 0 ? (
                <EmptyState description="Category distribution will appear once materials are added." icon={Layers} title="No category data yet" />
              ) : (
                <CategoryChart data={categoryChartData} height={280} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>

      <motion.section variants={itemVariants} className="hidden gap-4 md:grid md:grid-cols-2">
        <motion.div whileHover={hoverLiftSoft} transition={hoverTransition}>
          <Card className="glass-panel hover-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Stock by warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              {warehouseStockChart.length === 0 ? (
                <EmptyState description="Warehouse stock totals will appear once materials are available." icon={BarChart3} title="No warehouse stock data yet" />
              ) : (
                <WarehouseStockChart data={warehouseStockChart} height={240} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={hoverLiftSoft} transition={hoverTransition}>
          <Card className="glass-panel hover-glow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  Low stock alerts
                </CardTitle>
                <Badge variant="warning">{lowStockMaterials.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {lowStockMaterials.length === 0 ? (
                <div className="md:col-span-2">
                  <EmptyState description="All tracked materials are above their minimum stock levels." icon={AlertTriangle} title="No low stock alerts" />
                </div>
              ) : (
                lowStockMaterials.map((material) => (
                  <AlertRow
                    key={material.id}
                    href={getWarehouseDetailHref(material.warehouseCode, { search: material.name, status: material.status })}
                    material={material}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-3.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-[1.08fr_1.08fr_0.92fr]">
        <Card className="glass-panel hover-glow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                Recent activity
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/raw-materials-history">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            {recentActivities.length === 0 ? (
              <EmptyState description="Material events will appear here after stock is created, updated, or transferred." icon={Activity} title="No recent activity yet" />
            ) : (
              recentActivities.map((activity) => (
                <ActivityRow
                  href={getMaterialHistoryHref({
                    material: activity.materialName,
                    type: activity.activityType,
                    warehouse: activity.warehouseCode,
                  })}
                  key={activity.id}
                  title={activity.materialName}
                  badgeClass={getActivityColor(activity.activityType)}
                  meta={`${getActivityLabel(activity.activityType)} / ${activity.warehouseCode}${activity.quantityChange !== null ? ` / ${activity.quantityChange > 0 ? "+" : ""}${formatNumber(activity.quantityChange)}` : ""}`}
                  subMeta={`${activity.performedBy} / ${formatDateTime(activity.createdAt)}`}
                  icon={<Activity className="h-3.5 w-3.5" />}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel hover-glow">
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
          <CardContent className="space-y-2.5 sm:space-y-3">
            {recentTransfers.length === 0 ? (
              <EmptyState description="Transfers will appear here once approved stock movements are recorded." icon={ArrowRightLeft} title="No recent transfers yet" />
            ) : (
              recentTransfers.map((transfer) => (
                <ActivityRow
                  href={getTransferHistoryHref({
                    material: transfer.materialName,
                    recipient: transfer.recipientName,
                    warehouse: transfer.warehouseCode,
                  })}
                  key={transfer.id}
                  title={transfer.materialName}
                  badgeClass="bg-sky-500/12 text-sky-300"
                  meta={`${formatNumber(transfer.quantity)} ${transfer.materialUnit} -> ${transfer.recipientName}`}
                  subMeta={`${transfer.warehouseCode} / ${transfer.createdBy} / ${formatDateTime(transfer.createdAt)}`}
                  icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel hover-glow md:col-span-2 xl:col-span-1 xl:sticky xl:top-28 xl:self-start">
          <CardHeader className="pb-2">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
              <p className="text-xs text-muted-foreground">Fast paths into the actions used most often by operations.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="h-auto w-full items-start justify-start rounded-[22px] px-4 py-4">
              <Link href="/warehouses">
                <QuickActionContent description="Select a warehouse and move into material-level work." icon={Warehouse} title="Go to warehouses" />
              </Link>
            </Button>

            {canCreateMaterials && hasWarehouses ? (
              <WarehouseActionPicker
                action="add-material"
                warehouses={warehouseOptions}
                trigger={
                  <Button variant="outline" className="h-auto w-full items-start justify-start rounded-[22px] px-4 py-4">
                    <QuickActionContent description="Add stock into a warehouse record." icon={Plus} title="Add raw material" />
                  </Button>
                }
              />
            ) : null}

            {canCreateTransfers && hasWarehouses ? (
              <WarehouseActionPicker
                action="transfer"
                warehouses={warehouseOptions}
                trigger={
                  <Button variant="outline" className="h-auto w-full items-start justify-start rounded-[22px] px-4 py-4">
                    <QuickActionContent description="Deduct approved stock and log the movement." icon={ArrowRightLeft} title="Make transfer" />
                  </Button>
                }
              />
            ) : null}

            <Button asChild variant="outline" className="h-auto w-full items-start justify-start rounded-[22px] px-4 py-4">
              <Link href="/transfer-history">
                <QuickActionContent description="Audit every outbound quantity." icon={Clock} title="Transfer history" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.section>
    </motion.div>
  );
}

function MetricCard({
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
  value: number;
}) {
  const toneClasses: Record<string, string> = {
    amber: "amber",
    blue: "blue",
    cyan: "cyan",
    emerald: "emerald",
    indigo: "primary",
    red: "danger",
    slate: "slate",
    violet: "violet",
  };

  const content = (
    <Card className="glass-panel hover-glow h-full overflow-hidden">
      <CardContent className="flex min-h-[138px] flex-col justify-between sm:min-h-[148px]">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[9rem] text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:max-w-[10rem]">
            {label}
          </p>
          <IconChip
            size="lg"
            tone={toneClasses[tone] as "amber" | "blue" | "cyan" | "danger" | "emerald" | "primary" | "slate" | "violet"}
            className="h-11 w-11 rounded-[18px] sm:h-12 sm:w-12 sm:rounded-[20px]"
          >
            <Icon className="h-4 w-4" />
          </IconChip>
        </div>
        <p className="text-[clamp(2rem,8vw,2.55rem)] font-semibold tracking-[-0.04em]">{formatNumber(value)}</p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[26px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
      {content}
    </Link>
  );
}

function MetricPill({
  href,
  label,
  tone = "default",
  value,
}: {
  href?: string;
  label: string;
  tone?: "amber" | "blue" | "default" | "emerald";
  value: number | string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    blue: "text-sky-300",
  };

  const content = (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3 sm:rounded-[20px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-base font-semibold sm:text-lg ${tones[tone]}`}>{value}</p>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      {content}
    </Link>
  );
}

function InsightTile({
  compact = false,
  href,
  label,
  value,
}: {
  compact?: boolean;
  href?: string;
  label: string;
  value: string;
}) {
  const content = (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 sm:rounded-[20px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-semibold", compact ? "text-sm" : "text-base")}>{value}</p>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
      {content}
    </Link>
  );
}

function ChartFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 p-3.5 sm:rounded-[24px] sm:p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function TransferTrendChart({
  data,
  height,
}: {
  data: DashboardData["transferTrendData"];
  height: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dashboard-transfer-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(250 95% 70%)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="hsl(250 95% 70%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
        <RechartsTooltip contentStyle={chartTooltipStyle} />
        <Area dataKey="count" type="monotone" stroke="hsl(250 95% 70%)" fill="url(#dashboard-transfer-fill)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CategoryChart({
  data,
  height,
  mobile = false,
}: {
  data: DashboardData["categoryChartData"];
  height: number;
  mobile?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.48)" />
        <YAxis
          dataKey="name"
          type="category"
          width={mobile ? 88 : 118}
          tick={{ fontSize: 10 }}
          stroke="rgba(255,255,255,0.48)"
          tickFormatter={(value) => truncateLabel(String(value), mobile ? 10 : 14)}
        />
        <RechartsTooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="count" radius={[0, 10, 10, 0]}>
          {data.map((_, index) => (
            <Cell key={`category-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function WarehouseStockChart({
  data,
  height,
  mobile = false,
}: {
  data: DashboardData["warehouseStockChart"];
  height: number;
  mobile?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          stroke="rgba(255,255,255,0.48)"
          interval="preserveStartEnd"
          minTickGap={mobile ? 12 : 24}
          tickFormatter={(value) => truncateLabel(String(value), mobile ? 7 : 8)}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="rgba(255,255,255,0.48)"
          tickFormatter={(value) => formatNumber(Number(value))}
        />
        <RechartsTooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="totalStock" fill="hsl(146 76% 52%)" radius={[8, 8, 0, 0]} name="Total stock" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AlertRow({
  href,
  material,
}: {
  href?: string;
  material: DashboardData["lowStockMaterials"][number];
}) {
  const prefersReducedMotion = useReducedMotion();

  const content = (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { x: 2 }}
      transition={hoverTransition}
      className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{material.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {material.warehouseCode} / {material.category}
          </p>
        </div>
        <Badge variant={material.status === "OUT_OF_STOCK" ? "danger" : "warning"}>
          {formatNumber(material.currentStock)} / {formatNumber(material.minimumStock)} {material.baseUnit}
        </Badge>
      </div>
    </motion.div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
      {content}
    </Link>
  );
}

function ActivityRow({
  badgeClass,
  href,
  icon,
  meta,
  subMeta,
  title,
}: {
  badgeClass: string;
  href?: string;
  icon: React.ReactNode;
  meta: string;
  subMeta: string;
  title: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const content = (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { x: 2, y: -1 }}
      transition={hoverTransition}
      className="flex items-start gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3"
    >
      <div className={`mt-0.5 rounded-xl p-2 ${badgeClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">{subMeta}</p>
      </div>
    </motion.div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
      {content}
    </Link>
  );
}

function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
      <div className="mb-4 rounded-2xl bg-white/[0.04] p-3 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
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
      <IconChip size="md" tone="primary">
        <Icon className="h-4 w-4" />
      </IconChip>
      <div className="text-left">
        <p className="text-sm font-semibold normal-case tracking-normal">{title}</p>
        <p className="mt-1 text-xs normal-case tracking-normal text-muted-foreground">{description}</p>
      </div>
    </>
  );
}
