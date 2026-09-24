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
const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export function UtilityExpensesClient(props: Props) {
  const { categories, expenses, audits, summary, canCreate, canEdit, canDelete, canManageCategories } = props;
  const [editing, setEditing] = useState<UtilityExpense | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const nameOf = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? "Unknown" : "Uncategorised (old entry)");
  }, [categories]);
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
    ...(summary.byCategory.uncategorised ? [{ key: "uncategorised", name: "Uncategorised (old entries)", active: true }] : []),
  ].filter((r) => summary.byCategory[r.key]);
  const visible = filter === "all" ? expenses : expenses.filter((e) => (e.category_id ?? "uncategorised") === filter);

  function openBill(id: string) {
    startTransition(async () => {
      const res = await getBillUrl(id);
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error(res.error ?? "Could not open the bill");
    });
  }
  function remove(e: UtilityExpense) {
    if (!confirm(`Delete this ${taka(Number(e.amount))} expense? It can be restored from Trash.`)) return;
    startTransition(async () => {
      const res = await deleteUtilityExpense(e.id);
      if (res.error) toast.error(res.error);
      else { toast.success("Expense deleted"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ["This month", summary.totals[thisMonth] ?? 0],
          ["Last month", summary.totals[lastMonth] ?? 0],
          ["Last 12 months", yearTotal],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{taka(value as number)}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border text-sm font-semibold">Monthly utility expenses</div>
        {summaryRows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Utility</th>
                  {summary.months.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold whitespace-nowrap">{monthLabel(m)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaryRows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}{!r.active && <span className="ml-1 text-muted-foreground">(disabled)</span>}</td>
                    {summary.months.map((m) => {
                      const v = summary.byCategory[r.key]?.[m];
                      return <td key={m} className="px-2 py-2 text-right tabular-nums">{v ? taka(v) : "—"}</td>;
                    })}
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-3 py-2">Total</td>
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
          <span className="text-sm font-semibold">Expense history</span>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Filter by utility"
            >
              <option value="all">All utilities</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              {summary.byCategory.uncategorised && <option value="uncategorised">Uncategorised (old entries)</option>}
            </select>
            {canCreate && (
              <Button size="sm" onClick={() => setEditing("new")} disabled={!categories.some((c) => c.is_active)}>
                <Plus className="mr-1 h-4 w-4" /> Add expense
              </Button>
            )}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No data</p>
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
                        <FileText className="mr-1 h-3.5 w-3.5" /> Bill
                      </Button>
                    )}
                    {changes.length > 0 && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setHistoryFor(historyFor === e.id ? null : e.id)}>
                        <History className="mr-1 h-3.5 w-3.5" /> Edited {changes.length}×
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(e)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Correct
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => remove(e)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                  {historyFor === e.id && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-muted/40 p-2 text-xs">
                      {changes.map((a, i) => (
                        <li key={i}>
                          <span className="text-muted-foreground">{new Date(a.changed_at).toLocaleString("en-GB")}:</span>{" "}
                          {describeChange(a, nameOf)}
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

function describeChange(a: UtilityAudit, nameOf: (id: string | null) => string): string {
  if (a.action === "restore") return "restored from Trash";
  const o = a.old_row ?? {};
  const n = a.new_row ?? {};
  const parts: string[] = [];
  if (o.amount !== n.amount) parts.push(`amount ${taka(Number(o.amount))} → ${taka(Number(n.amount))}`);
  if (o.recorded_at !== n.recorded_at) parts.push(`date ${String(o.recorded_at).slice(0, 10)} → ${String(n.recorded_at).slice(0, 10)}`);
  if (o.category_id !== n.category_id || o.category !== n.category)
    parts.push(`utility ${o.category_id ? nameOf(o.category_id as string) : String(o.category)} → ${n.category_id ? nameOf(n.category_id as string) : String(n.category)}`);
  if (o.description !== n.description) parts.push("description changed");
  if (o.attachment_path !== n.attachment_path) parts.push("bill replaced");
  return parts.length ? parts.join("; ") : "updated";
}

function ExpenseDialog({ expense, categories, today, onClose }: {
  expense: UtilityExpense | null; categories: ExpenseCategory[]; today: string; onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UtilityFormState, FormData>(saveUtilityExpense, undefined);
  useEffect(() => {
    if (state?.success) { toast.success(expense ? "Expense corrected (change recorded in history)" : "Expense added"); onClose(); router.refresh(); }
  }, [state?.success, expense, onClose, router]);

  const options = categories.filter((c) => c.is_active || c.id === expense?.category_id);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{expense ? "Correct utility expense" : "Add utility expense"}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          {expense && <input type="hidden" name="id" value={expense.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="ue_cat">Utility *</Label>
            <select id="ue_cat" name="category_id" required defaultValue={expense?.category_id ?? ""}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="" disabled>Choose…</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? "" : " (disabled)"}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ue_amount">Amount (৳) *</Label>
              <Input id="ue_amount" name="amount" type="number" min="0.01" step="0.01" required defaultValue={expense?.amount ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ue_date">Date *</Label>
              <Input id="ue_date" name="recorded_at" type="date" max={today} required defaultValue={expense?.recorded_at?.slice(0, 10) ?? today} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ue_desc">Notes</Label>
            <Textarea id="ue_desc" name="description" rows={2} maxLength={500} defaultValue={expense?.description ?? ""} placeholder="e.g. bill month, meter reading, provider" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ue_bill">Bill / invoice (optional)</Label>
            <Input id="ue_bill" name="bill" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            <p className="text-xs text-muted-foreground">PDF or image, up to 5 MB.{expense?.attachment_path ? " A new file replaces the current bill link; the old file is kept." : ""}</p>
          </div>
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          {expense && <p className="text-xs text-muted-foreground">The previous values are kept in the edit history.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManager({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UtilityFormState, FormData>(createExpenseCategory, undefined);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, startTransition] = useTransition();
  useEffect(() => { if (state?.success) { toast.success("Utility added"); router.refresh(); } }, [state?.success, router]);

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
        <p className="text-sm font-semibold">Manage utilities</p>
        <p className="text-xs text-muted-foreground">Rename or disable a utility at any time. Past expenses keep their utility and stay under Utilities in the accounts.</p>
      </div>
      <ul className="divide-y divide-border">
        {categories.map((c) => {
          const value = names[c.id] ?? c.name;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <Input value={value} onChange={(e) => setNames((s) => ({ ...s, [c.id]: e.target.value }))}
                className={cn("h-8 max-w-xs text-sm", !c.is_active && "text-muted-foreground")} aria-label={`Name of ${c.name}`} />
              {value.trim() !== c.name && (
                <Button size="sm" className="h-8" disabled={busy} onClick={() => run(() => renameExpenseCategory(c.id, value), "Renamed")}>Save name</Button>
              )}
              <Button size="sm" variant="outline" className="h-8 ml-auto" disabled={busy}
                onClick={() => run(() => setExpenseCategoryActive(c.id, !c.is_active), c.is_active ? "Disabled" : "Enabled")}>
                {c.is_active ? "Disable" : "Enable"}
              </Button>
            </li>
          );
        })}
      </ul>
      <form action={action} className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border">
        <input type="hidden" name="kind" value="utility" />
        <Input name="name" placeholder="New utility, e.g. Generator fuel" className="h-8 max-w-xs text-sm" required maxLength={80} />
        <Button size="sm" className="h-8" type="submit" disabled={pending}><Plus className="mr-1 h-4 w-4" />Add utility</Button>
        {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      </form>
    </div>
  );
}
