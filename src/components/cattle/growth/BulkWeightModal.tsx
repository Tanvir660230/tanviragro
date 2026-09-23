"use client";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Layers } from "lucide-react";
import { bulkRecordGrowthWeightAction } from "@/app/dashboard/(app)/cattle/growth-actions";
import { type AnimalGrowthProfile } from "@/lib/growth/types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattleList: AnimalGrowthProfile[];
  onSuccess?: () => void;
}

export function BulkWeightModal({ open, onOpenChange, cattleList, onSuccess }: Props) {
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split("T")[0]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [bcsMap, setBcsMap] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWeightChange = (cattleId: string, val: string) => {
    const num = parseFloat(val);
    setWeights((prev) => ({
      ...prev,
      [cattleId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entries = Object.entries(weights)
      .filter(([_, weight]) => weight > 0)
      .map(([cattleId, weightKg]) => ({
        cattleId,
        recordedAt,
        weightKg,
        weighingMethod: "scale" as const,
        bcs: bcsMap[cattleId] || 5.0,
      }));

    if (entries.length === 0) {
      toast.error("Please enter at least one animal weight");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await bulkRecordGrowthWeightAction(entries);
      if (res.success) {
        toast.success(`Successfully saved ${res.totalRecordsProcessed || entries.length} weigh-in records!`);
        onOpenChange(false);
        onSuccess?.();
      } else toast.error(res.error || "Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-primary" /> Batch Weigh-In Session
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Weigh-In Date:</span>
            <Input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} className="h-8 text-xs w-44" required />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tag / Name</TableHead>
                  <TableHead className="text-xs text-right">Last Wt</TableHead>
                  <TableHead className="text-xs text-right">New Wt (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cattleList.filter(c => c.status === "active").map((c) => (
                  <TableRow key={c.cattleId}>
                    <TableCell className="text-xs font-medium">#{c.tagId} {c.name ? `(${c.name})` : ""}</TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">{c.currentWeightKg} kg</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 450"
                        className="h-7 w-24 text-xs font-bold ml-auto text-right"
                        value={weights[c.cattleId] || ""}
                        onChange={(e) => handleWeightChange(c.cattleId, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Batch"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
