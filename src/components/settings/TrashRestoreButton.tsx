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

interface Props {
  id: string;
  restoreAction: "cost_entry" | "inventory_item" | "weight_log";
  table: "cost_entries" | "inventory_items" | "weight_logs";
}

export function TrashRestoreButton({ id, restoreAction, table }: Props) {
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
      else { toast.success("Restored successfully"); router.refresh(); }
    });
  }

  async function handlePermanentDelete() {
    setConfirmDelete(false);
    startDelete(async () => {
      const result = await permanentlyDelete(table, id);
      if (result.error) toast.error(result.error);
      else { toast.success("Permanently deleted"); router.refresh(); }
    });
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        disabled={restoring || deleting}
        onClick={handleRestore}
      >
        {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        Restore
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={restoring || deleting}
        onClick={() => setConfirmDelete(true)}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently Delete"
        description="This will erase the record forever and cannot be undone."
        confirmLabel="Delete Forever"
        destructive
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
