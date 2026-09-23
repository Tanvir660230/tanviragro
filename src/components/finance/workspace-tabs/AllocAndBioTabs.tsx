"use client";

import React from "react";
import { Plus } from "lucide-react";

export function AllocationTab(props: {
  costAllocations: Array<{ id: string; batchNumber: string; category: string; method: string; amount: number; recipientsCount: number; appliedDate: string }>;
  onOpenAllocModal: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/60 flex justify-between items-center">
        <h3 className="text-sm font-bold text-foreground">Batch Cost Allocation Audit Logs</h3>
        <button onClick={props.onOpenAllocModal} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
          <Plus className="h-3.5 w-3.5 inline mr-1" /> New Allocation
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
            <tr>
              <th className="p-3">Batch Number</th>
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3">Method</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-center">Head Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {props.costAllocations.map((alloc) => (
              <tr key={alloc.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono font-semibold text-foreground">{alloc.batchNumber}</td>
                <td className="p-3 text-muted-foreground">{alloc.appliedDate}</td>
                <td className="p-3 font-medium text-foreground">{alloc.category}</td>
                <td className="p-3 text-muted-foreground capitalize">{alloc.method.replace(/_/g, " ")}</td>
                <td className="p-3 text-right font-bold text-foreground">৳{alloc.amount.toLocaleString()}</td>
                <td className="p-3 text-center">{alloc.recipientsCount} head</td>
              </tr>
            ))}
            {props.costAllocations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground italic">No batch allocations recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ValuationTab(props: {
  biologicalValuations: Array<{ id: string; valuationNumber: string; valuationDate: string; marketRatePerKg: number; totalHeadCount: number; fairValue: number; unrealizedGainLoss: number }>;
  onOpenBioModal: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/60 flex justify-between items-center">
        <h3 className="text-sm font-bold text-foreground">IAS 41 Agricultural Fair Value History</h3>
        <button onClick={props.onOpenBioModal} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">
          <Plus className="h-3.5 w-3.5 inline mr-1" /> Revalue Herd
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
            <tr>
              <th className="p-3">Valuation Ref</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Market Rate</th>
              <th className="p-3 text-center">Head Count</th>
              <th className="p-3 text-right">Fair Value</th>
              <th className="p-3 text-right">Unrealized Gain/Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {props.biologicalValuations.map((bio) => (
              <tr key={bio.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono font-semibold text-foreground">{bio.valuationNumber}</td>
                <td className="p-3 text-muted-foreground">{bio.valuationDate}</td>
                <td className="p-3 text-right text-foreground">৳{bio.marketRatePerKg}/kg</td>
                <td className="p-3 text-center">{bio.totalHeadCount} head</td>
                <td className="p-3 text-right font-bold text-foreground">৳{bio.fairValue.toLocaleString()}</td>
                <td className={`p-3 text-right font-bold ${bio.unrealizedGainLoss >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {bio.unrealizedGainLoss >= 0 ? "+" : ""}৳{bio.unrealizedGainLoss.toLocaleString()}
                </td>
              </tr>
            ))}
            {props.biologicalValuations.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground italic">No biological valuations recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
