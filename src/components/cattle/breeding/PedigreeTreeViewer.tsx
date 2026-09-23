"use client";

import React, { useState } from "react";
import { Dna, ShieldAlert, ShieldCheck, ChevronRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type PedigreeNode, type InbreedingEvaluation } from "@/lib/reproduction";

interface PedigreeTreeViewerProps {
  rootNode: PedigreeNode | null;
  inbreedingEval?: InbreedingEvaluation | null;
}

function PedigreeCard({ node, label }: { node: PedigreeNode | null | undefined; label: string }) {
  if (!node) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-border/70 bg-muted/20 text-center text-xs text-muted-foreground min-w-[140px]">
        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 block">{label}</span>
        <span className="italic mt-1 block">Unknown / Unregistered</span>
      </div>
    );
  }

  const isMale = node.gender === "bull" || label.toLowerCase().includes("sire");

  return (
    <div
      className={`p-3 rounded-xl border min-w-[150px] space-y-1 transition-all shadow-2xs ${
        isMale
          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40"
          : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {isMale ? "♂ Sire" : "♀ Dam"}
        </Badge>
      </div>
      <div className="font-bold text-sm truncate text-foreground">{node.tagNumber}</div>
      {node.name && <div className="text-[11px] text-muted-foreground truncate">{node.name}</div>}
      {node.breed && <div className="text-[10px] text-muted-foreground/80 truncate">{node.breed}</div>}
    </div>
  );
}

export function PedigreeTreeViewer({ rootNode, inbreedingEval }: PedigreeTreeViewerProps) {
  if (!rootNode) {
    return (
      <div className="text-center py-8 text-xs text-muted-foreground">
        Select an animal to view its multi-generation pedigree and lineage.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inbreeding Risk Header */}
      {inbreedingEval && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            inbreedingEval.riskLevel === "critical" || inbreedingEval.riskLevel === "high"
              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-200"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {inbreedingEval.isMatingRecommended ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">Wright&apos;s Inbreeding Coeff (F): {inbreedingEval.inbreedingPercentage}%</span>
              <p className="text-[11px] opacity-85 mt-0.5">{inbreedingEval.warningMessage || "Genetic diversity safe."}</p>
            </div>
          </div>
          <Badge variant={inbreedingEval.isMatingRecommended ? "secondary" : "destructive"} className="uppercase text-[10px]">
            {inbreedingEval.riskLevel} Risk
          </Badge>
        </div>
      )}

      {/* 3-Generation Pedigree Tree Grid */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[650px] grid grid-cols-3 gap-4 items-center">
          {/* Generation 0: Animal */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground block text-center">Offspring</span>
            <PedigreeCard node={rootNode} label="Target Animal" />
          </div>

          {/* Generation 1: Parents */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-muted-foreground block text-center">Parents (Gen 1)</span>
            <PedigreeCard node={rootNode.sire} label="Sire (Father)" />
            <PedigreeCard node={rootNode.dam} label="Dam (Mother)" />
          </div>

          {/* Generation 2: Grandparents */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground block text-center">Grandparents (Gen 2)</span>
            <div className="space-y-1">
              <PedigreeCard node={rootNode.sire?.sire} label="Paternal Grandsire" />
              <PedigreeCard node={rootNode.sire?.dam} label="Paternal Granddam" />
            </div>
            <div className="space-y-1 pt-2">
              <PedigreeCard node={rootNode.dam?.sire} label="Maternal Grandsire" />
              <PedigreeCard node={rootNode.dam?.dam} label="Maternal Granddam" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
