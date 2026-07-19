"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { submitBulkCosts, type BulkCostItem } from "@/app/dashboard/(app)/finance/actions";

const FIXED_CATEGORIES = ["Rent", "Salary", "Utilities", "Insurance", "Other"];
const VARIABLE_CATEGORIES = ["Feed", "Medicine", "Labour", "Transport", "Veterinary", "Other"];
const ASSET_CATEGORIES = ["Infrastructure", "Equipment", "Vehicle", "Land", "Other"];

type CostRow = BulkCostItem & { id: string };

export function BulkCostClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  const [rows, setRows] = useState<CostRow[]>([
    { id: crypto.randomUUID(), mode: "expense-fixed", category: "", amount: 0, recordedAt: today, description: "" }
  ]);

  const addRow = () => {
    setRows(prev => [...prev, { id: crypto.randomUUID(), mode: "expense-fixed", category: "", amount: 0, recordedAt: today, description: "" }]);
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof CostRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleModeChange = (id: string, mode: CostRow["mode"]) => {
    const defaultCategory = 
      mode === "expense-fixed" ? FIXED_CATEGORIES[0] :
      mode === "expense-variable" ? VARIABLE_CATEGORIES[0] :
      mode === "asset" ? ASSET_CATEGORIES[0] : "";
    setRows(prev => prev.map(r => r.id === id ? { ...r, mode, category: defaultCategory.toLowerCase() } : r));
  };

  const totalAmount = rows.reduce((sum, row) => sum + (parseFloat(String(row.amount)) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (rows.length === 0) {
      toast.error("Please add at least one entry.");
      return;
    }

    const payload = rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount as any) || 0
    }));

    for (const row of payload) {
      if (!row.category) {
        toast.error("Please select a category for all entries.");
        return;
      }
      if (row.amount <= 0) {
        toast.error("Amount must be greater than 0 for all entries.");
        return;
      }
    }

    startTransition(async () => {
      const result = await submitBulkCosts(payload);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Bulk costs saved successfully!");
        router.push("/dashboard/finance");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      {/* LEFT COLUMN: The Items List (Takes up 3/4 on large screens) */}
      <div className="lg:col-span-3 space-y-6">
        <form id="bulk-cost-form" onSubmit={handleSubmit}>
          <div className="glass-panel border-primary/10 shadow-md">
            <div className="border-b border-border bg-muted/30 px-5 py-4 rounded-t-2xl">
              <h2 className="text-sm font-semibold text-foreground">Expense Entries</h2>
            </div>
            <div className="divide-y divide-border bg-background">
              {rows.map((row, idx) => {
                const categories = 
                  row.mode === "expense-fixed" ? FIXED_CATEGORIES :
                  row.mode === "expense-variable" ? VARIABLE_CATEGORIES :
                  row.mode === "asset" ? ASSET_CATEGORIES : [];

                return (
                  <div key={row.id} className="p-5 grid grid-cols-1 md:grid-cols-[2fr_1fr_1.5fr_1fr_40px] gap-4 items-start relative hover:bg-muted/10 transition-colors group">
                    <div className="absolute top-2 left-2 text-xs font-bold text-muted-foreground/30 select-none">
                      #{idx + 1}
                    </div>

                    {/* Entry Type & Details */}
                    <div className="space-y-3 mt-2 md:mt-0">
                      <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
                        {([
                          { value: "expense-fixed", label: "Fixed Cost" },
                          { value: "expense-variable", label: "Variable Cost" },
                          { value: "asset", label: "Asset" },
                        ] as const).map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleModeChange(row.id, value)}
                            className={`rounded-md py-1.5 text-xs font-medium transition-all ${
                              row.mode === value
                                ? value === "asset"
                                  ? "bg-amber-500 text-white shadow-card"
                                  : "bg-primary text-primary-foreground shadow-card"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                        <Input
                          placeholder="Optional details..."
                          value={row.description}
                          onChange={(e) => updateRow(row.id, "description", e.target.value)}
                          className="h-8 text-sm bg-background"
                        />
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1 mt-2 md:mt-0">
                      <Label className="text-xs uppercase text-muted-foreground">Category *</Label>
                      <Select value={row.category} onValueChange={(v) => updateRow(row.id, "category", v)}>
                        <SelectTrigger className="h-9 mt-1 bg-background">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1 mt-2 md:mt-0">
                      <Label className="text-xs uppercase text-muted-foreground">Amount (?) *</Label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-muted-foreground sm:text-sm">?</span>
                        </div>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={row.amount || ""}
                          onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                          className="h-9 pl-7 font-medium bg-background"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-1 mt-2 md:mt-0">
                      <Label className="text-xs uppercase text-muted-foreground">Date *</Label>
                      <Input
                        type="date"
                        required
                        value={row.recordedAt}
                        max={today}
                        onChange={(e) => updateRow(row.id, "recordedAt", e.target.value)}
                        className="h-9 mt-1 bg-background"
                      />
                    </div>

                    {/* Delete Button */}
                    <div className="flex items-center justify-end mt-2 md:mt-6">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-4 bg-muted/20 border-t border-border flex justify-center rounded-b-2xl">
              <Button type="button" variant="outline" onClick={addRow} className="border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:text-primary rounded-full px-6 transition-all shadow-card">
                <Plus className="mr-2 h-4 w-4" /> Add Another Expense
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: The Summary Panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <div className="glass-panel overflow-hidden border-primary/10 shadow-lg">
            <div className="bg-primary px-5 py-4 text-primary-foreground">
              <h2 className="font-semibold flex items-center gap-2">
                <ReceiptText className="h-4 w-4" /> Summary
              </h2>
            </div>
            <div className="p-5 space-y-6 bg-card">
              <div className="flex justify-between items-end border-b border-border pb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Entries</p>
                  <p className="text-3xl font-bold">{rows.length}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-3xl font-bold tracking-tight text-primary">?{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <Button
                form="bulk-cost-form"
                type="submit"
                disabled={isPending || rows.length === 0}
                className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Entries...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" /> Save {rows.length} Entries
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
