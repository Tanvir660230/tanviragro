"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { archiveInventoryItem, unarchiveInventoryItem } from "@/app/dashboard/(app)/inventory/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export function ArchiveItemButton({
  id,
  name,
  isDiscontinued,
}: {
  id: string;
  name: string;
  isDiscontinued: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const handleConfirm = () => {
    setConfirm(false);
    startTransition(async () => {
      const result = isDiscontinued
        ? await unarchiveInventoryItem(id)
        : await archiveInventoryItem(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isDiscontinued ? `"${name}" restored to active` : `"${name}" deleted successfully`);
        router.refresh();
      }
    });
  };

  if (isDiscontinued) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
        disabled={isPending}
        onClick={handleConfirm}
        title="Restore this item to active stock"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
        Restore
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => setConfirm(true)}
        title="Delete this item (history will be preserved)"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>

      <ConfirmDialog
        open={confirm}
        title={`Delete "${name}"?`}
        description="This item will be hidden from your active list, but all its purchase and usage history will be safely preserved in the background."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
