"use client";

import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { addPartnerTransaction } from "@/app/dashboard/(app)/partners/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowUpCircle, ArrowDownCircle, Plus, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

export interface CapitalTxn {
  id: string;
  partner_id: string;
  partner_name: string;
  amount: number;
  type: "investment" | "withdrawal";
  recorded_at: string;
  notes: string | null;
}

interface Props {
  transactions: CapitalTxn[];
  partners: { id: string; name: string }[];
  mgmtFeeRate: number;
}

function fmt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function CapitalLedger({ transactions, partners, mgmtFeeRate }: Props) {
  const SHOW_LIMIT = 3;
  const hasPartners = partners.length > 0;
  const [open, setOpen] = useState(false);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [txnType, setTxnType] = useState<"investment" | "withdrawal">("investment");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [state, action, pending] = useActionState(addPartnerTransaction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Transaction saved");
      setTimeout(() => {
        setOpen(false);
        setSelectedPartnerId("");
        setTxnType("investment");
      }, 0);
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  // Sort oldest → newest for running balance
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const withBalance = sorted.reduce((acc, txn) => {
    const lastBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    const balance = lastBalance + (txn.type === "investment" ? txn.amount : -txn.amount);
    acc.push({ ...txn, balance });
    return acc;
  }, [] as (CapitalTxn & { balance: number })[]);

  // Display newest first
  const displayed = [...withBalance].reverse();

  const totalIn = transactions
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const netCapital = totalIn - totalOut;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Capital Ledger</p>
            <p className="text-xs text-muted-foreground">All capital in / out across partners</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mgmtFeeRate > 0 && (
            <Link
              href="/dashboard/settings?tab=finance"
              className="text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1.5 transition-colors"
            >
              Mgmt fee: {mgmtFeeRate}%
            </Link>
          )}
          {!hasPartners ? (
            <span className="text-xs text-muted-foreground border border-border/50 rounded-lg px-3 py-1.5">
              Register a partner first
            </span>
          ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              <Plus className="h-3.5 w-3.5" />
              Add Capital
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Capital Transaction</DialogTitle>
              </DialogHeader>
              <form
                action={(fd) => {
                  fd.set("partner_id", selectedPartnerId);
                  fd.set("type", txnType);
                  action(fd);
                }}
                className="space-y-4 mt-2"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">Partner</Label>
                  <Select
                    value={selectedPartnerId === "" ? null : selectedPartnerId}
                    onValueChange={(v) => setSelectedPartnerId(v ?? "")}
                    required
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {selectedPartnerId
                          ? partners.find((p) => p.id === selectedPartnerId)?.name
                          : <span className="text-muted-foreground">Select partner</span>}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Transaction Type</Label>
                  <Select
                    value={txnType}
                    onValueChange={(v) => setTxnType(v as "investment" | "withdrawal")}
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {txnType === "investment" ? "Capital In (Investment)" : "Capital Out (Withdrawal)"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investment">Capital In (Investment)</SelectItem>
                      <SelectItem value="withdrawal">Capital Out (Withdrawal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount (৳)</Label>
                    <Input name="amount" type="number" min="1" step="any" placeholder="0" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <Input name="recorded_at" type="date" max={today} defaultValue={today} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea name="notes" maxLength={500} placeholder="Cash, bank transfer, cheque..." rows={2} />
                </div>
                {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "Saving..." : txnType === "investment" ? "Record Investment" : "Record Withdrawal"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total In</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fmt(totalIn)}</p>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Out</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-red-700 dark:text-red-300">{fmt(totalOut)}</p>
        </div>
        <div className={cn(
          "rounded-xl border px-4 py-3",
          netCapital >= 0
            ? "border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20"
            : "border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20"
        )}>
          <div className="flex items-center gap-1 mb-1">
            <Wallet className={cn("h-3.5 w-3.5", netCapital >= 0 ? "text-blue-500" : "text-orange-500")} />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Capital</p>
          </div>
          <p className={cn(
            "text-lg font-bold tabular-nums",
            netCapital >= 0 ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"
          )}>
            {netCapital >= 0 ? "" : "−"}{fmt(netCapital)}
          </p>
        </div>
      </div>

      {/* Ledger table */}
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card px-6 py-10 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          {!hasPartners ? (
            <>
              <p className="text-sm font-medium text-foreground mb-1">Register Yourself as a Partner First</p>
              <p className="text-xs text-muted-foreground max-w-[300px] mx-auto">
                Use the &quot;Add Partner&quot; button above to register yourself as the founder, then come back here to record capital injections.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No capital transactions yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Record investments or withdrawals to start tracking capital flow.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Partner</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Running Balance</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(showAllTxns ? displayed : displayed.slice(0, SHOW_LIMIT)).map((txn, i) => (
                  <tr key={txn.id} className={i === 0 ? "bg-card" : "bg-card/50"}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(txn.recorded_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{txn.partner_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {txn.type === "investment"
                          ? <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                          : <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                        }
                        <span className={`text-xs font-medium ${
                          txn.type === "investment"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }`}>
                          {txn.type === "investment" ? "Capital In" : "Withdrawal"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      <span className={txn.type === "investment" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                        {txn.type === "investment" ? "+" : "−"}{fmt(txn.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {txn.balance >= 0 ? "" : "−"}{fmt(txn.balance)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell max-w-[180px] truncate">
                      {txn.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAllTxns && displayed.length > SHOW_LIMIT && (
            <div className="border-t border-border/60 px-4 py-3 text-center">
              <button
                onClick={() => setShowAllTxns(true)}
                className="text-sm text-primary hover:underline font-medium"
              >
                Show {displayed.length - SHOW_LIMIT} more transaction{displayed.length - SHOW_LIMIT !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
