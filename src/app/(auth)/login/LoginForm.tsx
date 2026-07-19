"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, Eye, EyeOff, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { login, sendMagicLink } from "./actions";
import { cn } from "@/lib/utils";

type LoginState = { error?: string; magicLinkSent?: boolean } | undefined;

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");

  const [passwordState, passwordAction, isPasswordPending] = useActionState<LoginState, FormData>(
    login,
    undefined
  );
  const [magicState, magicAction, isMagicPending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    undefined
  );

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-5">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
            mode === "password"
              ? "bg-background text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
            mode === "magic"
              ? "bg-background text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Magic Link
        </button>
      </div>

      {/* Password form */}
      {mode === "password" && (
        <form action={passwordAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              disabled={isPasswordPending}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isPasswordPending}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {passwordState?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {passwordState.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPasswordPending}>
            {isPasswordPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>
      )}

      {/* Magic Link form */}
      {mode === "magic" && (
        <>
          {magicState?.magicLinkSent ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-5 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Check your email
                </p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  We sent a magic link to your inbox. Click it to sign in instantly — no password needed.
                </p>
              </div>
            </div>
          ) : (
            <form action={magicAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={isMagicPending}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                We&apos;ll send a one-time sign-in link to your email. No password required.
              </p>

              {magicState?.error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {magicState.error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isMagicPending}>
                {isMagicPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Magic Link
                  </>
                )}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
