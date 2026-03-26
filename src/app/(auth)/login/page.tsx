"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        className="grid w-full max-w-5xl gap-6 lg:grid-cols-2"
      >
        {/* Left panel - desktop only */}
        <div className="surface-panel hidden rounded-[32px] p-8 lg:flex lg:flex-col lg:justify-center xl:p-10">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt="Premium Polymers"
              width={200}
              height={200}
              className="h-auto w-[200px] rounded-2xl object-contain"
              priority
            />
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-gradient xl:text-4xl">
              Premium Polymers
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Stock Management System
            </p>
          </div>
        </div>

        {/* Right panel - login form */}
        <div className="w-full max-w-[460px] justify-self-center lg:self-center">
          {/* Mobile header */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-5 inline-flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Premium Polymers"
                width={120}
                height={120}
                className="h-auto w-[120px] rounded-xl object-contain sm:w-[150px]"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Premium Polymers</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Stock Management System</p>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2 pt-6 sm:pt-8">
              <CardTitle className="text-xl sm:text-2xl">Welcome back</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Sign in to your account to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6 sm:pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
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
                      placeholder="name@company.com"
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
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={loading}>
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

            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
