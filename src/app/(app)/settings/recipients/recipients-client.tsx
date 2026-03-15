"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { UserCheck, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
      } catch { toast.error("Failed to add recipient"); }
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> Recipients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage transfer recipients</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-1.5 h-4 w-4" /> Add Recipient</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Transfers</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="secondary">{r.transferCount}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} disabled={r.transferCount > 0} className="h-7 w-7">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Recipient</DialogTitle></DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Recipient name" autoFocus onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Recipient?</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
