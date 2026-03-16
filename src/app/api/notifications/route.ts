import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      include: {
        rawMaterial: { select: { name: true } },
        warehouse: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      createdAt: notification.createdAt.toISOString(),
      id: notification.id,
      isRead: notification.isRead,
      message: notification.message,
      rawMaterialName: notification.rawMaterial?.name ?? null,
      type: notification.type,
      warehouseCode: notification.warehouse?.code ?? null,
    })),
    unreadCount,
  });
}
