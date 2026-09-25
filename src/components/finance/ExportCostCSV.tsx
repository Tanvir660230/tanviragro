"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { CostEntry } from "./CostList";
import { useL } from "@/i18n/text";

export function ExportCostCSV({ entries }: { entries: CostEntry[] }) {
  const L = useL();
  function handleExport() {
    const header = "Date,Type,Category,Description,Amount (৳)";
    const rows = entries.map((e) =>
      [
        e.recorded_at,
        e.type,
        e.category,
        `"${(e.description ?? "").replace(/"/g, '""')}"`,
        e.amount,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {L("CSV নামান", "Export CSV")}
    </button>
  );
}
