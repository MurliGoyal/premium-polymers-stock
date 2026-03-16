import { getServerAuthSession } from "@/lib/auth";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return jsonError(
      { code: "UNAUTHORIZED", message: "Unauthorized", retryable: false },
      { status: 401 }
    );
  }

  try {
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

    return jsonSuccess({
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
  } catch {
    return jsonError(
      {
        code: "NOTIFICATIONS_FETCH_FAILED",
        message: "Notifications could not be loaded right now.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
