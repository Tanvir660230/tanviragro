"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  updatePassword,
  type SettingsFormState,
} from "@/app/dashboard/(app)/settings/actions";
import { useL } from "@/i18n/text";

export function PasswordForm() {
  const L = useL();
  const [state, formAction, isPending] = useActionState<
    SettingsFormState,
    FormData
  >(updatePassword, undefined);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(L("পাসওয়ার্ড বদলানো হলো", "Password updated successfully"));
      formRef.current?.reset();
    }
  }, [state?.success, L]);

  const hasLength = newPassword.length >= 8;
  const hasMixed = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="new_pw" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {L("নতুন পাসওয়ার্ড", "New password")} <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="new_pw"
            name="new_password"
            type={showNew ? "text" : "password"}
            placeholder={L("কমপক্ষে ৮ অক্ষর", "Min. 8 characters")}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            className="pl-9 pr-10 h-10"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            tabIndex={-1}
            aria-label={showNew ? L("লুকান", "Hide password") : L("দেখান", "Show password")}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
        {newPassword && (
          <div className="flex items-center gap-3 text-xs pt-1">
            <span className={`inline-flex items-center gap-1 ${hasLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
              <CheckCircle2 className="h-3 w-3" /> {L("৮+ অক্ষর", "8+ chars")}
            </span>
            <span className={`inline-flex items-center gap-1 ${hasMixed ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
              <CheckCircle2 className="h-3 w-3" /> {L("অক্ষর ও সংখ্যা", "Letters & numbers")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_pw" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {L("আবার লিখুন", "Confirm new password")} <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirm_pw"
            name="confirm_password"
            type={showConfirm ? "text" : "password"}
            placeholder={L("নতুন পাসওয়ার্ড আবার লিখুন", "Repeat new password")}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            className="pl-9 pr-10 h-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            tabIndex={-1}
            aria-label={showConfirm ? L("লুকান", "Hide password") : L("দেখান", "Show password")}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
          {state.error}
        </div>
      )}

      <div className="pt-2">
        <Button type="submit" size="default" disabled={isPending} className="gap-1.5 shadow-sm">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {L("বদলানো হচ্ছে…", "Updating Password...")}
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              {L("পাসওয়ার্ড বদলান", "Update Credentials")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
