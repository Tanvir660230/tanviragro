"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import type { WorkspaceCostItem } from "../EnterpriseLivestockFinancialWorkspace";

export function TransactionsTab(props: {
  recentCosts: WorkspaceCostItem[];
  onOpenReverseModal: (id: string, ref: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">Operational Transactions & General Ledger Impact</h3>
        <p className="text-xs text-muted-foreground">Automated double-entry records from feed, medicine, sales, and purchases.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3">Cattle / Target</th>
              <th className="p-3">Description</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {props.recentCosts.slice(0, 15).map((cost) => (
              <tr key={cost.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 text-muted-foreground whitespace-nowrap">{cost.recordedAt}</td>
                <td className="p-3 font-semibold text-foreground">{cost.category}</td>
                <td className="p-3 text-muted-foreground font-mono">
                  {cost.cattleId ? `#${cost.cattleId.slice(0, 8)}` : "Farm Overhead"}
                </td>
                <td className="p-3 text-muted-foreground max-w-xs truncate">{cost.description || "—"}</td>
                <td className="p-3 text-right font-bold text-foreground">৳{cost.amount.toLocaleString()}</td>
                <td className="p-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Posted
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => props.onOpenReverseModal(cost.id, `EXP-${cost.id.slice(0, 8)}`)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Storno
                  </button>
                </td>
              </tr>
            ))}
            {props.recentCosts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground italic">No cost entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
