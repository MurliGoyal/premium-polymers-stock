"use client";

import { motion } from "framer-motion";
import { Users, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getRoleLabel, getRoleColor } from "@/lib/rbac";

type UserData = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };

export function UsersClient({ users }: { users: UserData[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage system users and roles</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${getRoleColor(u.role)}`}>
                      <Shield className="h-2.5 w-2.5 mr-1" /> {getRoleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "success" : "secondary"} className="text-[10px]">
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
