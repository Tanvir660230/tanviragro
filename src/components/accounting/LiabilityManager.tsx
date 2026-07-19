"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { LiabilitySummary } from "@/lib/accounting/engine";
import {
  addLiability,
  settleLiability,
  deleteLiability,
  updateOutstanding,
} from "@/app/dashboard/(app)/accounting/liability-actions";

interface Props {
  liabilities: LiabilitySummary[];
  totalLiabilities: number;
}

function fmt(n: number) {
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

export function LiabilityManager({ liabilities, totalLiabilities }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("loan");
  const [principal, setPrincipal] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [lender, setLender] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const active = liabilities.filter((l) => !l.settled_at);
  const settled = liabilities.filter((l) => l.settled_at);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleAdd() {
    const p = parseFloat(principal);
    const o = parseFloat(outstanding) || p;
    if (!name.trim() || isNaN(p) || p <= 0) return;
    startTransition(async () => {
      const res = await addLiability({ name: name.trim(), category, principal: p, outstanding: o, lender: lender.trim() || null, due_date: dueDate || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Liability added");
        setName(""); setCategory("loan"); setPrincipal(""); setOutstanding(""); setLender(""); setDueDate("");
        setShowForm(false);
      }
    });
  }

  function handleSettle(id: string) {
    startTransition(async () => {
      const res = await settleLiability(id);
      if (res.error) toast.error(res.error);
      else toast.success("Marked as settled");
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    startTransition(async () => {
      const res = await deleteLiability(id);
      if (res.error) toast.error(res.error);
      else toast.success("Liability deleted");
    });
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div>
          <p className="text-sm font-semibold">Loans & Payables</p>
          <p className="text-xs text-muted-foreground">
            {active.length} active · Total outstanding: {fmt(totalLiabilities)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-b border-border px-5 py-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Name (e.g. Sonali Bank Loan)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" placeholder="Loan name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="loan">Loan (ঋণ)</option>
                <option value="payable">Payable (বাকি)</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lender (optional)</Label>
              <Input value={lender} onChange={(e) => setLender(e.target.value)} className="h-8 text-sm" placeholder="e.g. Sonali Bank" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Principal Amount (৳)</Label>
              <Input type="number" min={1} value={principal} onChange={(e) => { setPrincipal(e.target.value); if (!outstanding) setOutstanding(e.target.value); }} className="h-8 text-sm" placeholder="100000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outstanding Balance (৳)</Label>
              <Input type="number" min={0} value={outstanding} onChange={(e) => setOutstanding(e.target.value)} className="h-8 text-sm" placeholder="Same as principal" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Due Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={isPending || !name || !principal}>Save</Button>
          </div>
        </div>
      )}

      {/* Active liabilities */}
      {active.length === 0 && !showForm ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">No active liabilities. Add loans or payables to show in Balance Sheet.</p>
      ) : (
        <div className="divide-y divide-border">
          {active.map((l) => (
            <LiabilityRow key={l.id} l={l} onSettle={handleSettle} onDelete={(id) => setConfirmDeleteId(id)} isPending={isPending} />
          ))}
        </div>
      )}

      {/* Settled */}
      {settled.length > 0 && (
        <div className="border-t border-border">
          <p className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">Settled</p>
          <div className="divide-y divide-border opacity-60">
            {settled.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm line-through">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(l.principal)} · settled</p>
                </div>
                <button onClick={() => setConfirmDeleteId(l.id)} className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Liability"
        description="Delete this liability permanently? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

function LiabilityRow({ l, onSettle, onDelete, isPending }: {
  l: LiabilitySummary;
  onSettle: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newOutstanding, setNewOutstanding] = useState(String(l.outstanding));
  const [, startTransition] = useTransition();

  const isOverdue = l.due_date && !l.settled_at && new Date(l.due_date) < new Date();

  function saveOutstanding() {
    const val = parseFloat(newOutstanding);
    if (isNaN(val) || val < 0) return;
    startTransition(async () => {
      const res = await updateOutstanding(l.id, val);
      if (res.error) toast.error(res.error);
      else { toast.success("Updated"); setEditing(false); }
    });
  }

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{l.name}</p>
          <span className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground capitalize">{l.category}</span>
          {isOverdue && <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">Overdue</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Principal: {`৳${l.principal.toLocaleString("en-IN")}`}</span>
          {l.lender && <span className="text-xs text-muted-foreground">· {l.lender}</span>}
          {l.due_date && <span className="text-xs text-muted-foreground">· due {l.due_date}</span>}
        </div>
        {editing ? (
          <div className="flex items-center gap-2 mt-1.5">
            <Input type="number" min={0} value={newOutstanding} onChange={(e) => setNewOutstanding(e.target.value)} className="h-7 w-32 text-xs" />
            <Button size="sm" className="h-7 text-xs px-2" onClick={saveOutstanding}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-foreground mt-0.5 hover:underline">
            Outstanding: {`৳${l.outstanding.toLocaleString("en-IN")}`}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onSettle(l.id)} disabled={isPending} title="Mark as settled" className="rounded p-1.5 text-muted-foreground hover:text-emerald-600 hover:bg-muted transition-colors">
          <CheckCircle className="h-4 w-4" />
        </button>
        <button onClick={() => onDelete(l.id)} disabled={isPending} title="Delete" className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
