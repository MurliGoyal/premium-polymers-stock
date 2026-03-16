import { AppShell } from "@/components/layout/app-shell";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  const warehouses = await prisma.warehouse.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true, slug: true },
  });

  return (
    <AppShell
      user={{
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
      warehouses={warehouses}
    >
      {children}
    </AppShell>
  );
}
