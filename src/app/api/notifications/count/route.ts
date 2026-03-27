import { getServerAuthSession } from "@/lib/auth";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return jsonError(
      { code: "UNAUTHORIZED", message: "Unauthorized", retryable: false },
      { status: 401 }
    );
  }

  if (!hasPermission(session.user.role, "raw_materials:view")) {
    return jsonSuccess({ unreadCount: 0 });
  }

  try {
    const unreadCount = await prisma.notification.count({ where: { isRead: false } });
    return jsonSuccess({ unreadCount });
  } catch (error) {
    console.error("Failed to load notification count", error);
    return jsonError(
      {
        code: "NOTIFICATION_COUNT_FAILED",
        message: "Notification count could not be loaded right now.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
