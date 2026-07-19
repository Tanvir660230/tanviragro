"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { forgotPassword } from "./actions";

type State = { error?: string; success?: boolean } | undefined;

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<State, FormData>(
    forgotPassword,
    undefined
  );

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-card-foreground">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If that email is registered, you&apos;ll receive a reset link shortly.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
          disabled={isPending}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Reset Link
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-primary transition-colors">
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
