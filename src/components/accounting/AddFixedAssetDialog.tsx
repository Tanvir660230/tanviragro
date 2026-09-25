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

import { useL } from "@/i18n/text";
export function AddFixedAssetDialog() {
  const L = useL();
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
      toast.success(L("সম্পদ যোগ হলো", "Asset added"));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.refresh();
    }
    if (state && "error" in state && state.error) toast.error(state.error);
  }, [state, router, L]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) { setFormKey((k) => k + 1); setMethod("straight_line"); }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ size: "sm" })}>
        <Plus className="mr-1.5 h-4 w-4" />
        {L("স্থায়ী সম্পদ যোগ", "Add Fixed Asset")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{L("স্থায়ী সম্পদ যোগ", "Add Fixed Asset")}</DialogTitle>
        </DialogHeader>

        <form key={formKey} action={formAction} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="fa_name">{L("সম্পদের নাম *", "Asset Name *")}</Label>
            <Input id="fa_name" name="name" placeholder={L("যেমন গরুর শেড, পানির পাম্প", "e.g. Cattle Shed, Water Pump")} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_cat">{L("ধরন *", "Category *")}</Label>
              <Select name="category" defaultValue="infrastructure">
                <SelectTrigger id="fa_cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infrastructure">{L("অবকাঠামো", "Infrastructure")}</SelectItem>
                  <SelectItem value="equipment">{L("যন্ত্রপাতি", "Equipment")}</SelectItem>
                  <SelectItem value="vehicle">{L("গাড়ি", "Vehicle")}</SelectItem>
                  <SelectItem value="other">{L("অন্যান্য", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_date">{L("কেনার তারিখ *", "Purchase Date *")}</Label>
              <Input id="fa_date" name="purchase_date" type="date" max={today} defaultValue={today} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_cost">{L("কেনা দাম (৳) *", "Purchase Cost (৳) *")}</Label>
              <Input id="fa_cost" name="purchase_cost" type="number" min="1" step="0.01" placeholder={L("যেমন ১৫০০০০", "e.g. 150000")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_salvage">{L("শেষে বিক্রি মূল্য (৳)", "Salvage Value (৳)")}</Label>
              <Input id="fa_salvage" name="salvage_value" type="number" min="0" step="0.01" placeholder={L("যেমন ১০০০০", "e.g. 10000")} defaultValue="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa_life">{L("কত বছর চলবে *", "Useful Life (years) *")}</Label>
              <Input id="fa_life" name="useful_life_years" type="number" min="0.5" step="0.5" placeholder={L("যেমন ১০", "e.g. 10")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa_method">{L("অবচয় পদ্ধতি", "Depreciation Method")}</Label>
              <Select name="depreciation_method" value={method} onValueChange={(val) => val && setMethod(val)}>
                <SelectTrigger id="fa_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">{L("সমান হারে", "Straight-Line")}</SelectItem>
                  <SelectItem value="declining_balance">{L("কমতি হারে", "Declining Balance")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {method === "declining_balance" && (
            <div className="space-y-1.5">
              <Label htmlFor="fa_rate">{L("বছরে হার (%)", "Annual Rate (%)")}</Label>
              <Input
                id="fa_rate"
                name="declining_rate"
                type="number"
                min="1"
                max="100"
                step="1"
                placeholder={L("যেমন ২০% হলে ২০", "e.g. 20 for 20%")}
              />
              <p className="text-xs text-muted-foreground">{L("খালি রাখলে ১ ÷ চলার বছর ধরা হবে", "Leave blank to use 1 ÷ useful life")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fa_desc">{L("বিবরণ", "Description")}</Label>
            <Input id="fa_desc" name="description" placeholder={L("জায়গা, মডেল, সিরিয়াল (ঐচ্ছিক)", "Location, model, serial no. (optional)")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fa_notes">{L("নোট", "Notes")}</Label>
            <Textarea id="fa_notes" name="notes" rows={2} maxLength={500} placeholder={L("অন্য কিছু (ঐচ্ছিক)", "Any additional notes (optional)")} />
          </div>

          {state && "error" in state && state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {L("সেভ হচ্ছে…", "Saving…")}</> : L("সেভ করুন", "Save asset")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
