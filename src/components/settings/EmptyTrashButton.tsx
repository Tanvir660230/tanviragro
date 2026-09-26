"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { emptyTrash } from "@/app/dashboard/(app)/settings/trash/actions";
import { useL } from "@/i18n/text";

export function EmptyTrashButton({ count }: { count: number }) {
  const L = useL();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (count === 0) return null;

  function run() {
    setOpen(false);
    start(async () => {
      const res = await emptyTrash();
      if (res.error) { toast.error(res.error); return; }
      const kept = res.kept ?? 0;
      toast.success(kept > 0
        ? L(`${res.removed}টি চিরতরে মোছা হলো। ${kept}টি রাখা হলো — অন্য রেকর্ড এগুলোর উপর নির্ভর করে।`, `${res.removed} removed for good. ${kept} kept — other records depend on them.`)
        : L(`${res.removed}টি চিরতরে মোছা হলো — ট্র্যাশ খালি`, `${res.removed} removed for good — the trash is empty`));
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" size="sm" className="gap-1.5" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {L("ট্র্যাশ খালি করুন", "Empty trash")}
      </Button>
      <ConfirmDialog
        open={open}
        title={L("ট্র্যাশ খালি করবেন?", "Empty the trash?")}
        description={L(
          `ট্র্যাশের ${count}টি জিনিস চিরতরে মুছে যাবে, আর ফেরত আনা যাবে না। নগদ বা হিসাবে কিছু বদলাবে না — এগুলো আগেই হিসাবের বাইরে।`,
          `The ${count} items in the trash will be erased for good and cannot be restored. Cash and the accounts do not change — these are already out of them.`)}
        confirmLabel={L("চিরতরে মুছুন", "Erase for good")}
        destructive
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
