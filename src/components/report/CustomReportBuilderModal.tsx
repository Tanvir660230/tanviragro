"use client";

import React, { useState } from "react";
import { X, Play, Save, Download, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportDataset } from "@/lib/analytics/types";
import { CustomReportEngine, ExecutedReportResult } from "@/lib/analytics/custom-report-engine";

const DATASET_FIELDS: Record<ReportDataset, { key: string; label: string; type: "string" | "number" | "date" }[]> = {
  cattle: [
    { key: "tag_number", label: "Tag Number", type: "string" },
    { key: "breed", label: "Breed", type: "string" },
    { key: "gender", label: "Gender", type: "string" },
    { key: "status", label: "Status", type: "string" },
    { key: "purchase_price", label: "Purchase Price (BDT)", type: "number" },
    { key: "purchase_weight_kg", label: "Purchase Weight (kg)", type: "number" },
    { key: "current_weight_kg", label: "Current Weight (kg)", type: "number" },
  ],
  financial_transactions: [
    { key: "recorded_at", label: "Transaction Date", type: "date" },
    { key: "type", label: "Expense Type", type: "string" },
    { key: "amount", label: "Amount (BDT)", type: "number" },
    { key: "entry_class", label: "Class", type: "string" },
  ],
  inventory_items: [
    { key: "name", label: "Item Name", type: "string" },
    { key: "category", label: "Category", type: "string" },
    { key: "unit", label: "Unit", type: "string" },
    { key: "current_stock", label: "Current Stock", type: "number" },
    { key: "unit_cost", label: "Unit Cost (BDT)", type: "number" },
    { key: "reorder_threshold", label: "Reorder Threshold", type: "number" },
  ],
  health_events: [
    { key: "title", label: "Event Title", type: "string" },
    { key: "event_type", label: "Type", type: "string" },
    { key: "status", label: "Status", type: "string" },
    { key: "scheduled_at", label: "Scheduled At", type: "date" },
    { key: "withdrawal_days", label: "Withdrawal Days", type: "number" },
  ],
  weight_logs: [],
  feed_mixes: [],
  breeding_attempts: [],
  orders: [],
};

export function CustomReportBuilderModal({ onClose }: { onClose: () => void }) {
  const [dataset, setDataset] = useState<ReportDataset>("cattle");
  const [title, setTitle] = useState("Custom Farm Report");
  const [selectedFields, setSelectedFields] = useState<string[]>(["tag_number", "breed", "current_weight_kg"]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [result, setResult] = useState<ExecutedReportResult | null>(null);

  const availableFields = DATASET_FIELDS[dataset] || [];

  function toggleField(fieldKey: string) {
    if (selectedFields.includes(fieldKey)) {
      setSelectedFields(selectedFields.filter((f) => f !== fieldKey));
    } else {
      setSelectedFields([...selectedFields, fieldKey]);
    }
  }

  async function handleExecute() {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/analytics/custom-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          dataset,
          config: {
            fields: selectedFields,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.executed) {
        setResult(json.executed);
      }
    } catch (e) {
      console.error("Execute report failed", e);
    } finally {
      setIsExecuting(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/analytics/custom-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          report: {
            title,
            dataset,
            config: {
              fields: selectedFields,
            },
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save report failed", e);
    } finally {
      setIsSaving(false);
    }
  }

  function downloadCSV() {
    if (!result) return;
    const csv = CustomReportEngine.generateCSV(title, result.columns, result.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Custom Report &amp; BI Builder</h3>
              <p className="text-xs text-muted-foreground">Build, filter, aggregate, and export without code</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Report Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Primary Dataset</label>
              <select
                value={dataset}
                onChange={(e) => {
                  const ds = e.target.value as ReportDataset;
                  setDataset(ds);
                  setSelectedFields(DATASET_FIELDS[ds]?.slice(0, 3).map((f) => f.key) || []);
                }}
                className="w-full mt-1 px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg"
              >
                <option value="cattle">Livestock Herd (Cattle)</option>
                <option value="financial_transactions">Financial Ledger (Expenses &amp; P&amp;L)</option>
                <option value="inventory_items">Inventory &amp; Feed Stock</option>
                <option value="health_events">Veterinary &amp; Health Events</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleExecute} disabled={isExecuting} size="sm" className="w-full text-xs">
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {isExecuting ? "Executing..." : "Run Preview"}
              </Button>
              <Button onClick={handleSave} disabled={isSaving} variant="outline" size="sm" className="w-full text-xs">
                {saveSuccess ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {saveSuccess ? "Saved!" : "Save"}
              </Button>
            </div>
          </div>

          {/* Field Selector Chips */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Select Display Fields</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {availableFields.map((f) => {
                const isSelected = selectedFields.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleField(f.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 hover:bg-muted text-foreground border-border"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Table Preview */}
          {result && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Result Preview ({result.totalCount} Rows)
                </span>
                <Button variant="outline" size="sm" onClick={downloadCSV} className="text-xs h-7">
                  <Download className="h-3 w-3 mr-1" />
                  Download CSV
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-x-auto max-h-60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col.key} className="p-2 font-semibold">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.rows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        {result.columns.map((col) => (
                          <td key={col.key} className="p-2 text-foreground">
                            {String(row[col.key] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
