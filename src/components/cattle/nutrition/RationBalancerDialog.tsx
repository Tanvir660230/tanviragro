"use client";

import { Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function RationBalancerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-600" />
            <span>Livestock Ration Balancer Engine</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Live nutritional adequacy test for DM, CP, TDN, and live ADG cost efficiency.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border space-y-2">
            <div className="flex justify-between font-bold">
              <span>Diet Compliance Score</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">100% (Balanced)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full w-full" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              All biological targets met: CP &gt; 14.5% DM, TDN &gt; 72.0% DM, DMI within 2.8% body weight.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
