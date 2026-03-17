"use server";

import { MaterialStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertServerPermission } from "@/lib/auth";
import { SEEDED_WAREHOUSE_CODES } from "@/lib/constants";
import { quantityToNumber, sumQuantities } from "@/lib/quantities";
import { formatAppDayLabel, getAppDateKey, getAppStartOfDay } from "@/lib/utils";

function getWarehouseSortIndex(code: string) {
  return SEEDED_WAREHOUSE_CODES.indexOf(code as (typeof SEEDED_WAREHOUSE_CODES)[number]);
}

export async function getDashboardData() {
  await assertServerPermission("dashboard:view");

  const now = new Date();
  const startToday = getAppStartOfDay(now);
  const sevenDaysAgo = new Date(startToday);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

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
  const trendBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo);
    date.setUTCDate(date.getUTCDate() + index);

    return {
      count: 0,
      date,
      key: getAppDateKey(date),
      label: formatAppDayLabel(date),
      quantity: 0,
    };
  });
  const trendMap = new Map(trendBuckets.map((bucket) => [bucket.key, bucket]));

  for (const t of transferTrend) {
    const key = getAppDateKey(t.createdAt);
    const bucket = trendMap.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.quantity += quantityToNumber(t.quantity);
    }
  }
  const transferTrendData = trendBuckets.map((bucket) => ({
    date: bucket.key,
    label: bucket.label,
    count: bucket.count,
    quantity: bucket.quantity,
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
      totalStock: quantityToNumber(sumQuantities(w.rawMaterials.map((material) => material.currentStock))),
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
    totalStock: w.totalStock,
    lowStock: w.lowStockCount,
  }));

  return {
    kpis: {
      totalMaterials,
      totalCategories,
      totalStock: quantityToNumber(totalStock._sum.currentStock),
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
      quantity: quantityToNumber(t.quantity),
      createdBy: t.createdBy?.name || "System",
      createdAt: t.createdAt.toISOString(),
    })),
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      materialName: a.rawMaterial.name,
      warehouseCode: a.warehouse.code,
      activityType: a.activityType,
      quantityChange: a.quantityChange === null ? null : quantityToNumber(a.quantityChange),
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
      currentStock: quantityToNumber(m.currentStock),
      minimumStock: quantityToNumber(m.minimumStock),
      baseUnit: m.baseUnit,
      status: m.status,
    })),
  };
}
