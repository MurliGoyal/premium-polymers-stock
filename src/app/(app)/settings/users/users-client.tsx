"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRoleColor, getRoleLabel } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

type UserData = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };

export function UsersClient({ users }: { users: UserData[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-5">
      <ResponsivePageHeader
        eyebrow="Settings"
        title="Users"
        description="Role visibility for the internal team without collapsing the list into unreadable columns on phones."
        badge={<Badge variant="secondary">{users.length} users</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 p-4 lg:hidden">
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

        <div className="hidden lg:block">
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
      </Card>
    </motion.div>
  );
}
