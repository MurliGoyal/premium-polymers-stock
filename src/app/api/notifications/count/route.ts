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
    const unreadCount = await prisma.notification.count({ where: { isRead: false } });
    return jsonSuccess({ unreadCount });
  } catch {
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
