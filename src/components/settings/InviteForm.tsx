"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inviteTeamMember } from "@/app/dashboard/(app)/settings/team/actions";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteTeamMember, undefined);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Email address</label>
          <input
            name="email"
            type="email"
            required
            placeholder="worker@example.com"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            name="role"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="" disabled>Select role…</option>
            <option value="manager">Manager</option>
            <option value="worker">Worker</option>
          </select>
        </div>
      </div>
      {state?.error   && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-600 dark:text-emerald-400">{state.success}</p>}
      <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Send Invitation
      </Button>
    </form>
  );
}
