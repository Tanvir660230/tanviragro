"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayDhaka } from "@/lib/dates";
import { adjustStock } from "@/app/dashboard/(app)/inventory/actions";
import { useL } from "@/i18n/text";

type Props = {
  itemId: string;
  itemName: string;
  currentStock: number;
  unit: string;
};

const REASONS = [
  { value: "physical_count", bn: "গুনে দেখা", en: "Physical count" },
  { value: "spoilage", bn: "পচে গেছে", en: "Spoilage" },
  { value: "damage", bn: "নষ্ট / ক্ষতি", en: "Damage" },
  { value: "shrinkage", bn: "শুকিয়ে কমেছে", en: "Shrinkage" },
  { value: "waste", bn: "অপচয়", en: "Operational waste" },
  { value: "correction", bn: "ভুল সংশোধন", en: "Correction" },
] as const;

/**
 * A physical count of an item that is NOT in a feeding period (a feed in use is counted on its
 * card, so the daily deduction is corrected too). Opened by its own button, or controlled
 * (open / onOpenChange) from a menu — then no button.
 */
export function StockAdjustmentDialog({ itemId, itemName, currentStock, unit, open: openProp, onOpenChange }: Props & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const L = useL();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [formKey, setFormKey] = useState(0);
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange?.(v); else setOpenState(v);
    if (v) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-foreground")}
          title={L("গুনে মেলান", "Count and adjust")}
        >
          <ClipboardList className="h-3.5 w-3.5" />
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{L("গুনে মেলান", "Count check")} · {itemName}</DialogTitle>
        </DialogHeader>
        <AdjustmentForm key={formKey} itemId={itemId} itemName={itemName} currentStock={currentStock} unit={unit} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentForm({ itemId, currentStock, unit, onSuccess }: Props & { onSuccess: () => void }) {
  const L = useL();
  const router = useRouter();
  const today = todayDhaka();
  const [reason, setReason] = useState("physical_count");
  const [date, setDate] = useState(today);
  const [newQty, setNewQty] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);

  const counted = parseFloat(newQty);
  const delta = counted - currentStock;
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("adjusted_qty", newQty);
      fd.set("reason", reason);
      fd.set("recorded_at", date);
      fd.set("notes", notes);
      const result = await adjustStock(undefined, fd);
      if (result?.error) toast.error(result.error);
      else { toast.success(L("স্টক মিলানো হলো", "Stock count saved")); onSuccess(); router.refresh(); }
    } catch {
      toast.error(L("সেভ হয়নি, আবার চেষ্টা করুন", "Could not save. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
        <span className="text-muted-foreground">{L("খাতায় আছে", "In the books")}:</span>{" "}
        <span className="font-semibold tabular-nums">{fmt(currentStock)} {unit}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adj_qty">{L(`গুনে পেলেন (${unit}) *`, `Counted (${unit}) *`)}</Label>
          <Input id="adj_qty" type="number" inputMode="decimal" min="0" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)} required placeholder={fmt(Math.max(0, currentStock))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adj_date">{L("তারিখ *", "Date *")}</Label>
          <Input id="adj_date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      {newQty !== "" && Number.isFinite(counted) && (
        <p className={cn("text-xs font-medium", Math.abs(delta) < 0.01 ? "text-muted-foreground" : delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {Math.abs(delta) < 0.01
            ? L("খাতার সাথে মিলে গেছে — কিছু বদলাবে না", "Matches the books — nothing to change")
            : delta > 0
              ? L(`${fmt(delta)} ${unit} বেশি পাওয়া গেছে (স্টকে যোগ হবে)`, `${fmt(delta)} ${unit} more than the books (added to stock)`)
              : L(`${fmt(-delta)} ${unit} কম (ক্ষতি হিসেবে বাদ যাবে)`, `${fmt(-delta)} ${unit} short (written off as a loss)`)}
        </p>
      )}

      <div className="space-y-1.5">
        <Label>{L("কারণ *", "Reason *")}</Label>
        <Select value={reason} onValueChange={(v) => { if (v != null) setReason(v); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (<SelectItem key={r.value} value={r.value}>{L(r.bn, r.en)}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adj_notes">{L("নোট", "Notes")}</Label>
        <Textarea id="adj_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L("ঐচ্ছিক", "Optional")} rows={2} maxLength={500} />
      </div>

      <DialogFooter className="pt-2">
        <Button type="submit" disabled={isPending || newQty === "" || !Number.isFinite(counted) || Math.abs(delta) < 0.01} className="w-full">
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L("সেভ হচ্ছে…", "Saving…")}</> : L("মিলিয়ে সেভ করুন", "Save the count")}
        </Button>
      </DialogFooter>
    </form>
  );
}
