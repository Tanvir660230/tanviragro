"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { archiveInventoryItem, unarchiveInventoryItem } from "@/app/dashboard/(app)/inventory/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useL } from "@/i18n/text";

export function ArchiveItemButton({
  id,
  name,
  isDiscontinued,
  blocked = false,
}: {
  id: string;
  name: string;
  isDiscontinued: boolean;
  /** still has stock or is in use: it would stay on the list, so it has to be finished first */
  blocked?: boolean;
}) {
  const L = useL();
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
        toast.success(isDiscontinued ? L(`"${name}" আবার চালু হলো`, `"${name}" restored to active`) : L(`"${name}" মুছে ফেলা হলো`, `"${name}" deleted`));
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
        title={L("আবার চালু করুন", "Restore this item to active stock")}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
        {L("ফেরত আনুন", "Restore")}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => {
          if (blocked) {
            toast.info(L("স্টকে এখনো আছে বা চালু আছে — আগে \"শেষ হয়েছে\" দিন, তারপর মুছুন।", "It still has stock or is in use — mark it finished first, then delete it."));
            return;
          }
          setConfirm(true);
        }}
        aria-disabled={blocked}
        className={blocked ? "text-muted-foreground/50 hover:text-muted-foreground" : "text-muted-foreground hover:text-destructive"}
        title={blocked
          ? L("আগে শেষ করুন, তারপর মুছুন", "Finish it first, then delete it")
          : L("মুছুন (ইতিহাস থেকে যাবে)", "Delete this item (history will be preserved)")}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>

      <ConfirmDialog
        open={confirm}
        title={L(`"${name}" মুছবেন?`, `Delete "${name}"?`)}
        description={L("তালিকা থেকে লুকানো হবে, কিন্তু কেনা ও খরচের সব ইতিহাস থেকে যাবে।", "This item will be hidden from your active list, but all its purchase and usage history will be safely preserved in the background.")}
        confirmLabel={L("মুছুন", "Delete")}
        destructive={true}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
