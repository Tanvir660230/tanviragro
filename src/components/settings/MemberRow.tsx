"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMemberRole, removeMember } from "@/app/dashboard/(app)/settings/team/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  worker:  "bg-muted text-muted-foreground",
};

interface Props {
  id: string;
  role: string;
  joinedAt: string;
  userId: string;
}

export function MemberRow({ id, role, joinedAt, userId }: Props) {
  const router = useRouter();
  const [updating, startUpdate] = useTransition();
  const [removing, startRemove] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [currentRole, setCurrentRole] = useState(role);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as "manager" | "worker";
    setCurrentRole(newRole);
    startUpdate(async () => {
      const result = await updateMemberRole(id, newRole);
      if (result.error) { toast.error(result.error); setCurrentRole(role); }
      else toast.success("Role updated");
    });
  }

  function handleRemove() {
    setConfirmRemove(false);
    startRemove(async () => {
      const result = await removeMember(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Member removed"); router.refresh(); }
    });
  }

  const joinDate = new Date(joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate font-mono text-xs text-muted-foreground">{userId.slice(0, 8)}…</p>
        <p className="text-xs text-muted-foreground">Joined {joinDate}</p>
      </div>
      <select
        value={currentRole}
        onChange={handleRoleChange}
        disabled={updating || removing}
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
      >
        <option value="manager">Manager</option>
        <option value="worker">Worker</option>
      </select>
      {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={removing || updating}
        onClick={() => setConfirmRemove(true)}
      >
        {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove Team Member"
        description="This will revoke their access to this business."
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
