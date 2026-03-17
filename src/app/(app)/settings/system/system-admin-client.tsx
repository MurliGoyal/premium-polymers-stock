"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Bell,
  ClipboardList,
  Database,
  Package,
  Shield,
  Tag,
  Trash2,
  UserCheck,
  Users,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resetOperationalData } from "../actions";

const CONFIRMATION_PHRASE = "DELETE INVENTORY";

type Summary = {
  deletable: {
    rawMaterials: number;
    transfers: number;
    activityLogs: number;
    stockTransactions: number;
    notifications: number;
    total: number;
  };
  preserved: {
    users: number;
    categories: number;
    recipients: number;
    warehouses: number;
  };
};

export function SystemAdminClient({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReset = () => {
    startTransition(async () => {
      try {
        const result = await resetOperationalData(confirmation);
        toast.success(
          result.totalDeleted > 0
            ? `Operational data cleared (${result.totalDeleted} records deleted).`
            : "No operational data was present to delete."
        );
        setConfirmation("");
        setDialogOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to clear operational data.");
      }
    });
  };

  const deletableItems = [
    { label: "Raw materials", value: summary.deletable.rawMaterials, icon: Package },
    { label: "Transfers", value: summary.deletable.transfers, icon: ArrowRightLeft },
    { label: "Activity logs", value: summary.deletable.activityLogs, icon: ClipboardList },
    { label: "Stock transactions", value: summary.deletable.stockTransactions, icon: Database },
    { label: "Notifications", value: summary.deletable.notifications, icon: Bell },
  ];

  const preservedItems = [
    { label: "Users", value: summary.preserved.users, icon: Users },
    { label: "Categories", value: summary.preserved.categories, icon: Tag },
    { label: "Recipients", value: summary.preserved.recipients, icon: UserCheck },
    { label: "Warehouses", value: summary.preserved.warehouses, icon: Warehouse },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span>Settings</span>
        <span>/</span>
        <span className="font-medium text-foreground">System Admin</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Admin only"
        title="System admin"
        description="Danger zone for resetting operational inventory data. Users, recipients, categories, and warehouse definitions are preserved."
        badge={<Badge variant="danger">Restricted</Badge>}
        actions={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDialogOpen(true)}
            disabled={summary.deletable.total === 0}
          >
            <Trash2 className="h-4 w-4" />
            Delete operational data
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Trash2 className="h-4 w-4 text-red-300" />
                Will be deleted
              </CardTitle>
              <Badge variant="danger">{summary.deletable.total} records</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {deletableItems.map((item) => (
              <SummaryRow key={item.label} icon={item.icon} label={item.label} tone="danger" value={item.value} />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-emerald-300" />
                Will be preserved
              </CardTitle>
              <Badge variant="success">Master data stays</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {preservedItems.map((item) => (
              <SummaryRow key={item.label} icon={item.icon} label={item.label} tone="success" value={item.value} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[22px] border border-red-500/15 bg-red-500/8 px-4 py-4 text-sm text-red-100">
            This reset permanently removes inventory records, transfer history, stock transactions, activity logs, and
            notifications. It does not remove users, categories, recipients, or warehouse definitions.
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/10 text-foreground/80">
              Confirmation phrase: {CONFIRMATION_PHRASE}
            </Badge>
            {summary.deletable.total === 0 ? (
              <Badge variant="secondary">No operational data to delete</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all operational data?</DialogTitle>
            <DialogDescription>
              This is permanent. Type <span className="font-semibold text-foreground">{CONFIRMATION_PHRASE}</span> to
              remove inventory data while keeping users, categories, recipients, and warehouses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="system-reset-confirmation" className="text-sm font-medium text-foreground">
              Confirmation phrase
            </label>
            <Input
              id="system-reset-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isPending || confirmation.trim() !== CONFIRMATION_PHRASE}
            >
              <Trash2 className="h-4 w-4" />
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "danger" | "success";
  value: number;
}) {
  const toneClasses =
    tone === "danger"
      ? "border-red-500/12 bg-red-500/6 text-red-100"
      : "border-emerald-500/12 bg-emerald-500/6 text-emerald-100";

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-[16px] border border-white/8 bg-black/15 p-2.5 text-foreground/80">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">Current records</p>
          </div>
        </div>
        <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
      </div>
    </div>
  );
}
