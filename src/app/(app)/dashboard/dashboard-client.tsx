"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Package, Layers, BarChart3, AlertTriangle, ArrowRightLeft,
  Warehouse, TrendingUp, Plus, Clock, Activity, ArrowRight, OctagonAlert,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Area, AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatDateTime, getActivityLabel, getActivityColor } from "@/lib/utils";

type DashboardData = Awaited<ReturnType<typeof import("./actions").getDashboardData>>;

const CHART_COLORS = [
  "hsl(252, 60%, 55%)", "hsl(172, 55%, 45%)", "hsl(33, 80%, 55%)",
  "hsl(210, 60%, 50%)", "hsl(340, 60%, 55%)", "hsl(142, 50%, 45%)",
  "hsl(280, 50%, 55%)", "hsl(200, 60%, 50%)",
];

function CountUp({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {formatNumber(value)}
      </motion.span>
    </motion.span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export function DashboardClient({ data }: { data: DashboardData }) {
  const { kpis, warehouseOverview, recentTransfers, recentActivities, categoryChartData, warehouseStockChart, transferTrendData, lowStockMaterials } = data;

  const kpiCards = [
    { label: "Total Materials", value: kpis.totalMaterials, icon: Package, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400" },
    { label: "Categories", value: kpis.totalCategories, icon: Layers, color: "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400" },
    { label: "Total Stock", value: kpis.totalStock, icon: BarChart3, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400" },
    { label: "Low Stock", value: kpis.lowStockItems, icon: AlertTriangle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400" },
    { label: "Transfers Today", value: kpis.transfersToday, icon: ArrowRightLeft, color: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400" },
    { label: "Transfers (7d)", value: kpis.transfersThisWeek, icon: TrendingUp, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-400" },
    { label: "Warehouses", value: kpis.warehouseCount, icon: Warehouse, color: "text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400" },
    { label: "Out of Stock", value: kpis.outOfStockItems, icon: OctagonAlert, color: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400" },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Page header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of your stock management system</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/warehouses"><Warehouse className="mr-1.5 h-4 w-4" />Warehouses</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/warehouses"><Plus className="mr-1.5 h-4 w-4" />Add Material</Link>
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <motion.div key={kpi.label} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  <CountUp value={kpi.value} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Warehouse Overview Cards */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold mb-3">Warehouse Overview</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {warehouseOverview.map((w) => (
            <Card key={w.id} className="hover:shadow-md transition-all duration-200 group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <Warehouse className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{w.code}</h3>
                      <p className="text-xs text-muted-foreground">{w.name}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="ghost" className="opacity-60 group-hover:opacity-100 transition-opacity">
                    <Link href={`/warehouses/${w.slug}`}>
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{w.totalMaterials}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Materials</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-emerald-600">{formatNumber(Math.round(w.totalStock))}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Stock</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-amber-600">{w.lowStockCount}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Low Stock</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold text-blue-600">{w.recentTransfers}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Transfers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Transfer Trend */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Transfer Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={transferTrendData}>
                  <defs>
                    <linearGradient id="colorTransfers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(252, 60%, 55%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(252, 60%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(252, 60%, 55%)" fill="url(#colorTransfers)" strokeWidth={2} name="Transfers" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Distribution */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Materials by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Materials">
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Warehouse Stock Chart + Low Stock Alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Warehouse Stock */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Stock by Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={warehouseStockChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="totalMaterials" fill="hsl(252, 60%, 55%)" radius={[4, 4, 0, 0]} name="Materials" />
                  <Bar dataKey="lowStock" fill="hsl(33, 80%, 55%)" radius={[4, 4, 0, 0]} name="Low Stock" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Low Stock Alerts */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Low Stock Alerts
                </CardTitle>
                <Badge variant="warning" className="text-[10px]">{lowStockMaterials.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {lowStockMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">All stock levels are healthy</p>
                ) : (
                  lowStockMaterials.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">{m.warehouseCode} · {m.category}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <Badge variant={m.status === "OUT_OF_STOCK" ? "danger" : "warning"} className="text-[10px]">
                          {m.currentStock} / {m.minimumStock} {m.baseUnit}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity + Recent Transfers + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${getActivityColor(a.activityType)}`}>
                      <Activity className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.materialName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {getActivityLabel(a.activityType)} · {a.warehouseCode}
                        {a.quantityChange ? ` · ${a.quantityChange > 0 ? "+" : ""}${a.quantityChange}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{a.performedBy} · {formatDateTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transfers */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  Recent Transfers
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                  <Link href="/transfer-history">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTransfers.map((t) => (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="p-1.5 rounded-md mt-0.5 shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <ArrowRightLeft className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.materialName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.quantity} {t.materialUnit} → {t.recipientName}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{t.warehouseCode} · {t.createdBy} · {formatDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start h-11 group">
                <Link href="/warehouses">
                  <Warehouse className="mr-3 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Go to Warehouses</p>
                    <p className="text-[10px] text-muted-foreground">Select a warehouse to manage</p>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-11 group">
                <Link href="/warehouses">
                  <Plus className="mr-3 h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Add Raw Material</p>
                    <p className="text-[10px] text-muted-foreground">Add new stock to a warehouse</p>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-11 group">
                <Link href="/warehouses">
                  <ArrowRightLeft className="mr-3 h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Make Transfer</p>
                    <p className="text-[10px] text-muted-foreground">Transfer stock to a recipient</p>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start h-11 group">
                <Link href="/transfer-history">
                  <Clock className="mr-3 h-4 w-4 text-violet-600 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Transfer History</p>
                    <p className="text-[10px] text-muted-foreground">View all past transfers</p>
                  </div>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
