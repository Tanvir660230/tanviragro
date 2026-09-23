"use client";

import React from "react";
import { Baby, Calendar, Check, Scale, ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type CalvingRecord } from "@/lib/reproduction";

interface CalvingOffspringTabProps {
  calvingRecords: CalvingRecord[];
  onOpenNewCalving: () => void;
  onOpenWeaningModal?: (offspring: any) => void;
}

export function CalvingOffspringTab({
  calvingRecords,
  onOpenNewCalving,
  onOpenWeaningModal,
}: CalvingOffspringTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-2xl p-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Baby className="h-4 w-4 text-purple-500" />
            Calving &amp; Offspring Registry
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatic mother-offspring lineage linking, initial colostrum tracking, and 90-day weaning schedule.
          </p>
        </div>
        <Button onClick={onOpenNewCalving} size="sm" className="gap-1.5 shrink-0 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="h-4 w-4" />
          Register Birth Event
        </Button>
      </div>

      {calvingRecords.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-2xl p-6">
          <Baby className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-sm">No birth / calving records</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            When calves are delivered on farm, register them to automatically create animal records, lineage links, and initial birth weight logs.
          </p>
          <Button onClick={onOpenNewCalving} size="sm" variant="outline" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Register Calving
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {calvingRecords.map((cr) => (
            <div key={cr.id} className="bg-card border rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">Dam: {cr.cowTag || `Cow #${cr.cowId.slice(0, 6)}`}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {cr.calvingType} • {cr.deliveryDifficulty.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span>Calved: <strong className="text-foreground">{cr.calvingDate}</strong></span>
                  {cr.sireNameOrCode && <span>Sire: <strong>{cr.sireNameOrCode}</strong></span>}
                </div>
              </div>

              {/* Offspring cards */}
              {cr.offspring && cr.offspring.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {cr.offspring.map((calf) => (
                    <div
                      key={calf.id}
                      className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-purple-900 dark:text-purple-200">Tag: {calf.tagNumber}</span>
                        <Badge variant="outline" className="text-[10px] capitalize font-medium">
                          {calf.gender} • {calf.birthStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>Birth Wt: <strong className="text-foreground">{calf.birthWeightKg} kg</strong></span>
                        <span>Value: ৳{calf.initialValuationBdt?.toLocaleString()}</span>
                      </div>
                      {calf.weaningTargetDate && (
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-purple-200/40 dark:border-purple-800/40">
                          <span>Weaning Target:</span>
                          <span className="font-medium text-purple-700 dark:text-purple-300">
                            {calf.weaningTargetDate}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
