"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils";
import { addRecipient, deleteRecipient } from "../actions";

type RecipientData = { id: string; name: string; transferCount: number; createdAt: string };

export function RecipientsClient({ recipients }: { recipients: RecipientData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        const result = await addRecipient(newName.trim());
        toast.success(result.created ? "Recipient added" : "Recipient already existed");
        setNewName("");
        setShowAdd(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add recipient");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteRecipient(id);
        toast.success("Recipient deleted");
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
        <span className="font-medium text-foreground">Recipients</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Settings"
        title="Recipients"
        description="Reusable destinations for transfer flows, delivery logs, and downstream audits."
        badge={<Badge variant="secondary">{recipients.length} recipients</Badge>}
        actions={
          <Button type="button" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add recipient
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {recipients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <UserCheck className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No recipients yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create reusable destinations for transfer and delivery workflows.</p>
            <Button type="button" onClick={() => setShowAdd(true)} className="mt-4">
              <Plus className="h-4 w-4" />
              Add recipient
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
              {recipients.map((recipient) => (
                <Card key={recipient.id} className="rounded-[24px]">
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{recipient.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(recipient.createdAt)}</p>
                      </div>
                      <Badge variant="secondary">{recipient.transferCount} transfers</Badge>
                    </div>
                    <div className="flex justify-end">
                      <DeleteRecipientButton
                        disabled={recipient.transferCount > 0}
                        onDelete={() => setDeleteId(recipient.id)}
                      />
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
                    <TableHead>Transfers</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="font-medium">{recipient.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{recipient.transferCount}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(recipient.createdAt)}</TableCell>
                      <TableCell>
                        <DeleteRecipientButton
                          compact
                          disabled={recipient.transferCount > 0}
                          onDelete={() => setDeleteId(recipient.id)}
                        />
                      </TableCell>
                    </TableRow>
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
            <DialogTitle>Add recipient</DialogTitle>
            <DialogDescription>Create a reusable destination for transfer and delivery workflows.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="new-recipient" className="text-sm font-medium text-foreground">
              Recipient name
            </label>
            <Input
              id="new-recipient"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Production Floor C"
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && handleAdd()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || isPending}>
              <UserCheck className="h-4 w-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete recipient?</DialogTitle>
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

function DeleteRecipientButton({
  compact,
  disabled,
  onDelete,
}: {
  compact?: boolean;
  disabled: boolean;
  onDelete: () => void;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={disabled}
      className={compact ? "h-9 w-9" : "h-10 w-10"}
      aria-label={disabled ? "Recipient cannot be deleted while transfers exist" : "Delete recipient"}
    >
      <Trash2 className="h-4 w-4 text-muted-foreground" />
    </Button>
  );

  if (!disabled) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{button}</span>
      </TooltipTrigger>
      <TooltipContent>This recipient cannot be deleted while transfers still reference it.</TooltipContent>
    </Tooltip>
  );
}
