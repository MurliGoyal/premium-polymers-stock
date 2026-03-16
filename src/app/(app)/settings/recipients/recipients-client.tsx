"use client";

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
        await addRecipient(newName.trim());
        toast.success("Recipient added");
        setNewName("");
        setShowAdd(false);
        router.refresh();
      } catch {
        toast.error("Failed to add recipient");
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(recipient.id)}
                    disabled={recipient.transferCount > 0}
                    className="h-10 w-10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(recipient.id)}
                      disabled={recipient.transferCount > 0}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
