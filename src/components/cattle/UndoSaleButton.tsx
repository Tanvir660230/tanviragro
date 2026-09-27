"use client";

import { useState, useTransition, useMemo } from "react";
import { Undo2, Loader2, AlertTriangle } from "lucide-react";
import { revertSale } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useL } from "@/i18n/text";

export function UndoSaleButton({ cattleId, tagId, soldAt }: { cattleId: string; tagId: string; soldAt: string }) {
  const L = useL();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [nowMs] = useState(() => Date.now());
  const daysAgo = useMemo(
    () => Math.floor((nowMs - new Date(soldAt).getTime()) / 86400000),
    [nowMs, soldAt]
  );

  const saleDate = new Date(soldAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = 7 - daysAgo;

  function confirm() {
    startTransition(async () => {
      const res = await revertSale(cattleId).catch(() => ({ error: L("সমস্যা হয়েছে — কিছু বদলায়নি", "Something went wrong — nothing changed") }));
      if (res?.error) {
        toast.error(res.error);
        setOpen(false);
      } else {
        toast.success(L(`#${tagId}-এর বিক্রি বাতিল — গরুটি আবার খামারে`, `Sale for #${tagId} undone — the animal is back on the farm`));
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        {L("বিক্রি বাতিল", "Undo sale")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {L(`#${tagId}-এর বিক্রি বাতিল করবেন?`, `Undo the sale of #${tagId}?`)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {L(`${saleDate}-এর বিক্রির হিসাব সরানো হবে এবং গরুটি আবার খামারে (সক্রিয়) ফিরবে।`, `The sale of ${saleDate} is removed and the animal goes back on the farm (active).`)}
            </p>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              {L("বিক্রি লেখার পর ৭ দিন পর্যন্ত বাতিল করা যায়।", "A sale can be undone for 7 days after it is recorded.")}
              {daysLeft > 0 && L(` আর ${daysLeft} দিন বাকি।`, ` ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`)}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              {L("থাক", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              <span className="ml-1.5">{L("বাতিল করুন", "Undo sale")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
