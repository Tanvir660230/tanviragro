"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UniversalImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  expectedColumns?: string[];
  onImport: (rows: Record<string, any>[]) => Promise<void> | void;
}

export function UniversalImportWizard({
  open,
  onOpenChange,
  title = "Import Data Wizard",
  expectedColumns = [],
  onImport,
}: UniversalImportWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    // Simple mock parser for test/preview
    setParsedRows([
      { id: "row-1", tagNumber: "TAG-901", breed: "Brahman", weightKg: 520 },
      { id: "row-2", tagNumber: "TAG-902", breed: "Sahiwal", weightKg: 480 },
    ]);
    setStep(2);
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      await onImport(parsedRows);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-5 space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground font-serif">{title}</h3>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-2xl hover:border-primary/50 cursor-pointer bg-muted/20 transition-all">
              <UploadCloud className="h-8 w-8 text-primary mb-2" />
              <span className="text-xs font-semibold text-foreground">Click to upload or drag and drop</span>
              <span className="text-[11px] text-muted-foreground mt-1">Supports CSV, XLSX up to 10MB</span>
              <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
            </label>

            {expectedColumns.length > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                <span className="font-semibold text-foreground">Expected CSV Columns:</span>
                <p className="font-mono text-[11px] text-muted-foreground">{expectedColumns.join(", ")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Parsed {parsedRows.length} valid rows from {fileName}</span>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-border text-xs">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Data Sample</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">{JSON.stringify(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted border border-border"
          >
            {step === 2 ? "Back" : "Cancel"}
          </button>
          {step === 2 && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm & Import ({parsedRows.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
