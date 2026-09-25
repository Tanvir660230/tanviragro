"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, UserPlus, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeamMember } from "@/app/dashboard/(app)/settings/team/actions";
import { toast } from "sonner";
import { useL } from "@/i18n/text";

export function InviteForm() {
  const L = useL();
  const [state, action, pending] = useActionState(inviteTeamMember, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invite_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {L("ইমেইল", "Email")} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="invite_email"
              name="email"
              type="email"
              required
              placeholder="manager@agrofarm.com"
              className="pl-9 h-10 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite_role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {L("ভূমিকা", "Role")} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              id="invite_role"
              name="role"
              required
              defaultValue=""
              className="w-full pl-9 pr-4 h-10 rounded-lg border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="" disabled>{L("ভূমিকা বাছুন…", "Select assigned role...")}</option>
              <option value="manager">{L("ম্যানেজার (গরু, বিক্রি, স্টক ও কাজ লিখতে পারবেন)", "Manager (Can record cattle, sales, inventory & operations)")}</option>
              <option value="worker">{L("কর্মী (দৈনিক কাজ লিখতে পারবেন)", "Worker (Field staff & task logging)")}</option>
            </select>
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground">
          {L("এই ইমেইলে খামারে যোগ দেওয়ার লিংক যাবে।", "An invitation link will be sent to the email to join this farm workspace.")}
        </p>
        <Button type="submit" size="sm" disabled={pending} className="gap-1.5 shadow-sm">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          {L("আমন্ত্রণ পাঠান", "Send Invite")}
        </Button>
      </div>
    </form>
  );
}
