"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type FeedNutrientProfile } from "@/lib/nutrition/nutrition-engine";

interface InventoryTabProps {
  inventoryItems: FeedNutrientProfile[];
}

export function InventoryTab({ inventoryItems }: InventoryTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="text-sm font-bold text-foreground">Live Feed Stock & Cold-Chain / Silo Balances</h3>
            <p className="text-xs text-muted-foreground">Automated FIFO deductions on every feeding session execution.</p>
          </div>
          <Link href="/dashboard/inventory/purchase">
            <Button size="sm" className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-3.5 w-3.5" />
              <span>Procure Feed</span>
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Feed Ingredient</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold text-right">Nutrient (DM / CP / TDN)</th>
                <th className="py-3 px-3 font-semibold text-right">Current Stock</th>
                <th className="py-3 px-3 font-semibold text-right">Unit Cost</th>
                <th className="py-3 px-4 font-semibold text-center">Stock Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {inventoryItems.map((item) => {
                const isLow = item.currentStockKg <= item.lowStockThresholdKg;
                const isOut = item.currentStockKg <= 0;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">
                      {item.name}
                      {item.batchNumber && (
                        <span className="block text-[10px] font-mono text-muted-foreground">
                          Batch: {item.batchNumber} {item.expiryDate ? `· Exp: ${item.expiryDate}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {item.category.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[11px]">
                      {(item.dmPercent * 100).toFixed(0)}% DM · {item.cpPercentDm}% CP · {item.tdnPercentDm}% TDN
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                      {Math.round(item.currentStockKg)} kg
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      ৳{item.costPerKgAsFed}/kg
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isOut ? (
                        <Badge variant="destructive" className="text-[10px]">Stockout (0 kg)</Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
                          Low Stock (&lt;{item.lowStockThresholdKg}kg)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Optimal Balance
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
