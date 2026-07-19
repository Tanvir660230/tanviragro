"use client";

import { useState, useTransition } from "react";
import { Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { bulkCreateWeightLogs } from "@/app/dashboard/(app)/cattle/actions";

export function QuickWeightDialog({ cattleId, tagId }: { cattleId: string; tagId: string }) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) {
      toast.error("Enter a valid weight");
      return;
    }
    startTransition(async () => {
      const result = await bulkCreateWeightLogs([{
        cattle_id: cattleId,
        weight_kg: w,
        recorded_at: date,
      }]);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`#${tagId}: ${w} kg logged`);
        setOpen(false);
        setWeight("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
      >
        <Scale className="h-3.5 w-3.5" />
        Log Weight
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Log Weight — #{tagId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Weight (kg)</label>
            <Input
              type="number"
              min="1"
              step="0.1"
              placeholder="e.g. 285.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
              className="mt-1 text-lg font-bold h-12"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isPending || !weight || parseFloat(weight) <= 0}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Weight
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
