import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "No notifications selected" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    data: { isRead: true },
    where: payload.markAll ? { isRead: false } : { id: { in: ids } },
  });

  const unreadCount = await prisma.notification.count({ where: { isRead: false } });

  return NextResponse.json({ success: true, unreadCount });
}
