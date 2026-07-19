"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Plus, Trash2, CreditCard, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Landmark, Wallet, BadgeCheck } from "lucide-react";
import { createLoan, recordLoanPayment, deleteLoan } from "@/app/dashboard/(app)/finance/loans/actions";
import type { LoanFormState } from "@/app/dashboard/(app)/finance/loans/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useTranslation } from "@/i18n/I18nProvider";
import { calcAccruedInterest } from "@/lib/loan-utils";
import { cn } from "@/lib/utils";

export type LoanRow = {
  id: string;
  lender_name: string;
  principal_amount: number;
  interest_rate_pct: number;
  loan_date: string;
  due_date: string | null;
  purpose: string | null;
  status: "active" | "paid";
  notes: string | null;
  payments: { id: string; amount: number; paid_at: string; notes: string | null }[];
};

function bdt(n: number) {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysUntil(dateStr: string, now: number) {
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - now) / 86400000);
}

// ── Add Loan Dialog ────────────────────────────────────────────────────────

function AddLoanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const tr = t.finance.loans;
  const [state, action, pending] = useActionState<LoanFormState, FormData>(createLoan, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(tr.loan_saved);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onClose]);

  if (!open) return null;

  const inputClass = "mt-1 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-card transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-card shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">{tr.add_dialog_title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg h-7 w-7 flex items-center justify-center text-xl leading-none transition-colors">×</button>
        </div>
        <form action={action} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">{tr.lender_name} *</label>
              <input name="lender_name" required placeholder={tr.lender_placeholder} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr.principal} *</label>
              <input name="principal_amount" type="number" min="1" step="1" required placeholder="100000" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr.interest_rate}</label>
              <input name="interest_rate_pct" type="number" min="0" step="0.1" defaultValue="0" placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr.loan_date} *</label>
              <input name="loan_date" type="date" required defaultValue={todayStr()} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{tr.due_date}</label>
              <input name="due_date" type="date" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">{tr.purpose}</label>
              <input name="purpose" placeholder={tr.purpose_placeholder} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">{tr.notes}</label>
              <textarea name="notes" rows={2} className={cn(inputClass, "resize-none")} />
            </div>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">{tr.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card hover:bg-primary/90 hover:shadow transition-all disabled:opacity-60">
              {pending ? tr.saving : tr.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pay Dialog ─────────────────────────────────────────────────────────────

function PayDialog({ loan, open, onClose }: { loan: LoanRow; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const tr = t.finance.loans;
  const [state, action, pending] = useActionState<LoanFormState, FormData>(recordLoanPayment, undefined);

  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  const accruedInterest = calcAccruedInterest(loan.principal_amount, loan.interest_rate_pct, loan.loan_date, todayStr(), [], loan.status);
  const remaining = loan.principal_amount + accruedInterest - totalPaid;

  useEffect(() => {
    if (state?.success) {
      toast.success(tr.payment_saved);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, onClose]);

  if (!open) return null;

  const inputClass = "mt-1 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm shadow-card transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">{tr.pay_dialog_title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg h-7 w-7 flex items-center justify-center text-xl leading-none transition-colors">×</button>
        </div>
        <form action={action} className="p-6 space-y-4">
          <input type="hidden" name="loan_id" value={loan.id} />
          <div className="rounded-xl bg-red-500/[0.06] border border-red-500/10 px-4 py-3 text-sm">
            <span className="text-muted-foreground">{loan.lender_name} — {tr.due_label}: </span>
            <span className="font-bold text-destructive">{bdt(Math.max(0, remaining))}</span>
            {accruedInterest > 0 && (
              <span className="block text-xs text-muted-foreground mt-0.5">
                {tr.includes_interest.replace("{{amount}}", bdt(accruedInterest))}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{tr.amount} *</label>
            <input name="amount" type="number" min="1" max={remaining} step="1" required defaultValue={Math.round(remaining)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{tr.date} *</label>
            <input name="paid_at" type="date" required defaultValue={todayStr()} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{tr.notes}</label>
            <input name="notes" className={inputClass} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">{tr.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card hover:bg-primary/90 hover:shadow transition-all disabled:opacity-60">
              {pending ? tr.saving : tr.pay_button}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Loan Card ──────────────────────────────────────────────────────────────

function LoanCard({ loan }: { loan: LoanRow }) {
  const { t } = useTranslation();
  const tr = t.finance.loans;
  const [payOpen, setPayOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now] = useState(() => Date.now());

  const totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
  const accruedInterest = calcAccruedInterest(loan.principal_amount, loan.interest_rate_pct, loan.loan_date, todayStr(), [], loan.status);
  const totalOwed = loan.principal_amount + accruedInterest;
  const remaining = Math.max(0, totalOwed - totalPaid);
  const pct = totalOwed > 0 ? Math.min(100, (totalPaid / totalOwed) * 100) : 0;
  const isPaid = loan.status === "paid" || remaining === 0;

  const daysLeft = loan.due_date ? daysUntil(loan.due_date, now) : null;
  const overdue = daysLeft !== null && daysLeft < 0 && !isPaid;
  const dueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && !isPaid;

  async function handleDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    const r = await deleteLoan(loan.id);
    if (r.error) toast.error(r.error);
    setDeleting(false);
  }

  return (
    <>
      <PayDialog loan={loan} open={payOpen} onClose={() => setPayOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title={tr.delete_title}
        description={tr.delete_desc}
        confirmLabel={tr.delete_confirm}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className={cn("rounded-xl bg-card p-5 space-y-3.5 shadow-card ring-1 transition-shadow hover:shadow-md", overdue ? "ring-destructive/30" : isPaid ? "ring-emerald-500/20" : "ring-foreground/5")}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{loan.lender_name}</span>
              {isPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> {tr.paid_tag}
                </span>
              ) : overdue ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3 w-3" /> {tr.overdue_tag}
                </span>
              ) : dueSoon ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3 w-3" /> {tr.due_soon_tag.replace("{{n}}", String(daysLeft))}
                </span>
              ) : null}
            </div>
            {loan.purpose && <p className="text-xs text-muted-foreground mt-0.5">{loan.purpose}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isPaid && (
              <button onClick={() => setPayOpen(true)} className="rounded-lg bg-primary/10 text-primary px-2.5 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" /> {tr.pay}
              </button>
            )}
            <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/40 px-2 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{tr.principal_label}</p>
            <p className="font-bold text-sm tracking-tight tabular-nums">{bdt(loan.principal_amount)}</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 px-2 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{tr.paid_label}</p>
            <p className="font-bold text-sm tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">{bdt(totalPaid)}</p>
          </div>
          <div className={cn("rounded-xl px-2 py-2.5", isPaid ? "bg-muted/30" : "bg-red-500/10")}>
            <p className="text-xs font-medium text-muted-foreground">{tr.remaining_label}</p>
            <p className={cn("font-bold text-sm tracking-tight tabular-nums", !isPaid && "text-destructive")}>{bdt(remaining)}</p>
          </div>
        </div>
        {accruedInterest > 0 && !isPaid && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {tr.includes_interest.replace("{{amount}}", bdt(accruedInterest))}
          </p>
        )}

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{tr.loan_date_meta.replace("{{date}}", fmtDate(loan.loan_date))}</span>
          {loan.due_date && <span>{tr.due_date_meta.replace("{{date}}", fmtDate(loan.due_date))}</span>}
          {loan.interest_rate_pct > 0 && <span>{tr.interest_meta.replace("{{pct}}", String(loan.interest_rate_pct))}</span>}
        </div>

        {/* Payments history */}
        {loan.payments.length > 0 && (
          <div>
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {tr.payments_count.replace("{{n}}", String(loan.payments.length))}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5">
                {loan.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{fmtDate(p.paid_at)}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{bdt(p.amount)}</span>
                    {p.notes && <span className="text-muted-foreground truncate max-w-[120px]">{p.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function LoanDashboard({ loans }: { loans: LoanRow[] }) {
  const { t } = useTranslation();
  const tr = t.finance.loans;
  const [addOpen, setAddOpen] = useState(false);

  const activeLoans = loans.filter((l) => l.status === "active");
  const paidLoans   = loans.filter((l) => l.status === "paid");

  const today = todayStr();
  const totalPaidSoFar = loans.reduce(
    (s, l) => s + l.payments.reduce((ps, p) => ps + p.amount, 0),
    0
  );
  // Total debt = original principal borrowed across all active loans.
  const totalDebt = activeLoans.reduce((s, l) => s + Number(l.principal_amount), 0);
  // Remaining = what is still owed: principal + accrued interest − payments made.
  const remaining = activeLoans.reduce((s, l) => {
    const paid = l.payments.reduce((ps, p) => ps + p.amount, 0);
    const interest = calcAccruedInterest(l.principal_amount, l.interest_rate_pct, l.loan_date, today, [], l.status);
    return s + Math.max(0, l.principal_amount + interest - paid);
  }, 0);

  return (
    <>
      <AddLoanDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="group relative overflow-hidden rounded-xl bg-card p-4 sm:p-5 shadow-card border border-red-500/10 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-500/[0.06] to-transparent" />
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.total_debt}</p>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-destructive">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p className="relative mt-2.5 text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums text-destructive">{bdt(totalDebt)}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl bg-card p-4 sm:p-5 shadow-card border border-amber-500/10 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] to-transparent" />
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.remaining}</p>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="relative mt-2.5 text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums">{bdt(remaining)}</p>
        </div>
        <div className="group relative overflow-hidden rounded-xl bg-card p-4 sm:p-5 shadow-card border border-emerald-500/10 transition-all hover:-translate-y-0.5 hover:shadow-md col-span-2 sm:col-span-1">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] to-transparent" />
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.total_paid}</p>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="relative mt-2.5 text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">{bdt(totalPaidSoFar)}</p>
        </div>
      </div>

      {/* Active Loans */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm tracking-tight">{tr.active_loans.replace("{{n}}", String(activeLoans.length))}</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-card hover:bg-primary/90 hover:shadow transition-all"
        >
          <Plus className="h-4 w-4" /> {tr.new_loan}
        </button>
      </div>

      {activeLoans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Landmark className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{tr.no_active_loans}</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {activeLoans.map((l) => <LoanCard key={l.id} loan={l} />)}
        </div>
      )}

      {/* Paid Loans */}
      {paidLoans.length > 0 && (
        <>
          <h2 className="font-semibold text-sm tracking-tight text-muted-foreground mb-3">{tr.paid_loans.replace("{{n}}", String(paidLoans.length))}</h2>
          <div className="space-y-3 opacity-60">
            {paidLoans.map((l) => <LoanCard key={l.id} loan={l} />)}
          </div>
        </>
      )}
    </>
  );
}
