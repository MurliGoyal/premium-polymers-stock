import { AppShell } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  const warehouses = hasPermission(session.user.role, "raw_materials:view")
    ? await prisma.warehouse.findMany({
        orderBy: { code: "asc" },
        select: { code: true, name: true, slug: true },
      })
    : [];

  const normalizedName =
    session.user.name?.trim() ||
    session.user.email?.split("@")[0]?.trim() ||
    "User";
  const normalizedEmail = session.user.email?.trim() || "no-email@local.invalid";
  const normalizedRole = session.user.role?.trim() || "VIEWER";

  return (
    <AppShell
      user={{
        email: normalizedEmail,
        name: normalizedName,
        role: normalizedRole,
      }}
      warehouses={warehouses}
    >
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
