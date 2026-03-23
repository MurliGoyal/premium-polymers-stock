"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Tag, Trash2 } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils";
import { addCategory, deleteCategory, addSubcategory, deleteSubcategory } from "../actions";

type SubcategoryData = { id: string; name: string; slug: string; materialCount: number };
type CategoryData = { id: string; name: string; slug: string; materialCount: number; createdAt: string; subcategories: SubcategoryData[] };

export function CategoriesClient({ categories }: { categories: CategoryData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"category" | "subcategory">("category");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddSub, setShowAddSub] = useState(false);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  const toggleExpand = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleAddSub = () => {
    if (!newSubName.trim() || !subCategoryId) return;
    startTransition(async () => {
      try {
        const result = await addSubcategory(subCategoryId, newSubName.trim());
        toast.success(result.created ? "Subcategory added" : "Subcategory already existed");
        setNewSubName("");
        setShowAddSub(false);
        setSubCategoryId(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add subcategory");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        if (deleteType === "subcategory") {
          await deleteSubcategory(id);
          toast.success("Subcategory deleted");
        } else {
          await deleteCategory(id);
          toast.success("Category deleted");
        }
        setDeleteId(null);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Cannot delete");
        setDeleteId(null);
      }
    });
  };

  const openAddSub = (categoryId: string) => {
    setSubCategoryId(categoryId);
    setNewSubName("");
    setShowAddSub(true);
  };

  const openDeleteSub = (id: string) => {
    setDeleteType("subcategory");
    setDeleteId(id);
  };

  const openDeleteCat = (id: string) => {
    setDeleteType("category");
    setDeleteId(id);
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
        actions={
          <Button type="button" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Tag className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No categories yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create the first shared material category to organize new stock records.</p>
            <Button type="button" onClick={() => setShowAdd(true)} className="mt-4">
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
              {categories.map((category) => (
                <Card key={category.id} className="rounded-2xl sm:rounded-[24px]">
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{category.name}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{category.slug}</p>
                      </div>
                      <Badge variant="secondary">{category.materialCount} materials</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatDate(category.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openAddSub(category.id)}>
                          <Plus className="h-3.5 w-3.5" />
                          Sub
                        </Button>
                        <DeleteButton
                          disabled={category.materialCount > 0 || category.subcategories.length > 0}
                          onDelete={() => openDeleteCat(category.id)}
                          tooltip={category.subcategories.length > 0 ? "Delete subcategories first" : "Has linked materials"}
                        />
                      </div>
                    </div>
                    {category.subcategories.length > 0 ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(category.id)}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {expandedCategories.has(category.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {category.subcategories.length} subcategories
                        </button>
                        {expandedCategories.has(category.id) ? (
                          <div className="space-y-1.5 pl-4">
                            {category.subcategories.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium">{sub.name}</p>
                                  <p className="text-xs text-muted-foreground">{sub.materialCount} materials</p>
                                </div>
                                <DeleteButton
                                  disabled={sub.materialCount > 0}
                                  onDelete={() => openDeleteSub(sub.id)}
                                  tooltip="Has linked materials"
                                  compact
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
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
                    <TableHead>Slug</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Subcategories</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <Fragment key={category.id}>
                      <TableRow key={category.id}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => category.subcategories.length > 0 && toggleExpand(category.id)}
                            className="flex items-center gap-1.5 font-medium"
                          >
                            {category.subcategories.length > 0 ? (
                              expandedCategories.has(category.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : <span className="w-3.5" />}
                            {category.name}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{category.materialCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{category.subcategories.length}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(category.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openAddSub(category.id)}>
                              <Plus className="h-3.5 w-3.5" />
                              Sub
                            </Button>
                            <DeleteButton
                              compact
                              disabled={category.materialCount > 0 || category.subcategories.length > 0}
                              onDelete={() => openDeleteCat(category.id)}
                              tooltip={category.subcategories.length > 0 ? "Delete subcategories first" : "Has linked materials"}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedCategories.has(category.id) && category.subcategories.map((sub) => (
                        <TableRow key={sub.id} className="bg-muted/10">
                          <TableCell className="pl-12">
                            <span className="text-sm">{sub.name}</span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{sub.slug}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sub.materialCount}</Badge>
                          </TableCell>
                          <TableCell />
                          <TableCell />
                          <TableCell>
                            <DeleteButton
                              compact
                              disabled={sub.materialCount > 0}
                              onDelete={() => openDeleteSub(sub.id)}
                              tooltip="Has linked materials"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
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

      <Dialog open={showAddSub} onOpenChange={setShowAddSub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add subcategory</DialogTitle>
            <DialogDescription>Create a subcategory under the selected category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="new-subcategory" className="text-sm font-medium text-foreground">
              Subcategory name
            </label>
            <Input
              id="new-subcategory"
              value={newSubName}
              onChange={(event) => setNewSubName(event.target.value)}
              placeholder="High Density"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && handleAddSub()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSub(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSub} disabled={!newSubName.trim() || isPending}>
              <Tag className="h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteType}?</DialogTitle>
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

function DeleteButton({
  compact,
  disabled,
  onDelete,
  tooltip = "Has linked materials",
}: {
  compact?: boolean;
  disabled: boolean;
  onDelete: () => void;
  tooltip?: string;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={disabled}
      className={compact ? "h-9 w-9" : "h-10 w-10"}
      aria-label={disabled ? tooltip : "Delete"}
    >
      <Trash2 className="h-4 w-4 text-muted-foreground" />
    </Button>
  );

  if (!disabled) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
