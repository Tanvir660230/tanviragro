"use client";

import React from "react";
import { Sparkles, CheckCircle, Baby, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GestationEngine, type BreedingAttempt } from "@/lib/reproduction";

interface PregnancyGestationTabProps {
  breedingAttempts: BreedingAttempt[];
  onOpenPDModal: (attempt: BreedingAttempt) => void;
  onOpenCalvingModal: (attempt: BreedingAttempt) => void;
}

export function PregnancyGestationTab({
  breedingAttempts,
  onOpenPDModal,
  onOpenCalvingModal,
}: PregnancyGestationTabProps) {
  const confirmedPregnancies = breedingAttempts.filter(
    (a) => a.status === "pregnancy_confirmed" || (a.status === "inseminated" && a.pdResult === "pregnant")
  );

  const pendingPDs = breedingAttempts.filter(
    (a) => a.status === "inseminated" && a.pdResult === "pending"
  );

  return (
    <div className="space-y-6">
      {/* Pending PD Check Triage Queue */}
      {pendingPDs.length > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Stethoscope className="h-4 w-4" />
              Pregnancy Diagnosis (PD) Checks Due ({pendingPDs.length})
            </h3>
            <span className="text-xs text-amber-700/80 dark:text-amber-400">
              Scheduled 45 days post-insemination
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingPDs.map((att) => {
              const daysPostAI = Math.floor(
                (new Date().getTime() - new Date(att.inseminationDate).getTime()) / 86400000
              );
              return (
                <div key={att.id} className="bg-card border rounded-xl p-3 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{att.cowTag || `Cow #${att.cowId.slice(0, 6)}`}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Day {daysPostAI} post-AI
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sire: {att.sireTagOrCode} • Insem: {att.inseminationDate}
                  </p>
      {/* Confirmed Active Pregnancies & Gestation Milestones */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Active Pregnancies &amp; Gestation Tracker ({confirmedPregnancies.length})
          </h3>
        </div>

        {confirmedPregnancies.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-2xl p-6">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-sm">No confirmed pregnancies in herd</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Record pregnancy diagnosis results for inseminated cows to track gestation progress and dry-off dates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmedPregnancies.map((att) => {
              const gestation = GestationEngine.getGestationDetails(
                att.inseminationDate,
                att.cowBreed || att.sireBreed
              );

              return (
                <div
                  key={att.id}
                  className="bg-card border rounded-2xl p-4 sm:p-5 transition-all hover:shadow-xs space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base sm:text-lg">
                          {att.cowTag || `Cow #${att.cowId.slice(0, 6)}`}
                        </span>
                        <Badge
                          variant={gestation.isOverdue ? "destructive" : "secondary"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          {gestation.trimester}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sire: <span className="font-medium text-foreground">{att.sireTagOrCode}</span> • Insem: {att.inseminationDate}
                      </p>
                    </div>

                    <Button
                      onClick={() => onOpenCalvingModal(att)}
                      size="sm"
                      className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                    >
                      <Baby className="h-3.5 w-3.5" />
                      Record Birth
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Day {gestation.gestationDays} of {gestation.totalGestationDays}</span>
                      <span className="text-purple-600 dark:text-purple-400">{gestation.percentComplete}% Completed</span>
                    </div>
                    <div className="w-full bg-purple-100 dark:bg-purple-950/60 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, gestation.percentComplete))}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/40 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Dry Off</span>
                      <span className="font-semibold text-foreground">{att.dryOffDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Expected Calving</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {att.expectedCalvingDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Days Remaining</span>
                      <span className={`font-bold ${gestation.isOverdue ? "text-rose-600" : "text-foreground"}`}>
                        {gestation.isOverdue ? `Overdue ${Math.abs(gestation.daysRemaining)}d` : `${gestation.daysRemaining}d`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

                  <Button
                    onClick={() => onOpenPDModal(att)}
                    size="sm"
                    className="w-full text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <CheckCircle className="h-3 w-3" /> Record PD Result
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
