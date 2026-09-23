"use client";

import React from "react";
import type { AnimalFinancialLedger } from "@/lib/financial";

export function AnimalPnLTab(props: { animalLedgers: AnimalFinancialLedger[] }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">Animal Unit Economics & Lifetime Ledger</h3>
        <p className="text-xs text-muted-foreground">Full absorption costing (feed, vet, vaccines, labor, overheads) vs valuation.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
            <tr>
              <th className="p-3">Tag / ID</th>
              <th className="p-3 text-right">Purchase</th>
              <th className="p-3 text-right">Feed Cost</th>
              <th className="p-3 text-right">Health & Vax</th>
              <th className="p-3 text-right">Total Basis</th>
              <th className="p-3 text-right">Bio / Sale Val</th>
              <th className="p-3 text-right">Net Profit</th>
              <th className="p-3 text-right">Cost/kg Gain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {props.animalLedgers.map((l) => (
              <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 font-mono font-semibold text-foreground">{l.tagId || `#${l.cattleId.slice(0, 8)}`}</td>
                <td className="p-3 text-right text-muted-foreground">৳{l.purchaseCost.toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">৳{l.feedCost.toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">৳{(l.medicineCost + l.vaccineCost).toLocaleString()}</td>
                <td className="p-3 text-right font-bold text-foreground">৳{l.totalAccumulatedCost.toLocaleString()}</td>
                <td className="p-3 text-right font-semibold text-emerald-600">
                  ৳{(l.status === "sold" ? l.saleRevenue : l.currentBiologicalValue).toLocaleString()}
                </td>
                <td className={`p-3 text-right font-bold ${l.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  ৳{l.netProfit.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono text-muted-foreground">৳{l.costPerKgGain}/kg</td>
              </tr>
            ))}
            {props.animalLedgers.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground italic">No animal ledgers available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
