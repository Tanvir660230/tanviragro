"use client";

import { useActionState, useEffect, useState } from "react";
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
import { toast } from "sonner";
import { createCostEntry, type CostFormState } from "@/app/dashboard/(app)/finance/actions";
import { useL } from "@/i18n/text";
import { costCategoryLabel } from "@/lib/expenses/labels";
import { useTranslation } from "@/i18n/I18nProvider";
import { todayDhaka } from "@/lib/dates";

// ── Category lists ─────────────────────────────────────────────────

const FIXED_CATEGORIES    = ["Rent", "Salary", "Utilities", "Insurance", "Other"];
const VARIABLE_CATEGORIES = ["Feed", "Medicine", "Labour", "Transport", "Veterinary", "Other"];
const ASSET_CATEGORIES    = ["Infrastructure", "Equipment", "Vehicle", "Land", "Other"];

// ── CostForm ───────────────────────────────────────────────────────

type EntryMode = "expense-fixed" | "expense-variable" | "asset";

/** Partners who can have paid an expense from their own pocket (needs migration 20260927100000). */
export type PayerOption = { id: string; name: string };

export function CostForm({ formKey, onSuccess, payers = [] }: { formKey: number; onSuccess: () => void; payers?: PayerOption[] }) {
  const L = useL();
  const { locale } = useTranslation();
  const router   = useRouter();
  const today    = todayDhaka();
  const [mode, setMode]         = useState<EntryMode | "">("");
  const [category, setCategory] = useState("");
  const [paidBy, setPaidBy]     = useState("");            // "" = the farm's cash
  const [paidAs, setPaidAs]     = useState<"capital" | "loan">("capital");

  const [state, formAction, isPending] = useActionState<CostFormState, FormData>(
    createCostEntry,
    undefined
  );

  const handleModeChange = (v: EntryMode) => { setMode(v); setCategory(""); };

  const categories =
    mode === "expense-fixed"    ? FIXED_CATEGORIES    :
    mode === "expense-variable" ? VARIABLE_CATEGORIES :
    mode === "asset"            ? ASSET_CATEGORIES    : [];

  // Derive server-side fields from mode
  const costType   = mode === "asset" ? "fixed" : mode === "expense-fixed" ? "fixed" : "variable";
  const entryClass = mode === "asset" ? "asset" : "expense";

  useEffect(() => {
    if (state?.success) {
      toast.success(entryClass === "asset" ? L("সম্পদ যোগ হলো", "Asset recorded") : L("খরচ সেভ হলো", "Cost entry saved"));
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router, entryClass, L]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="type"        value={costType} />
      <input type="hidden" name="entry_class" value={entryClass} />
      <input type="hidden" name="category"    value={category} />
      <input type="hidden" name="paid_by_partner_id" value={paidBy} />
      <input type="hidden" name="paid_as" value={paidAs} />

      {/* Entry Mode */}
      <div className="space-y-1.5">
        <Label>{L("ধরন *", "Entry Type *")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "expense-fixed",    label: L("নির্দিষ্ট খরচ", "Fixed cost"),    sub: L("বেতন, ভাড়া…", "Salary, rent…") },
            { value: "expense-variable", label: L("পরিবর্তনশীল খরচ", "Variable cost"), sub: L("খাবার, ওষুধ…", "Feed, medicine…") },
            { value: "asset",            label: L("সম্পদ", "Asset"),         sub: L("যন্ত্রপাতি, শেড…", "Equipment, shed…") },
          ] as const).map(({ value, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleModeChange(value)}
              className={`rounded-xl border px-2 py-2.5 text-left text-xs font-medium transition-all ${
                mode === value
                  ? value === "asset"
                    ? "border-amber-500 bg-amber-500 text-white shadow-card"
                    : "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-input bg-transparent text-muted-foreground hover:border-ring hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className="block opacity-70 text-xs mt-0.5">{sub}</span>
            </button>
          ))}
        </div>
        {mode === "asset" && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
            {L("সম্পদ লাভ-ক্ষতি থেকে বাদ যায় না — এটি খামারের মূল্য বাড়ায় এবং স্থায়ী সম্পদের তালিকায় থাকে।", "Assets are not deducted from P&L — they add to the farm's value and appear in the asset register.")}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="cost_category">{L("ধরন *", "Category *")}</Label>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "")} disabled={!mode}>
          <SelectTrigger id="cost_category" className="w-full">
            <SelectValue placeholder={mode ? L("ধরন বাছুন…", "Select category…") : L("আগে প্রকার বাছুন", "Select type first")} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c.toLowerCase()}>{costCategoryLabel(c, locale)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cost_amount">{L("টাকা (৳) *", "Amount (৳) *")}</Label>
          <Input id="cost_amount" name="amount" type="number" min="0.01" step="0.01" placeholder="e.g. 50000" required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cost_date">{L("তারিখ *", "Date *")}</Label>
          <Input id="cost_date" name="recorded_at" type="date" max={today} defaultValue={today} required disabled={isPending} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="cost_desc">
          {mode === "asset" ? L("সম্পদের নাম / বিবরণ", "Asset name / details") : L("বিবরণ", "Description")}
        </Label>
        <Textarea
          id="cost_desc"
          name="description"
          placeholder={mode === "asset" ? L("যেমন স্টিলের গরুর শেড — ৪০×২০ ফুট", "e.g. Steel cattle shed — 40×20 ft") : L("বিস্তারিত (ঐচ্ছিক)…", "Optional details…")}
          rows={3}
          disabled={isPending}
        />
      </div>

      {/* Who paid: the farm's cash, or a partner from their own pocket */}
      {payers.length > 0 && (
        <div className="space-y-1.5">
          <Label>{L("টাকা কে দিলেন", "Paid by")}</Label>
          <Select value={paidBy || "farm"} onValueChange={(v) => setPaidBy(!v || v === "farm" ? "" : v)}>
            <SelectTrigger className="w-full">
              <span className="truncate">{paidBy ? payers.find((x) => x.id === paidBy)?.name : L("খামারের নগদ", "The farm's cash")}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="farm">{L("খামারের নগদ", "The farm's cash")}</SelectItem>
              {payers.map((x) => <SelectItem key={x.id} value={x.id}>{L(`${x.name} (নিজের টাকা)`, `${x.name} (own money)`)}</SelectItem>)}
            </SelectContent>
          </Select>
          {paidBy && (
            <div className="grid grid-cols-2 gap-2">
              {([["capital", L("মূলধন হিসেবে", "As capital"), L("লাভ-ক্ষতির ভাগ পাবেন", "shares profit and loss")],
                 ["loan", L("খামারের ধার", "As a loan"), L("পরে ফেরত দিতে হবে", "to be paid back")]] as const).map(([v, label, sub]) => (
                <button key={v} type="button" onClick={() => setPaidAs(v)}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs ${paidAs === v ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:text-foreground"}`}>
                  <span className="block font-semibold">{label}</span><span className="block opacity-70">{sub}</span>
                </button>
              ))}
            </div>
          )}
          {paidBy && <p className="text-[11px] text-muted-foreground">{L("খরচ খামারের হিসাবে লেখা হবে, আর একই টাকা ওই অংশীদারের নামে জমা হবে — নগদ বদলাবে না।", "The expense is booked for the farm and the same amount is credited to the partner — cash does not change.")}</p>}
        </div>
      )}

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L("সেভ হচ্ছে…", "Saving…")}</>
          ) : mode === "asset" ? L("সম্পদ যোগ করুন", "Record asset") : L("খরচ যোগ করুন", "Add entry")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── AddCostDialog ──────────────────────────────────────────────────

export function AddCostDialog({ payers = [] }: { payers?: PayerOption[] }) {
  const L = useL();
  const [open, setOpen]       = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ size: "sm" })} aria-label={L("খরচ যোগ", "Add cost entry")}>
        <Plus className="mr-1.5 h-4 w-4" />
        {L("খরচ যোগ", "Add Entry")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{L("নতুন খরচ / সম্পদ", "New Cost / Asset Entry")}</DialogTitle>
        </DialogHeader>
        <CostForm formKey={formKey} onSuccess={() => setOpen(false)} payers={payers} />
      </DialogContent>
    </Dialog>
  );
}
