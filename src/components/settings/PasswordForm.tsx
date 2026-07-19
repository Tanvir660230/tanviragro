"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  updatePassword,
  type SettingsFormState,
} from "@/app/dashboard/(app)/settings/actions";

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<
    SettingsFormState,
    FormData
  >(updatePassword, undefined);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Password updated successfully");
      formRef.current?.reset();
    }
  }, [state?.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="new_pw">
          New Password <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="new_pw"
            name="new_password"
            type={showNew ? "text" : "password"}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_pw">
          Confirm Password <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="confirm_pw"
            name="confirm_password"
            type={showConfirm ? "text" : "password"}
            placeholder="Repeat password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating…
          </>
        ) : (
          "Update Password"
        )}
      </Button>
    </form>
  );
}
