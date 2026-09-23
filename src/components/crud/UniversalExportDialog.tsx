"use client";

import React, { useState } from "react";
import { X, Download, FileSpreadsheet, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExportFormat = "csv" | "excel" | "json";

export interface UniversalExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  totalRecords: number;
  selectedRecordsCount?: number;
  onExport: (format: ExportFormat, scope: "all" | "selected") => void;
}

export function UniversalExportDialog({
  open,
  onOpenChange,
  title = "Export Data",
  totalRecords,
  selectedRecordsCount = 0,
  onExport,
}: UniversalExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<"all" | "selected">(
    selectedRecordsCount > 0 ? "selected" : "all"
  );

  if (!open) return null;

  const handleExport = () => {
    onExport(format, scope);
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-5 space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground font-serif">{title}</h3>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scope selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Export Scope</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium text-left transition-all",
                scope === "all"
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <div>All Records</div>
              <div className="text-[10px] text-muted-foreground font-mono">{totalRecords} items</div>
            </button>
            <button
              type="button"
              disabled={selectedRecordsCount === 0}
              onClick={() => setScope("selected")}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium text-left transition-all disabled:opacity-40",
                scope === "selected"
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <div>Selected Only</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {selectedRecordsCount} items
              </div>
            </button>
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">File Format</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "csv", label: "CSV File", icon: FileText },
              { id: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet },
              { id: "json", label: "JSON Raw", icon: FileText },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id as ExportFormat)}
                className={cn(
                  "p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs transition-all",
                  format === fmt.id
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <fmt.icon className="h-4 w-4" />
                <span className="text-[11px]">{fmt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted border border-border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}
