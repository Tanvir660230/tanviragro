"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, Loader2, Pencil, Sparkles } from "lucide-react";
import { updateCattle, type EditCattleFormState } from "@/app/dashboard/(app)/cattle/actions";
import { toast } from "sonner";

const COMMON_BREEDS = [
  "Brahman", "Crossbred", "Frieswal", "Hariana", "Indigenous (Deshi)",
  "Nellore", "Ongole", "Sahiwal", "Sindhi", "Sirohi", "Tharparkar",
];

function calcAge(dob: string): string {
  const ms = Date.now() - new Date(dob + "T00:00:00").getTime();
  if (ms < 0) return "Future date";
  const months = Math.floor(ms / (86400000 * 30.44));
  if (months < 24) return `${months} month${months !== 1 ? "s" : ""} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m old` : `${years} years old`;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

interface CattleInfo {
  id: string;
  tag_id: string;
  gender: "male" | "female";
  breed: string | null;
  dob: string | null;
  purchase_date: string;
  purchase_price: number;
  initial_weight_kg: number;
  target_weight_kg: number | null;
  expected_daily_gain_kg: number | null;
  notes: string | null;
  existingTagIds: string[];
  existingBreeds: string[];
}

function EditForm({
  cattle,
  formKey,
  onSuccess,
}: {
  cattle: CattleInfo;
  formKey: number;
  onSuccess: () => void;
}) {
  const router = useRouter();

  const [tagId, setTagId] = useState(cattle.tag_id);
  const [gender, setGender] = useState<"male" | "female">(cattle.gender);
  const [breed, setBreed] = useState(cattle.breed ?? "");
  const [dob, setDob] = useState(cattle.dob ?? "");
  const [purchaseDate, setPurchaseDate] = useState(cattle.purchase_date);
  const [price, setPrice] = useState(String(cattle.purchase_price));
  const [weight, setWeight] = useState(String(cattle.initial_weight_kg));
  const [targetWeight, setTargetWeight] = useState(cattle.target_weight_kg ? String(cattle.target_weight_kg) : "");
  const [adg, setAdg] = useState(cattle.expected_daily_gain_kg ? String(cattle.expected_daily_gain_kg) : "0.8");
  const [notes, setNotes] = useState(cattle.notes ?? "");

  const [state, formAction, isPending] = useActionState<EditCattleFormState, FormData>(
    updateCattle,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Cattle updated");
      onSuccess();
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state?.success, state?.error, onSuccess, router]);

  const isDuplicateTag =
    tagId.trim() !== cattle.tag_id &&
    cattle.existingTagIds.some((t) => t.toLowerCase() === tagId.toLowerCase().trim());

  const ageText = dob ? calcAge(dob) : "";

  const allBreeds = useMemo(() => {
    const set = new Set([...cattle.existingBreeds, ...COMMON_BREEDS]);
    return [...set].sort();
  }, [cattle.existingBreeds]);

  return (
    <form key={formKey} action={formAction} className="space-y-4 pt-1">
      <input type="hidden" name="cattle_id" value={cattle.id} />
      <input type="hidden" name="tag_id" value={tagId} />
      <input type="hidden" name="gender" value={gender} />
      <input type="hidden" name="breed" value={breed} />
      <input type="hidden" name="dob" value={dob} />
      <input type="hidden" name="purchase_date" value={purchaseDate} />
      <input type="hidden" name="purchase_price" value={price} />
      <input type="hidden" name="initial_weight_kg" value={weight} />
      <input type="hidden" name="target_weight_kg" value={targetWeight} />
      <input type="hidden" name="expected_daily_gain_kg" value={adg} />
      <input type="hidden" name="notes" value={notes} />

      <SectionDivider label="Identity" />

      {/* Tag ID */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-tag-id">Tag ID *</Label>
          {tagId !== cattle.tag_id && (
            <button
              type="button"
              onClick={() => setTagId(cattle.tag_id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
        <Input
          id="edit-tag-id"
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          placeholder="e.g. C001"
          className={isDuplicateTag ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {isDuplicateTag && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Tag ID already used by another cattle
          </p>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <Label>Gender *</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "male" as const,
                label: "Male",
                symbol: "♂",
                active: "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
              },
              {
                value: "female" as const,
                label: "Female",
                symbol: "♀",
                active: "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGender(opt.value)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-medium transition-all
                ${
                  gender === opt.value
                    ? opt.active
                    : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
            >
              <span className="text-xl leading-none">{opt.symbol}</span>
              <span className="text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Breed */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-breed">Breed</Label>
        <Input
          id="edit-breed"
          list="edit-cattle-breeds-list"
          placeholder="e.g. Brahman"
          autoComplete="off"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
        />
        <datalist id="edit-cattle-breeds-list">
          {allBreeds.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      <SectionDivider label="Purchase" />

      {/* Purchase Date */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-purchase-date">Purchase Date *</Label>
        <Input
          id="edit-purchase-date"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
      </div>

      {/* Price + Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-price">Purchase Price (৳) *</Label>
          <Input
            id="edit-price"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 80000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-weight">Initial Weight (kg) *</Label>
          <Input
            id="edit-weight"
            type="number"
            min="1"
            step="0.1"
            placeholder="e.g. 180"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      <SectionDivider label="Growth Targets" />

      {/* Target Weight + ADG */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-target-weight">Target Weight (kg)</Label>
          <Input
            id="edit-target-weight"
            type="number"
            min="1"
            step="0.1"
            placeholder="e.g. 400"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-adg">Expected ADG (kg/day)</Label>
          <Input
            id="edit-adg"
            type="number"
            min="0.1"
            step="0.01"
            placeholder="e.g. 0.8"
            value={adg}
            onChange={(e) => setAdg(e.target.value)}
          />
        </div>
      </div>

      <SectionDivider label="Optional" />

      {/* DOB + Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-dob">Date of Birth</Label>
          <Input
            id="edit-dob"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          {ageText && (
            <p className="text-xs text-muted-foreground">{ageText}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Notes</Label>
          <Textarea
            id="edit-notes"
            placeholder="Optional…"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none"
          />
        </div>
      </div>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <DialogFooter>
        <Button
          type="submit"
          disabled={isPending || isDuplicateTag || !tagId.trim() || !gender}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditCattleDialog({ cattle }: { cattle: CattleInfo }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
        aria-label="Edit cattle"
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Cattle #{cattle.tag_id}</DialogTitle>
        </DialogHeader>
        <EditForm
          cattle={cattle}
          formKey={formKey}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
