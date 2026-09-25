"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMemberRole, removeMember } from "@/app/dashboard/(app)/settings/team/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useL } from "@/i18n/text";


interface Props {
  id: string;
  role: string;
  joinedAt: string;
  userId: string;
}

export function MemberRow({ id, role, joinedAt, userId }: Props) {
  const L = useL();
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
      else toast.success(L("ভূমিকা বদলানো হলো", "Role updated successfully"));
    });
  }

  function handleRemove() {
    setConfirmRemove(false);
    startRemove(async () => {
      const result = await removeMember(id);
      if (result.error) toast.error(result.error);
      else { toast.success(L("সদস্যকে সরানো হলো", "Member access revoked")); router.refresh(); }
    });
  }

  const joinDate = new Date(joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate font-mono text-xs">{L("ইউজার", "User")}: {userId.slice(0, 12)}…</p>
          <p className="text-xs text-muted-foreground">{L("যোগ", "Joined")} {joinDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <select
          value={currentRole}
          onChange={handleRoleChange}
          disabled={updating || removing}
          aria-label={L("ভূমিকা বদলান", "Change user role")}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          <option value="manager">{L("ম্যানেজার", "Manager (Operations)")}</option>
          <option value="worker">{L("কর্মী", "Worker (Staff)")}</option>
        </select>
        {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          disabled={removing || updating}
          onClick={() => setConfirmRemove(true)}
          title={L("সরিয়ে দিন", "Revoke access")}
        >
          {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={L("সদস্যকে সরাবেন?", "Revoke Team Member Access")}
        description={L("সরালে তিনি সাথে সাথে খামারের কোনো তথ্য আর দেখতে পারবেন না।", "Are you sure you want to remove this user? They will immediately lose access to this farm workspace and all its data.")}
        confirmLabel={L("সরিয়ে দিন", "Revoke Access")}
        destructive
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
