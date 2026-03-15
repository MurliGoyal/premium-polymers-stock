import { AppShell } from "@/components/layout/app-shell";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
