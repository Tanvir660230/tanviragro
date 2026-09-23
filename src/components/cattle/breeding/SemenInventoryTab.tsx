"use client";

import React from "react";
import { Dna, Plus, Layers, ShieldCheck, ThermometerSnowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type SemenInventoryItem } from "@/lib/reproduction";

interface SemenInventoryTabProps {
  semenList: SemenInventoryItem[];
  onOpenAddStock: () => void;
}

export function SemenInventoryTab({ semenList, onOpenAddStock }: SemenInventoryTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-2xl p-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Dna className="h-4 w-4 text-blue-500" />
            Cryogenic Semen Straw Inventory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage high-genetic value bull semen straws, motility checks, cryogenic tank canister allocations, and unit straw costs.
          </p>
        </div>
        <Button onClick={onOpenAddStock} size="sm" className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4" />
          Add Semen Stock
        </Button>
      </div>

      {semenList.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-2xl p-6">
          <Dna className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-sm">No semen straws registered</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Keep track of bull genetics, straw codes, and cryogenic canister storage to streamline AI breeding sessions.
          </p>
          <Button onClick={onOpenAddStock} size="sm" variant="outline" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Add Semen Batch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {semenList.map((s) => (
            <div key={s.id} className="bg-card border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{s.bullName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.bullCode}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.breed}</p>
                </div>
                <Badge
                  variant={s.strawsInStock > 0 ? "secondary" : "destructive"}
                  className="text-xs font-bold shrink-0"
                >
                  {s.strawsInStock} Straws Left
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Straw Batch Code</span>
                  <span className="font-semibold text-foreground font-mono">{s.strawCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Unit Straw Cost</span>
                  <span className="font-semibold text-foreground">৳{s.costPerStrawBdt.toLocaleString()}</span>
                </div>
                {s.storageCanister && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Tank Canister</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <ThermometerSnowflake className="h-3 w-3 text-blue-500" />
                      {s.storageCanister}
                    </span>
                  </div>
                )}
                {s.motilityPercent != null && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Motility</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {s.motilityPercent}% Progressive
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
