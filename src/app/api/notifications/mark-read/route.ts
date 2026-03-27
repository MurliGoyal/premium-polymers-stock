import { getServerAuthSession } from "@/lib/auth";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return jsonError(
      { code: "UNAUTHORIZED", message: "Unauthorized", retryable: false },
      { status: 401 }
    );
  }

  if (!hasPermission(session.user.role, "raw_materials:view")) {
    return jsonSuccess({
      markedIds: [],
      unreadCount: 0,
    });
  }

  let payload: { ids?: string[]; markAll?: boolean } = {};

  try {
    payload = (await request.json()) as { ids?: string[]; markAll?: boolean };
  } catch {
    payload = {};
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  if (!payload.markAll && ids.length === 0) {
    return jsonError(
      {
        code: "NO_NOTIFICATIONS_SELECTED",
        message: "Select at least one notification to mark as read.",
        retryable: false,
      },
      { status: 400 }
    );
  }

  try {
    const where = payload.markAll ? { isRead: false } : { id: { in: ids } };

    await prisma.notification.updateMany({
      data: { isRead: true },
      where,
    });

    const unreadCount = await prisma.notification.count({ where: { isRead: false } });

    return jsonSuccess({
      markedIds: payload.markAll ? [] : ids,
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to mark notifications as read", error);
    return jsonError(
      {
        code: "MARK_READ_FAILED",
        message: "Notifications could not be updated right now.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
