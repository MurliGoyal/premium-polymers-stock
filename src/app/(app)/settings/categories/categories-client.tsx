"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Tag, Trash2 } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { addCategory, deleteCategory } from "../actions";

type CategoryData = { id: string; name: string; slug: string; materialCount: number; createdAt: string };

export function CategoriesClient({ categories, canManage }: { categories: CategoryData[]; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        const result = await addCategory(newName.trim());
        toast.success(result.created ? "Category added" : "Category already existed");
        setNewName("");
        setShowAdd(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add category");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success("Category deleted");
        setDeleteId(null);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Cannot delete");
        setDeleteId(null);
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span>Settings</span>
        <span>/</span>
        <span className="font-medium text-foreground">Categories</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Settings"
        title="Categories"
        description="Manage shared categories used to organize materials."
        badge={<Badge variant="secondary">{categories.length} categories</Badge>}
        actions={canManage ? (
          <Button type="button" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        ) : undefined}
      />

      <Card className="overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Tag className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No categories yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create the first shared material category to organize new stock records.</p>
            {canManage ? (
              <Button type="button" onClick={() => setShowAdd(true)} className="mt-4">
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 xl:hidden">
              {categories.map((category) => (
                <Card key={category.id} className="rounded-2xl sm:rounded-[24px]">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{category.name}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{category.slug}</p>
                      </div>
                      <Badge variant="secondary">{category.materialCount} materials</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatDate(category.createdAt)}</span>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(category.id)}
                          disabled={category.materialCount > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      ) : null}
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
                    <TableHead>Slug</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{category.materialCount}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(category.createdAt)}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(category.id)}
                            disabled={category.materialCount > 0}
                            aria-label={category.materialCount > 0 ? "Has linked materials" : "Delete"}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
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
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>Create a reusable category for future raw material records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="new-category" className="text-sm font-medium text-foreground">
              Category name
            </label>
            <Input
              id="new-category"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Barrier film"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || isPending}>
              <Tag className="h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId && canManage} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
