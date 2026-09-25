"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridColumn, FilterConfig, FilterOperator } from "./types";
import { useL } from "@/i18n/text";

export interface DataGridAdvancedFiltersProps<T> {
  columns: GridColumn<T>[];
  filters: FilterConfig[];
  addFilter: (filter: FilterConfig) => void;
  removeFilter: (columnId: string) => void;
  clearFilters: () => void;
}

const OPERATORS_BY_TYPE: Record<string, { label: string; bn: string; value: FilterOperator }[]> = {
  text: [
    { label: "Contains", bn: "আছে", value: "contains" },
    { label: "Equals", bn: "সমান", value: "equals" },
    { label: "Starts with", bn: "শুরু হয়", value: "starts_with" },
    { label: "Is Empty", bn: "খালি", value: "is_empty" },
    { label: "Is Not Empty", bn: "খালি নয়", value: "is_not_empty" },
  ],
  number: [
    { label: "Equals (=)", bn: "সমান (=)", value: "equals" },
    { label: "Greater (>) ", bn: "বেশি (>)", value: "gt" },
    { label: "Less (<)", bn: "কম (<)", value: "lt" },
  ],
  select: [
    { label: "Equals", bn: "সমান", value: "equals" },
    { label: "Not equals", bn: "সমান নয়", value: "not_equals" },
  ],
  boolean: [
    { label: "Is True", bn: "হ্যাঁ", value: "equals" },
    { label: "Is False", bn: "না", value: "not_equals" },
  ],
};

export function DataGridAdvancedFilters<T>({
  columns,
  filters,
  addFilter,
  removeFilter,
  clearFilters,
}: DataGridAdvancedFiltersProps<T>) {
  const L = useL();
  const filterableCols = columns.filter(
    (c) => c.filterable !== false && c.id !== "__selection__" && c.id !== "__actions__"
  );

  const [colId, setColId] = useState<string>(filterableCols[0]?.id || "");
  const selectedCol = columns.find((c) => c.id === colId);
  const filterType = selectedCol?.filterType || "text";
  const ops = OPERATORS_BY_TYPE[filterType] || OPERATORS_BY_TYPE.text;

  const [operator, setOperator] = useState<FilterOperator>(ops[0]?.value || "contains");
  const [val, setVal] = useState("");

  const handleApply = () => {
    if (!colId) return;
    addFilter({ columnId: colId, operator, value: val });
    setVal("");
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: filters.length > 0 ? "default" : "outline", size: "sm" }),
          "h-8 gap-1.5 text-xs cursor-pointer"
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        <span>{L("ফিল্টার", "Filters")}</span>
        {filters.length > 0 && (
          <span className="ml-1 bg-primary-foreground text-primary rounded-full px-1.5 text-[10px] font-bold">
            {filters.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-2.5 bg-card border-border shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
          {filters.length > 0 && (
            <Button variant="ghost" size="sm" className="h-5 px-1 text-[11px] text-destructive" onClick={clearFilters}>
              {L("মুছুন", "Clear")}
            </Button>
          )}
        </div>

        {filters.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filters.map((f) => {
              const col = columns.find((c) => c.id === f.columnId);
              const header = typeof col?.header === "string" ? col.header : f.columnId;
              return (
                <div key={f.columnId} className="flex items-center justify-between p-1 bg-muted/40 rounded text-xs">
                  <span className="truncate"><strong>{header}</strong> {f.operator} “{String(f.value)}”</span>
                  <button type="button" onClick={() => removeFilter(f.columnId)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pt-1 border-t border-border">
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={colId}
              onChange={(e) => {
                setColId(e.target.value);
                const c = columns.find((x) => x.id === e.target.value);
                setOperator(OPERATORS_BY_TYPE[c?.filterType || "text"]?.[0]?.value || "contains");
              }}
              className="h-7 text-xs rounded border border-input bg-background px-1"
            >
              {filterableCols.map((c) => (
                <option key={c.id} value={c.id}>{typeof c.header === "string" ? c.header : c.id}</option>
              ))}
            </select>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as FilterOperator)}
              className="h-7 text-xs rounded border border-input bg-background px-1"
            >
              {ops.map((o) => (
                <option key={o.value} value={o.value}>{L(o.bn, o.label)}</option>
              ))}
            </select>
          </div>

          {operator !== "is_empty" && operator !== "is_not_empty" && (
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={L("মান…", "Value...")}
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
            />
          )}

          <Button size="sm" onClick={handleApply} className="w-full h-7 text-xs font-semibold gap-1">
            <Plus className="h-3 w-3" /> Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
