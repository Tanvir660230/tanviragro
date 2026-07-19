"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { addFixedAsset, type FixedAssetFormState } from "@/app/dashboard/(app)/accounting/fixed-assets/actions";
import { toast } from "sonner";

export function AddFixedAssetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [method, setMethod] = useState("straight_line");
  const [state, formAction, isPending] = useActionState<FixedAssetFormState, FormData>(
    addFixedAsset,
    undefined
  );

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Asset added");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.refresh();
    }
    if (state && "error" in state && state.error) toast.error(state.error);
  }, [state, router]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) { setFormKey((k) => k + 1); setMethod("straight_line"); }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ size: "sm" })}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add Fixed Asset
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Fixed Asset</DialogTitle>
        </DialogHeader>

        <form key={formKey} action={formAction} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="fa_name">Asset Name *</Label>
            <Input id="fa_name" name="name" placeholder="e.g. Cattle Shed, Water Pump" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_cat">Category *</Label>
              <Select name="category" defaultValue="infrastructure">
                <SelectTrigger id="fa_cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_date">Purchase Date *</Label>
              <Input id="fa_date" name="purchase_date" type="date" max={today} defaultValue={today} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_cost">Purchase Cost (৳) *</Label>
              <Input id="fa_cost" name="purchase_cost" type="number" min="1" step="0.01" placeholder="e.g. 150000" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_salvage">Salvage Value (৳)</Label>
              <Input id="fa_salvage" name="salvage_value" type="number" min="0" step="0.01" placeholder="e.g. 10000" defaultValue="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_life">Useful Life (years) *</Label>
              <Input id="fa_life" name="useful_life_years" type="number" min="0.5" step="0.5" placeholder="e.g. 10" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_method">Depreciation Method</Label>
              <Select name="depreciation_method" value={method} onValueChange={(val) => val && setMethod(val)}>
                <SelectTrigger id="fa_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Straight-Line</SelectItem>
                  <SelectItem value="declining_balance">Declining Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {method === "declining_balance" && (
            <div className="space-y-1.5">
              <Label htmlFor="fa_rate">Annual Rate (%)</Label>
              <Input
                id="fa_rate"
                name="declining_rate"
                type="number"
                min="1"
                max="100"
                step="1"
                placeholder="e.g. 20 for 20%"
              />
              <p className="text-xs text-muted-foreground">Leave blank to use 1 ÷ useful life</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fa_desc">Description</Label>
            <Input id="fa_desc" name="description" placeholder="Location, model, serial no. (optional)" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fa_notes">Notes</Label>
            <Textarea id="fa_notes" name="notes" rows={2} maxLength={500} placeholder="Any additional notes (optional)" />
          </div>

          {state && "error" in state && state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
