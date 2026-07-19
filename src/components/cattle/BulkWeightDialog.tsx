"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { bulkCreateWeightLogs, type BulkWeightEntry } from "@/app/dashboard/(app)/cattle/actions";

interface CattleOption {
  id: string;
  tag_id: string;
}

interface Props {
  cattle: CattleOption[];
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default";
}

export function BulkWeightDialog({ cattle, defaultOpen = false, open: externalOpen, onOpenChange: externalOnChange, triggerLabel, triggerVariant = "outline" }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open    = externalOpen    ?? internalOpen;
  const setOpen = externalOnChange ?? setInternalOpen;
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDate(today);
      setWeights({});
    }
  };

  // Tab key moves focus to the next row's weight input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const next = inputRefs.current[idx + 1];
        if (next) {
          next.focus();
          next.select();
        }
      }
    },
    []
  );

  const filledCount = Object.values(weights).filter(
    (w) => w.trim() !== "" && !isNaN(parseFloat(w)) && parseFloat(w) > 0
  ).length;

  const handleSubmit = () => {
    const entries: BulkWeightEntry[] = cattle
      .filter((c) => {
        const w = parseFloat(weights[c.id] ?? "");
        return !isNaN(w) && w > 0;
      })
      .map((c) => ({
        cattle_id: c.id,
        weight_kg: parseFloat(weights[c.id]),
        recorded_at: date,
      }));

    if (!entries.length) {
      toast.error("Enter at least one weight to log");
      return;
    }

    startTransition(async () => {
      const result = await bulkCreateWeightLogs(entries);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.count} weight${result.count !== 1 ? "s" : ""} logged`);
        setOpen(false);
        router.refresh();
      }
    });
  };

  if (!cattle.length) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!externalOnChange && (
        <DialogTrigger className={buttonVariants({ variant: triggerVariant, size: "sm" })}>
          <ClipboardList className="mr-1.5 h-4 w-4" />
          {triggerLabel ?? "Bulk Weigh"}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Weight Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Date picker */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Date
            </label>
            <Input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            {filledCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {filledCount} / {cattle.length} filled
              </span>
            )}
          </div>

          {/* Spreadsheet grid */}
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr] gap-0 border-b border-border bg-muted/40 px-4 py-2">
              <span className="w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tag ID
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Weight (kg)
              </span>
            </div>

            {/* Rows */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {cattle.map((c, idx) => {
                const val = weights[c.id] ?? "";
                const isValid = val !== "" && !isNaN(parseFloat(val)) && parseFloat(val) > 0;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "grid grid-cols-[auto_1fr] items-center gap-0 px-4 py-2 transition-colors",
                      isValid ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "hover:bg-muted/20"
                    )}
                  >
                    <span className="w-24 font-mono text-sm font-semibold text-foreground">
                      #{c.tag_id}
                    </span>
                    <div className="relative">
                      <Input
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="number"
                        min="1"
                        step="0.1"
                        placeholder="— kg"
                        value={val}
                        onChange={(e) =>
                          setWeights((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={cn(
                          "h-8 border-transparent bg-transparent shadow-none focus:border-border focus:bg-background",
                          isValid && "text-emerald-700 dark:text-emerald-400 font-semibold"
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded border px-1 font-mono text-xs">Tab</kbd> or{" "}
            <kbd className="rounded border px-1 font-mono text-xs">Enter</kbd> to move between rows.
            Leave blank to skip.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || filledCount === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              `Save ${filledCount > 0 ? filledCount : ""} Weight${filledCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
