"use client";

import { useActionState, useTransition, useEffect, useState } from "react";
import { Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFinancialLock, deleteFinancialLock, type LockFormState } from "@/app/dashboard/(app)/accounting/lock-actions";
import { toast } from "sonner";
import type { FinancialLock } from "@/types/database";

import { useL } from "@/i18n/text";
export function FinancialLockManager({ locks }: { locks: FinancialLock[] }) {
  const L = useL();
  const [state, formAction, isPending] = useActionState<LockFormState, FormData>(
    createFinancialLock,
    undefined
  );
  const [isDeleting, startDelete] = useTransition();
  const [confirmLockId, setConfirmLockId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) toast.success(L("হিসাব বন্ধ (লক) করা হলো", "Financial period locked"));
    if (state?.error) toast.error(state.error);
  }, [state, L]);

  function handleDelete() {
    if (!confirmLockId) return;
    const id = confirmLockId;
    setConfirmLockId(null);
    startDelete(async () => {
      const res = await deleteFinancialLock(id);
      if (res.error) toast.error(res.error);
      else toast.success(L("লক সরানো হলো", "Lock removed"));
    });
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">{L("হিসাব লক", "Financial Period Locks")}</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {L("লক করা তারিখ বা তার আগের কোনো লেনদেন আর যোগ বা বদল করা যায় না। লাভ ভাগের পর হিসাব স্থির রাখতে ব্যবহার করুন।", "Locked periods prevent editing or adding transactions on or before the lock date. Used after profit distribution to freeze the books.")}
      </p>

      {locks.length > 0 && (
        <div className="space-y-2">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {L(`${lock.locked_until.slice(0, 10)} পর্যন্ত লক`, `Locked until ${lock.locked_until.slice(0, 10)}`)}
                </span>
              </div>
              <button
                onClick={() => setConfirmLockId(lock.id)}
                disabled={isDeleting}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={L("লক সরান", "Remove lock")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {locks.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Unlock className="h-3.5 w-3.5 shrink-0" />
          {L("কোনো তারিখ লক নেই — সব তারিখে লেখা যায়।", "No periods are locked. All dates are editable.")}
        </div>
      )}

      <ConfirmDialog
        open={confirmLockId !== null}
        title={L("লক সরাবেন?", "Remove Financial Lock")}
        description={L("এই তারিখের আগের লেনদেন আবার বদলানো যাবে।", "Remove this period lock? Transactions before this date will become editable again.")}
        confirmLabel={L("লক সরান", "Remove Lock")}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmLockId(null)}
      />

      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="locked_until" className="text-xs font-medium text-muted-foreground">
            {L("এই তারিখ ও তার আগের সব লক করুন", "Lock all dates on or before")}
          </label>
          <Input
            id="locked_until"
            name="locked_until"
            type="date"
            required
            className="h-8 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending} variant="outline" className="shrink-0">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {isPending ? L("লক হচ্ছে…", "Locking…") : L("লক করুন", "Add lock")}
        </Button>
      </form>
    </div>
  );
}
