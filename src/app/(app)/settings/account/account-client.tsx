"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { KeyRound, Shield, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ResponsivePageHeader } from "@/components/shared/responsive-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRoleColor, getRoleLabel } from "@/lib/rbac";
import { changeOwnPassword } from "../actions";

type AccountUser = {
  email: string;
  name: string;
  role: string;
};

export function AccountClient({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const initials = user.name
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordsMatch) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        await changeOwnPassword({
          confirmPassword,
          currentPassword,
          newPassword,
        });

        toast.success("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update password.");
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
        <span className="font-medium text-foreground">My account</span>
      </div>

      <ResponsivePageHeader
        eyebrow="Settings"
        title="My account"
        description="Update your own password and keep your sign-in secure."
        badge={<Badge variant="secondary">Self service</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass-panel overflow-hidden border-white/10">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/[0.06] text-sm font-semibold text-foreground shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                {initials || "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tracking-[-0.03em]">{user.name}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={getRoleColor(user.role)}>
                <Shield className="mr-1 h-3 w-3" />
                {getRoleLabel(user.role)}
              </Badge>
              <Badge variant="secondary">
                <UserCircle2 className="mr-1 h-3 w-3" />
                Account security
              </Badge>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              Use this page to change your own password. Managers can reset other users from the Users page.
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel overflow-hidden border-white/10">
          <CardContent className="p-6 sm:p-7">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter your current password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat the new password"
                />
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <p className="text-xs font-medium text-red-300">Passwords do not match.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Passwords are stored securely and the current session stays active.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isPending || !canSubmit}>
                  <KeyRound className="h-4 w-4" />
                  Update password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={isPending || (!currentPassword && !newPassword && !confirmPassword)}
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}