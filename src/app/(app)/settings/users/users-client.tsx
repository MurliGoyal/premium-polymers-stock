"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRoleColor, getRoleLabel } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

type UserData = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };

export function UsersClient({ users }: { users: UserData[] }) {
  const router = useRouter();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span>Settings</span>
        <span>/</span>
        <span className="font-medium text-foreground">Users</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Settings"
        title="Users"
        description="Role visibility for the internal team without collapsing the list into unreadable columns on phones."
        badge={<Badge variant="secondary">{users.length} users</Badge>}
      />

      <Card className="overflow-hidden">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No users found</h3>
            <p className="mt-1 text-sm text-muted-foreground">No internal accounts are available to display right now. Refresh the page or return to the dashboard.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => router.refresh()}>
                Refresh
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
              {users.map((user) => (
                <Card key={user.id} className="rounded-[24px]">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{user.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant={user.isActive ? "success" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={getRoleColor(user.role)}>
                        <Shield className="mr-1 h-3 w-3" />
                        {getRoleLabel(user.role)}
                      </Badge>
                      <Badge variant="outline">{formatDate(user.createdAt)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden xl:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getRoleColor(user.role)}>
                          <Shield className="mr-1 h-3 w-3" />
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "success" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}
