"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="surface-panel hidden rounded-[32px] p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Badge variant="secondary">Premium operations</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-gradient">
              Premium Polymers
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              Dark-first inventory control for fast transfer approvals, stock visibility, and clean audit trails.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              "Warehouse-scoped stock health",
              "Transfer ledger with recipient history",
              "Mobile-friendly operations cockpit",
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-foreground/88">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-[460px] justify-self-center">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-lg font-bold text-primary shadow-lg shadow-primary/20">
              PP
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Premium Polymers</h1>
            <p className="mt-1 text-sm text-muted-foreground">Stock Management System</p>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <Badge variant="secondary" className="w-fit">Secure sign-in</Badge>
              <CardTitle className="mt-3 text-2xl">Welcome back</CardTitle>
              <CardDescription>Sign in to continue managing stock, transfers, and audit history.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-[20px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@premiumpolymers.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                    />
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 border-t border-white/8 pt-4">
                <p className="text-center text-[11px] text-muted-foreground">
                  Demo credentials:{" "}
                  <span className="font-mono text-foreground/70">admin@premiumpolymers.com</span> /{" "}
                  <span className="font-mono text-foreground/70">admin123</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
