"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useL } from "@/i18n/text";
import { exportToCsv, exportToExcel, exportToPdf, printDataGrid } from "./export-utils";
import type { GridColumn } from "./types";

export interface DataGridExportModalProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: T[];
  selectedRows: T[];
  allDataset?: T[];
  columns: GridColumn<T>[];
  title?: string;
}

export function DataGridExportModal<T extends Record<string, any>>({
  open,
  onOpenChange,
  data,
  selectedRows,
  allDataset,
  columns,
  title = "Export",
}: DataGridExportModalProps<T>) {
  const L = useL();
  const [format, setFormat] = useState<"csv" | "excel" | "pdf" | "print">("csv");
  const [scope, setScope] = useState<"filtered" | "selected" | "all">("filtered");
  const [visibleOnly, setVisibleOnly] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const hasSelected = selectedRows && selectedRows.length > 0;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let targetData: T[] = data;
      if (scope === "selected" && hasSelected) {
        targetData = selectedRows;
      } else if (scope === "all" && allDataset && allDataset.length > 0) {
        targetData = allDataset;
      }

      const targetCols = visibleOnly
        ? columns.filter((c) => !c.hidden && c.id !== "__selection__" && c.id !== "__actions__")
        : columns.filter((c) => c.id !== "__selection__" && c.id !== "__actions__");

      const ts = new Date().toISOString().slice(0, 10);
      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `${safeTitle}-${ts}`;

      if (format === "csv") exportToCsv(targetData, targetCols, `${filename}.csv`);
      else if (format === "excel") exportToExcel(targetData, targetCols, `${filename}.xlsx`);
      else if (format === "pdf") await exportToPdf(targetData, targetCols, title, `${filename}.pdf`);
      else if (format === "print") printDataGrid(targetData, targetCols, title);

      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Download className="h-4 w-4 text-primary" />
            {L("ডেটা নামান", "Export Data")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Format</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["csv", "excel", "pdf", "print"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`p-2 rounded-lg border text-xs font-medium text-left capitalize transition-all ${
                    format === fmt ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-muted/50"
                  }`}
                >
                  {fmt === "excel" ? "Excel (.xlsx)" : fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Scope</Label>
            <div className="space-y-1 mt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="scope" checked={scope === "filtered"} onChange={() => setScope("filtered")} className="accent-primary" />
                Filtered records ({data.length})
              </label>
              {hasSelected && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" checked={scope === "selected"} onChange={() => setScope("selected")} className="accent-primary" />
                  Selected records ({selectedRows.length})
                </label>
              )}
              {allDataset && allDataset.length > data.length && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} className="accent-primary" />
                  All records ({allDataset.length})
                </label>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs">
            <input type="checkbox" id="vo" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} className="accent-primary" />
            <label htmlFor="vo" className="cursor-pointer">Visible columns only</label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{L("বাতিল", "Cancel")}</Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting}>{isExporting ? L("নামানো হচ্ছে…", "Exporting…") : L("নামান", "Download")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
