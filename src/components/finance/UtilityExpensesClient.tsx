"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, History, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createExpenseCategory, deleteUtilityExpense, getBillUrl, renameExpenseCategory,
  saveUtilityExpense, setExpenseCategoryActive, type UtilityFormState,
} from "@/app/dashboard/(app)/finance/utilities/actions";
import type { ExpenseCategory } from "@/types/database";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";

export type UtilityExpense = {
  id: string;
  category: string;
  category_id: string | null;
  amount: number;
  recorded_at: string;
  description: string | null;
  attachment_path: string | null;
  created_at: string;
};
export type UtilityAudit = {
  cost_entry_id: string;
  action: string;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changed_at: string;
};

type Props = {
  categories: ExpenseCategory[];
  expenses: UtilityExpense[];
  audits: UtilityAudit[];
  summary: { months: string[]; byCategory: Record<string, Record<string, number>>; totals: Record<string, number> };
  today: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageCategories: boolean;
};

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const monthLabel = (m: string, locale?: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale === "bn" ? "bn-BD-u-nu-latn" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export function UtilityExpensesClient(props: Props) {
  const L = useL();
  const { locale } = useTranslation();
  const { categories, expenses, audits, summary, canCreate, canEdit, canDelete, canManageCategories } = props;
  const [editing, setEditing] = useState<UtilityExpense | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const nameOf = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? L("অজানা", "Unknown") : L("ধরন ছাড়া (পুরনো)", "Uncategorised (old entry)"));
  }, [categories, L]);
  const auditsByEntry = useMemo(() => {
    const m = new Map<string, UtilityAudit[]>();
    for (const a of audits) m.set(a.cost_entry_id, [...(m.get(a.cost_entry_id) ?? []), a]);
    return m;
  }, [audits]);

  const thisMonth = summary.months[summary.months.length - 1];
  const lastMonth = summary.months[summary.months.length - 2];
  const yearTotal = Object.values(summary.totals).reduce((a, b) => a + b, 0);
  const summaryRows = [
    ...categories.map((c) => ({ key: c.id, name: c.name, active: c.is_active })),
    ...(summary.byCategory.uncategorised ? [{ key: "uncategorised", name: L("ধরন ছাড়া (পুরনো)", "Uncategorised (old entries)"), active: true }] : []),
  ].filter((r) => summary.byCategory[r.key]);
  const visible = filter === "all" ? expenses : expenses.filter((e) => (e.category_id ?? "uncategorised") === filter);

  function openBill(id: string) {
    startTransition(async () => {
      const res = await getBillUrl(id);
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error(res.error ?? L("বিল খোলা যায়নি", "Could not open the bill"));
    });
  }
  function remove(e: UtilityExpense) {
    if (!confirm(L(`${taka(Number(e.amount))} খরচটি মুছবেন? ট্র্যাশ থেকে ফেরানো যাবে।`, `Delete this ${taka(Number(e.amount))} expense? It can be restored from Trash.`))) return;
    startTransition(async () => {
      const res = await deleteUtilityExpense(e.id);
      if (res.error) toast.error(res.error);
      else { toast.success(L("খরচ মুছে ফেলা হলো", "Expense deleted")); router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          [L("এই মাস", "This month"), summary.totals[thisMonth] ?? 0],
          [L("গত মাস", "Last month"), summary.totals[lastMonth] ?? 0],
          [L("গত ১২ মাস", "Last 12 months"), yearTotal],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{taka(value as number)}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">{L("মাসভিত্তিক বিদ্যুৎ-পানি খরচ", "Monthly utility expenses")}</div>
        {summaryRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{L("কোনো তথ্য নেই", "No data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">{L("খাত", "Utility")}</th>
                  {summary.months.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold whitespace-nowrap">{monthLabel(m, locale)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaryRows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}{!r.active && <span className="ml-1 text-muted-foreground">{L("(বন্ধ)", "(disabled)")}</span>}</td>
                    {summary.months.map((m) => {
                      const v = summary.byCategory[r.key]?.[m];
                      return <td key={m} className="px-2 py-2 text-right tabular-nums">{v ? taka(v) : "—"}</td>;
                    })}
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-3 py-2">{L("মোট", "Total")}</td>
                  {summary.months.map((m) => <td key={m} className="px-2 py-2 text-right tabular-nums">{summary.totals[m] ? taka(summary.totals[m]) : "—"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">{L("খরচের তালিকা", "Expense history")}</span>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label={L("খাত বাছুন", "Filter by utility")}
            >
              <option value="all">{L("সব খাত", "All utilities")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              {summary.byCategory.uncategorised && <option value="uncategorised">{L("ধরন ছাড়া (পুরনো)", "Uncategorised (old entries)")}</option>}
            </select>
            {canCreate && (
              <Button size="sm" onClick={() => setEditing("new")} disabled={!categories.some((c) => c.is_active)}>
                <Plus className="mr-1 h-4 w-4" /> {L("খরচ যোগ", "Add expense")}
              </Button>
            )}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{L("কোনো তথ্য নেই", "No data")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((e) => {
              const changes = auditsByEntry.get(e.id) ?? [];
              return (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="tabular-nums text-muted-foreground w-24">{e.recorded_at.slice(0, 10)}</span>
                    <span className="font-medium">{nameOf(e.category_id)}</span>
                    <span className="ml-auto font-semibold tabular-nums">{taka(Number(e.amount))}</span>
                  </div>
                  {e.description && <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {e.attachment_path && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openBill(e.id)}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> {L("বিল", "Bill")}
                      </Button>
                    )}
                    {changes.length > 0 && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHistoryFor(historyFor === e.id ? null : e.id)}>
                        <History className="mr-1 h-3.5 w-3.5" /> {L(`${changes.length} বার বদলানো`, `Edited ${changes.length}×`)}
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(e)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> {L("ঠিক করুন", "Correct")}
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => remove(e)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> {L("মুছুন", "Delete")}
                      </Button>
                    )}
                  </div>
                  {historyFor === e.id && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-muted/40 p-2 text-xs">
                      {changes.map((a, i) => (
                        <li key={i}>
                          <span className="text-muted-foreground">{new Date(a.changed_at).toLocaleString(locale === "bn" ? "bn-BD-u-nu-latn" : "en-GB")}:</span>{" "}
                          {describeChange(a, nameOf, L)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManageCategories && <CategoryManager categories={categories} />}

      {editing && (
        <ExpenseDialog
          key={editing === "new" ? "new" : editing.id}
          expense={editing === "new" ? null : editing}
          categories={categories}
          today={props.today}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function describeChange(a: UtilityAudit, nameOf: (id: string | null) => string, L: (bn: string, en: string) => string): string {
  if (a.action === "restore") return L("ট্র্যাশ থেকে ফেরানো", "restored from Trash");
  const o = a.old_row ?? {};
  const n = a.new_row ?? {};
  const parts: string[] = [];
  if (o.amount !== n.amount) parts.push(L(`টাকা ${taka(Number(o.amount))} → ${taka(Number(n.amount))}`, `amount ${taka(Number(o.amount))} → ${taka(Number(n.amount))}`));
  if (o.recorded_at !== n.recorded_at) parts.push(L(`তারিখ ${String(o.recorded_at).slice(0, 10)} → ${String(n.recorded_at).slice(0, 10)}`, `date ${String(o.recorded_at).slice(0, 10)} → ${String(n.recorded_at).slice(0, 10)}`));
  if (o.category_id !== n.category_id || o.category !== n.category)
    parts.push(`${L("খাত", "utility")} ${o.category_id ? nameOf(o.category_id as string) : String(o.category)} → ${n.category_id ? nameOf(n.category_id as string) : String(n.category)}`);
  if (o.description !== n.description) parts.push(L("নোট বদলানো", "description changed"));
  if (o.attachment_path !== n.attachment_path) parts.push(L("বিল বদলানো", "bill replaced"));
  return parts.length ? parts.join("; ") : L("আপডেট", "updated");
}

function ExpenseDialog({ expense, categories, today, onClose }: {
  expense: UtilityExpense | null; categories: ExpenseCategory[]; today: string; onClose: () => void;
}) {
  const L = useL();
  const router = useRouter();
  const [state, action, pending] = useActionState<UtilityFormState, FormData>(saveUtilityExpense, undefined);
  useEffect(() => {
    if (state?.success) { toast.success(expense ? L("খরচ ঠিক করা হলো (আগেরটা ইতিহাসে আছে)", "Expense corrected (change recorded in history)") : L("খরচ যোগ হলো", "Expense added")); onClose(); router.refresh(); }
  }, [state?.success, expense, onClose, router, L]);

  const options = categories.filter((c) => c.is_active || c.id === expense?.category_id);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{expense ? L("খরচ ঠিক করুন", "Correct utility expense") : L("বিদ্যুৎ-পানি খরচ যোগ", "Add utility expense")}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          {expense && <input type="hidden" name="id" value={expense.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="ue_cat">{L("খাত *", "Utility *")}</Label>
            <select id="ue_cat" name="category_id" required defaultValue={expense?.category_id ?? ""}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="" disabled>{L("বাছুন…", "Choose…")}</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : L(" (বন্ধ)", " (disabled)")}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ue_amount">{L("টাকা (৳) *", "Amount (৳) *")}</Label>
              <Input id="ue_amount" name="amount" type="number" min="0.01" step="0.01" required defaultValue={expense?.amount ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ue_date">{L("তারিখ *", "Date *")}</Label>
              <Input id="ue_date" name="recorded_at" type="date" max={today} required defaultValue={expense?.recorded_at?.slice(0, 10) ?? today} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ue_desc">{L("নোট", "Notes")}</Label>
            <Textarea id="ue_desc" name="description" rows={2} maxLength={500} defaultValue={expense?.description ?? ""} placeholder={L("যেমন বিলের মাস, মিটার রিডিং, কোম্পানি", "e.g. bill month, meter reading, provider")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ue_bill">{L("বিল / রসিদ (ঐচ্ছিক)", "Bill / invoice (optional)")}</Label>
            <Input id="ue_bill" name="bill" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            <p className="text-xs text-muted-foreground">{L("PDF বা ছবি, ৫ MB পর্যন্ত।", "PDF or image, up to 5 MB.")}{expense?.attachment_path ? L(" নতুন ফাইল দিলে আগের বিলের লিংক বদলাবে; পুরনো ফাইল থেকে যাবে।", " A new file replaces the current bill link; the old file is kept.") : ""}</p>
          </div>
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          {expense && <p className="text-xs text-muted-foreground">{L("আগের তথ্য ইতিহাসে থেকে যাবে।", "The previous values are kept in the edit history.")}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{L("বাতিল", "Cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{L("সেভ করুন", "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManager({ categories }: { categories: ExpenseCategory[] }) {
  const L = useL();
  const router = useRouter();
  const [state, action, pending] = useActionState<UtilityFormState, FormData>(createExpenseCategory, undefined);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, startTransition] = useTransition();
  useEffect(() => { if (state?.success) { toast.success(L("খাত যোগ হলো", "Utility added")); router.refresh(); } }, [state?.success, router, L]);

  function run(fn: () => Promise<{ error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else { toast.success(ok); router.refresh(); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">{L("খাতগুলো সাজান", "Manage utilities")}</p>
        <p className="text-xs text-muted-foreground">{L("যেকোনো সময় নাম বদলানো বা বন্ধ করা যায়। আগের খরচ তার খাতেই থাকবে এবং হিসাবে \"বিদ্যুৎ-পানি\"-তেই যোগ হবে।", "Rename or disable a utility at any time. Past expenses keep their utility and stay under Utilities in the accounts.")}</p>
      </div>
      <ul className="divide-y divide-border">
        {categories.map((c) => {
          const value = names[c.id] ?? c.name;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <Input value={value} onChange={(e) => setNames((s) => ({ ...s, [c.id]: e.target.value }))}
                className={cn("h-8 max-w-xs text-sm", !c.is_active && "text-muted-foreground")} aria-label={L(`${c.name}-এর নাম`, `Name of ${c.name}`)} />
              {value.trim() !== c.name && (
                <Button size="sm" className="h-8" disabled={busy} onClick={() => run(() => renameExpenseCategory(c.id, value), L("নাম বদলানো হলো", "Renamed"))}>{L("নাম সেভ", "Save name")}</Button>
              )}
              <Button size="sm" variant="outline" className="h-8 ml-auto" disabled={busy}
                onClick={() => run(() => setExpenseCategoryActive(c.id, !c.is_active), c.is_active ? L("বন্ধ করা হলো", "Disabled") : L("চালু করা হলো", "Enabled"))}>
                {c.is_active ? L("বন্ধ করুন", "Disable") : L("চালু করুন", "Enable")}
              </Button>
            </li>
          );
        })}
      </ul>
      <form action={action} className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border">
        <input type="hidden" name="kind" value="utility" />
        <Input name="name" placeholder={L("নতুন খাত, যেমন জেনারেটরের তেল", "New utility, e.g. Generator fuel")} className="h-8 max-w-xs text-sm" required maxLength={80} />
        <Button size="sm" className="h-8" type="submit" disabled={pending}><Plus className="mr-1 h-4 w-4" />{L("খাত যোগ", "Add utility")}</Button>
        {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      </form>
    </div>
  );
}
