"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINISHED_GOODS_WAREHOUSES } from "@/lib/constants";
import { getRoleColor, getRoleLabel } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { createUser, deleteUser } from "../actions";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  finishedGoodsWarehouseCode: string | null;
  isActive: boolean;
  createdAt: string;
};

export function UsersClient({ users, canManage, currentUserId }: { users: UserData[]; canManage: boolean; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [finishedGoodsWarehouseCode, setFinishedGoodsWarehouseCode] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const isFinishedGoodsManagerRole = role === "FINISHED_GOODS_MANAGER";

  const handleCreate = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        await createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          finishedGoodsWarehouseCode: isFinishedGoodsManagerRole ? finishedGoodsWarehouseCode : undefined,
        });
        toast.success("User created successfully");
        setShowAdd(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole("VIEWER");
        setFinishedGoodsWarehouseCode("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create user");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteUserId) return;

    startTransition(async () => {
      try {
        await deleteUser(deleteUserId);
        toast.success("User deleted successfully");
        setDeleteUserId(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete user");
      }
    });
  };

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
        description="View team members and their assigned roles."
        badge={<Badge variant="secondary">{users.length} users</Badge>}
        actions={canManage ? (
          <Button type="button" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        ) : undefined}
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
                <Card key={user.id} className="rounded-2xl sm:rounded-[24px]">
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
                      {user.finishedGoodsWarehouseCode ? (
                        <Badge variant="outline">{user.finishedGoodsWarehouseCode}</Badge>
                      ) : null}
                      <Badge variant="outline">{formatDate(user.createdAt)}</Badge>
                    </div>
                    {canManage ? (
                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={user.id === currentUserId}
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
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
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className={getRoleColor(user.role)}>
                            <Shield className="mr-1 h-3 w-3" />
                            {getRoleLabel(user.role)}
                          </Badge>
                          {user.finishedGoodsWarehouseCode ? (
                            <Badge variant="outline">{user.finishedGoodsWarehouseCode}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "success" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={user.id === currentUserId}
                            onClick={() => setDeleteUserId(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <Dialog open={showAdd && canManage} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Create a new user account and assign a role.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John Doe"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="john@premiumpolymers.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  setRole(value);
                  if (value !== "FINISHED_GOODS_MANAGER") {
                    setFinishedGoodsWarehouseCode("");
                  }
                }}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Manager (Admin)</SelectItem>
                  <SelectItem value="FINISHED_GOODS_MANAGER">Finished Goods Manager</SelectItem>
                  <SelectItem value="STOCK_MANAGEMENT">Operator (Stock Management)</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isFinishedGoodsManagerRole ? (
              <div className="space-y-2">
                <Label htmlFor="user-fg-warehouse">Finished Goods Warehouse</Label>
                <Select value={finishedGoodsWarehouseCode} onValueChange={setFinishedGoodsWarehouseCode}>
                  <SelectTrigger id="user-fg-warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISHED_GOODS_WAREHOUSES.map((warehouse) => (
                      <SelectItem key={warehouse.code} value={warehouse.code}>
                        {warehouse.code} / {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !name.trim() || !email.trim() || !password.trim() || (isFinishedGoodsManagerRole && !finishedGoodsWarehouseCode)}
            >
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUserId && canManage} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
