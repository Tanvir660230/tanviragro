"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, Pencil } from "lucide-react";
import { deleteCostEntry, updateCostEntry } from "@/app/dashboard/(app)/finance/actions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { CostEntry } from "@/components/finance/CostList";
import { useL } from "@/i18n/text";
import { costCategoryLabel, costTypeLabel } from "@/lib/expenses/labels";
import { useTranslation } from "@/i18n/I18nProvider";
import { todayDhaka } from "@/lib/dates";

const FIXED_CATEGORIES    = ["Rent", "Salary", "Utilities", "Insurance", "Other"];
const VARIABLE_CATEGORIES = ["Feed", "Medicine", "Labour", "Transport", "Veterinary", "Other"];
const ASSET_CATEGORIES    = ["Infrastructure", "Equipment", "Vehicle", "Land", "Other"];

function getCategories(type: string, entryClass: string) {
  if (entryClass === "asset")      return ASSET_CATEGORIES;
  if (type === "fixed")            return FIXED_CATEGORIES;
  return VARIABLE_CATEGORIES;
}

// ── Edit Dialog ────────────────────────────────────────────────────

function EditDialog({ entry, onClose }: { entry: CostEntry; onClose: () => void }) {
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [entryClass, setEntryClass] = useState<"expense" | "asset">(
    (entry.entry_class ?? "expense") as "expense" | "asset"
  );
  const [costType, setCostType]   = useState<"fixed" | "variable">(entry.type);
  const [category, setCategory]  = useState(entry.category);
  const [amount, setAmount]      = useState(String(entry.amount));
  const [date, setDate]          = useState(entry.recorded_at.slice(0, 10));
  const [desc, setDesc]          = useState(entry.description ?? "");
  const [error, setError]        = useState<string | null>(null);
  const today = todayDhaka();

  const effectiveType     = entryClass === "asset" ? "fixed" : costType;
  const availableCategories = getCategories(effectiveType, entryClass);

  const handleEntryClassChange = (v: "expense" | "asset") => {
    setEntryClass(v);
    setCategory("");
  };

  const handleSave = () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { setError("Amount must be positive"); return; }
    if (!category)                   { setError("Category is required"); return; }
    if (!date)                       { setError("Date is required"); return; }

    startTransition(async () => {
      const result = await updateCostEntry(entry.id, {
        type: effectiveType,
        entry_class: entryClass,
        category,
        amount: amt,
        recorded_at: date,
        description: desc.trim() || null,
      });
      if (result.error) { setError(result.error); return; }
      toast.success(L("খরচ আপডেট হলো", "Entry updated"));
      router.refresh();
      onClose();
    });
  };

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{L("খরচ বদলান", "Edit Entry")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-1">
        {/* Entry class toggle */}
        <div className="space-y-1.5">
          <Label>{L("ধরন", "Entry Type")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "asset"] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => handleEntryClassChange(cls)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  entryClass === cls
                    ? cls === "asset"
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:border-ring hover:text-foreground"
                }`}
              >
                {cls === "asset" ? L("সম্পদ", "Asset") : L("খরচ", "Expense")}
              </button>
            ))}
          </div>
          {entryClass === "asset" && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-1.5">
              {L("লাভ-ক্ষতি থেকে সরে স্থায়ী সম্পদের তালিকায় যাবে।", "Will be removed from P&L and shown in asset register.")}
            </p>
          )}
        </div>

        {/* Cost type (only for expenses) */}
        {entryClass === "expense" && (
          <div className="space-y-1.5">
            <Label>{L("খরচের প্রকার", "Cost Type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["fixed", "variable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setCostType(t); setCategory(""); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    costType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:border-ring hover:text-foreground"
                  }`}
                >
                  {costTypeLabel(t, locale)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category */}
        <div className="space-y-1.5">
          <Label>{L("ধরন *", "Category *")}</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
            <SelectTrigger><SelectValue placeholder={L("ধরন বাছুন…", "Select category…")} /></SelectTrigger>
            <SelectContent>
              {availableCategories.map((c) => (
                <SelectItem key={c} value={c.toLowerCase()}>{costCategoryLabel(c, locale)}</SelectItem>
              ))}
              {!availableCategories.map(c => c.toLowerCase()).includes(category) && category && (
                <SelectItem value={category}>{costCategoryLabel(category, locale)}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{L("টাকা (৳) *", "Amount (৳) *")}</Label>
            <Input
              type="number" min="0.01" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{L("তারিখ *", "Date *")}</Label>
            <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>{L("বিবরণ", "Description")}</Label>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder={L("বিস্তারিত (ঐচ্ছিক)…", "Optional details…")}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            {L("বাতিল", "Cancel")}
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={isPending}>
            {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{L("সেভ হচ্ছে…", "Saving…")}</> : L("সেভ করুন", "Save")}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ── CostEntryActions (edit + delete buttons) ───────────────────────

export function CostEntryActions({ entry }: { entry: CostEntry }) {
  const L = useL();
  const router = useRouter();
  const [editOpen, setEditOpen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition]  = useTransition();

  const handleDelete = () => {
    setConfirmDelete(false);
    startTransition(async () => {
      const result = await deleteCostEntry(entry.id);
      if (result?.error) toast.error(result.error);
      else { toast.success(L("খরচ মুছে ট্র্যাশে রাখা হলো", "Entry deleted")); router.refresh(); }
    });
  };

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={() => setConfirmDelete(true)}
        >
          {isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editOpen && <EditDialog entry={entry} onClose={() => setEditOpen(false)} />}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={L("খরচ মুছবেন?", "Delete Entry")}
        description={L("খরচটি ট্র্যাশে যাবে — সেটিংস › ট্র্যাশ থেকে ফেরানো যায়।", "Delete this entry permanently? This cannot be undone.")}
        confirmLabel={L("মুছুন", "Delete")}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
