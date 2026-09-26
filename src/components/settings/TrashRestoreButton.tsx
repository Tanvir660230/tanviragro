"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  restoreCostEntry,
  restoreInventoryItem,
  restoreWeightLog,
  permanentlyDelete,
} from "@/app/dashboard/(app)/settings/trash/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useL } from "@/i18n/text";

interface Props {
  id: string;
  restoreAction: "cost_entry" | "inventory_item" | "weight_log";
  table: "cost_entries" | "inventory_items" | "weight_logs";
  /** false: only "delete for good" (e.g. a vet fee saved twice — restoring would count it twice) */
  canRestore?: boolean;
}

export function TrashRestoreButton({ id, restoreAction, table, canRestore = true }: Props) {
  const L = useL();
  const router = useRouter();
  const [restoring, startRestore] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleRestore() {
    startRestore(async () => {
      let result: { error?: string };
      if (restoreAction === "cost_entry")       result = await restoreCostEntry(id);
      else if (restoreAction === "inventory_item") result = await restoreInventoryItem(id);
      else                                      result = await restoreWeightLog(id);
      if (result.error) toast.error(result.error);
      else { toast.success(L("ফেরত আনা হলো", "Record restored successfully")); router.refresh(); }
    });
  }

  async function handlePermanentDelete() {
    setConfirmDelete(false);
    startDelete(async () => {
      const result = await permanentlyDelete(table, id);
      if (result.error) toast.error(result.error);
      else { toast.success(L("চিরতরে মুছে ফেলা হলো", "Record permanently removed")); router.refresh(); }
    });
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {canRestore && <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8 shadow-sm"
        disabled={restoring || deleting}
        onClick={handleRestore}
        aria-label={L("ফেরত আনুন", "Restore item")}
      >
        {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        {L("ফেরত আনুন", "Restore")}
      </Button>}
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        disabled={restoring || deleting}
        onClick={() => setConfirmDelete(true)}
        aria-label={L("চিরতরে মুছুন", "Permanently delete item")}
        title={L("চিরতরে মুছুন", "Permanently erase")}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title={L("চিরতরে মুছবেন?", "Permanently Delete Record")}
        description={L("এটি চিরতরে মুছে যাবে, আর ফেরত আনা যাবে না।", "This will erase this archived record from the database forever. This action is irreversible.")}
        confirmLabel={L("চিরতরে মুছুন", "Delete Forever")}
        destructive
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
