"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { todayDhaka } from "@/lib/dates";
import { saveCashCount, deleteCashCount, type CashCountState } from "@/app/dashboard/(app)/finance/cash-count-actions";
import type { MoneyModel } from "@/lib/money/money-model";
import { signed, taka } from "./MoneyToday";

/**
 * Count the cash in hand and in the bank, write the figure down, and see it against the books for
 * that day. A gap means money spent (or received) that was not entered — enter it with the day it
 * happened and the gap closes by itself.
 */
export function CashCountPanel({ count, cashToday }: { count: MoneyModel["cashCount"]; cashToday: number }) {
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const today = todayDhaka();
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState(today);
  const [state, action, saving] = useActionState<CashCountState, FormData>(saveCashCount, undefined);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state?.success) { toast.success(L("গোনা টাকা লেখা হলো", "Count saved")); formRef.current?.reset(); router.refresh(); }
    if (state?.error) toast.error(state.error);
  }, [state, L, router]);

  if (!count.enabled) return null;   // before migration 20260927120000

  const remove = (id: string) => startDelete(async () => {
    const r = await deleteCashCount(id);
    if (r?.error) toast.error(r.error); else router.refresh();
  });

  return (
    <section id="cash-count" className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label={L("টাকা গুনে মেলান", "Count the cash")}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><HandCoins className="h-4 w-4 text-muted-foreground" aria-hidden />{L("টাকা গুনে মেলান", "Count the cash")}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {L("হাতের আর ব্যাংকের টাকা গুনে লিখুন। হিসাবের সাথে না মিললে বুঝবেন কোনো খরচ বা আয় লেখা বাকি — সেটা যেদিন হয়েছিল সেই তারিখে লিখলে পার্থক্য নিজেই মিটে যাবে। সপ্তাহে একবার।",
           "Count the cash in hand and in the bank and write it down. If it differs from the books, something was not entered — enter it on the day it happened and the gap closes. Once a week.")}
      </p>

      <form ref={formRef} action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">{L("তারিখ", "Date")}
          <input type="date" name="counted_on" value={date} max={today} onChange={(e) => setDate(e.target.value)} required
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">{L("গুনে পেয়েছেন (৳)", "Counted (৳)")}
          <input type="number" name="amount" min={0} step="1" required inputMode="numeric"
            className="h-9 w-36 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <label className="grid min-w-40 flex-1 gap-1 text-xs text-muted-foreground">{L("নোট (ঐচ্ছিক)", "Note (optional)")}
          <input type="text" name="note" maxLength={300} placeholder={L("যেমন হাতে ৳5,000 + বিকাশে ৳2,000", "e.g. ৳5,000 in hand + ৳2,000 in the bank")}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <button type="submit" disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{L("লিখুন", "Save")}
        </button>
        {date === today && <p className="basis-full text-[11px] text-muted-foreground">{L(`আজ হিসাবে থাকার কথা ${taka(cashToday)}`, `The books say ${taka(cashToday)} today`)}</p>}
      </form>

      {count.list.length > 0 && (
        <ul className="mt-4 divide-y divide-border/60 border-t border-border/60 text-sm">
          {count.list.map((c) => {
            const match = Math.abs(c.gap) < 1;
            return (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="text-muted-foreground">{fmtDay(c.date, locale)}{c.note ? ` · ${c.note}` : ""}</span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  <span>{L(`গোনা ${taka(c.amount)} · হিসাবে ${taka(c.expected)}`, `counted ${taka(c.amount)} · books ${taka(c.expected)}`)}</span>
                  <b className={cn(match ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                    {match ? L("মিলেছে", "matches") : c.gap < 0 ? L(`${taka(c.gap)} কম — খরচ লেখা বাকি`, `${taka(c.gap)} short — spending not entered`) : L(`${signed(c.gap)} বেশি — আয় লেখা বাকি`, `${signed(c.gap)} over — money in not entered`)}
                  </b>
                  <button type="button" onClick={() => remove(c.id)} disabled={deleting} aria-label={L("মুছুন", "Delete")}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
