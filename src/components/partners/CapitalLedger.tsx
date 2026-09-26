"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { CapitalLedgerTable } from "./CapitalLedgerTable";
import type { CapitalTxn } from "./capital-types";
import { useL } from "@/i18n/text";
import { partnerTxnLabel } from "@/lib/partners/labels";
import { useTranslation } from "@/i18n/I18nProvider";
import { todayDhaka } from "@/lib/dates";

export type { CapitalTxn };

interface Props {
  transactions: CapitalTxn[];
}

/** Every capital entry of every partner, with the running total (adding one: the button above). */
export function CapitalLedger({ transactions }: Props) {
  const L = useL();
  const { locale } = useTranslation();

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

  function exportToCsv() {
    if (displayed.length === 0) {
      toast.error(L("নামানোর মতো কোনো লেনদেন নেই", "No capital transactions to export"));
      return;
    }
    const headers = ["Date", "Partner", "Type", "Amount (BDT)", "Running Balance (BDT)", "Notes"];
    const rows = displayed.map((t) => [
      `"${t.recorded_at}"`,
      `"${t.partner_name.replace(/"/g, '""')}"`,
      `"${partnerTxnLabel(t.type, locale)}"`,
      t.type === "investment" ? t.amount : -t.amount,
      t.balance,
      `"${(t.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `capital_ledger_${todayDhaka()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(L("CSV নামানো হলো", "Capital ledger exported to CSV"));
  }

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{L("সব মূলধনের খাতা", "Total Capital Ledger")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {L("সব অংশীদারের জমা-তোলার হিসাব", "Running audit of all partner equity transactions")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {transactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              className="gap-1.5 text-xs h-9"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              {L("CSV নামান", "Export CSV")}
            </Button>
          )}

        </div>
      </div>

      <CapitalLedgerTable displayed={displayed} />
    </div>
  );
}
