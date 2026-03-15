"use server";

import { MaterialStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEEDED_WAREHOUSE_CODES } from "@/lib/constants";
import { daysAgo, startOfDay } from "@/lib/inventory";

function getWarehouseSortIndex(code: string) {
  return SEEDED_WAREHOUSE_CODES.indexOf(code as (typeof SEEDED_WAREHOUSE_CODES)[number]);
}

export async function getDashboardData() {
  const now = new Date();
  const startToday = startOfDay(now);
  const sevenDaysAgo = daysAgo(6, now);

  const [
    totalMaterials,
    totalCategories,
    lowStockItems,
    outOfStockItems,
    warehouseCount,
    totalStock,
    transfersToday,
    transfersThisWeek,
    warehouses,
    recentTransfers,
    recentActivities,
    categoryDistribution,
    transferTrend,
    lowStockMaterials,
    unreadNotifications,
  ] = await Promise.all([
    prisma.rawMaterial.count({
      where: { warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } } },
    }),
    prisma.category.count(),
    prisma.rawMaterial.count({
      where: {
        status: MaterialStatus.LOW_STOCK,
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
    }),
    prisma.rawMaterial.count({
      where: {
        status: MaterialStatus.OUT_OF_STOCK,
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
    }),
    prisma.warehouse.count({ where: { code: { in: SEEDED_WAREHOUSE_CODES } } }),
    prisma.rawMaterial.aggregate({
      _sum: { currentStock: true },
      where: { warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } } },
    }),
    prisma.transfer.count({
      where: {
        createdAt: { gte: startToday },
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
    }),
    prisma.transfer.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
    }),
    prisma.warehouse.findMany({
      where: { code: { in: SEEDED_WAREHOUSE_CODES } },
      include: {
        rawMaterials: { select: { id: true, status: true, currentStock: true } },
        transfers: {
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { id: true },
        },
      },
    }),
    prisma.transfer.findMany({
      take: 5,
      where: { warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } } },
      orderBy: { createdAt: "desc" },
      include: {
        rawMaterial: { select: { name: true, baseUnit: true } },
        warehouse: { select: { code: true } },
        recipient: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.rawMaterialActivityLog.findMany({
      take: 8,
      where: { warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } } },
      orderBy: { createdAt: "desc" },
      include: {
        rawMaterial: { select: { name: true } },
        warehouse: { select: { code: true } },
        performedBy: { select: { name: true } },
      },
    }),
    prisma.category.findMany({
      include: { _count: { select: { rawMaterials: true } } },
      orderBy: { rawMaterials: { _count: "desc" } },
      take: 8,
    }),
    // Transfer trend for last 7 days
    prisma.transfer.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
      select: { createdAt: true, quantity: true },
    }),
    prisma.rawMaterial.findMany({
      where: {
        status: { in: [MaterialStatus.LOW_STOCK, MaterialStatus.OUT_OF_STOCK] },
        warehouse: { code: { in: SEEDED_WAREHOUSE_CODES } },
      },
      include: {
        warehouse: { select: { code: true } },
        category: { select: { name: true } },
      },
      orderBy: { currentStock: "asc" },
      take: 10,
    }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  // Process transfer trend by day
  const trendMap: Record<string, { count: number; quantity: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i, now);
    const key = d.toISOString().split("T")[0];
    trendMap[key] = { count: 0, quantity: 0 };
  }
  for (const t of transferTrend) {
    const key = new Date(t.createdAt).toISOString().split("T")[0];
    if (trendMap[key]) {
      trendMap[key].count++;
      trendMap[key].quantity += t.quantity;
    }
  }
  const transferTrendData = Object.entries(trendMap).map(([date, val]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
    count: val.count,
    quantity: Math.round(val.quantity),
  }));

  // Warehouse overview
  const warehouseOverview = warehouses
    .sort((left, right) => getWarehouseSortIndex(left.code) - getWarehouseSortIndex(right.code))
    .map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      slug: w.slug,
      totalMaterials: w.rawMaterials.length,
      lowStockCount: w.rawMaterials.filter((m) => m.status === MaterialStatus.LOW_STOCK).length,
      outOfStockCount: w.rawMaterials.filter((m) => m.status === MaterialStatus.OUT_OF_STOCK).length,
      totalStock: w.rawMaterials.reduce((sum, m) => sum + m.currentStock, 0),
      recentTransfers: w.transfers.length,
    }));

  // Category distribution for chart
  const categoryChartData = categoryDistribution.map((c) => ({
    name: c.name,
    count: c._count.rawMaterials,
  }));

  // Stock by warehouse for chart
  const warehouseStockChart = warehouseOverview.map((w) => ({
    name: w.code,
    totalMaterials: w.totalMaterials,
    totalStock: Math.round(w.totalStock),
    lowStock: w.lowStockCount,
  }));

  return {
    kpis: {
      totalMaterials,
      totalCategories,
      totalStock: Math.round(totalStock._sum.currentStock || 0),
      lowStockItems,
      outOfStockItems,
      transfersToday,
      transfersThisWeek,
      warehouseCount,
      unreadNotifications,
    },
    warehouseOverview,
    recentTransfers: recentTransfers.map((t) => ({
      id: t.id,
      materialName: t.rawMaterial.name,
      materialUnit: t.rawMaterial.baseUnit,
      warehouseCode: t.warehouse.code,
      recipientName: t.recipient.name,
      quantity: t.quantity,
      createdBy: t.createdBy?.name || "System",
      createdAt: t.createdAt.toISOString(),
    })),
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      materialName: a.rawMaterial.name,
      warehouseCode: a.warehouse.code,
      activityType: a.activityType,
      quantityChange: a.quantityChange,
      performedBy: a.performedBy?.name || "System",
      createdAt: a.createdAt.toISOString(),
    })),
    categoryChartData,
    warehouseStockChart,
    transferTrendData,
    lowStockMaterials: lowStockMaterials.map((m) => ({
      id: m.id,
      name: m.name,
      warehouseCode: m.warehouse.code,
      category: m.category.name,
      currentStock: m.currentStock,
      minimumStock: m.minimumStock,
      baseUnit: m.baseUnit,
      status: m.status,
    })),
  };
}
