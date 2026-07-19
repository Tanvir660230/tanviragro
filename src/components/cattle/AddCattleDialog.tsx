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
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Ruler,
  Sparkles,
} from "lucide-react";
import { createCattle, type CattleFormState } from "@/app/dashboard/(app)/cattle/actions";
import { toast } from "sonner";

const COMMON_BREEDS = [
  "Brahman", "Crossbred", "Frieswal", "Hariana", "Indigenous (Deshi)",
  "Nellore", "Ongole", "Sahiwal", "Sindhi", "Sirohi", "Tharparkar",
];

function suggestNextTagId(existingTagIds: string[]): string {
  let bestNum = -1;
  let bestPrefix = "";
  let bestPadLen = 3;
  for (const tag of existingTagIds) {
    const m = tag.match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const n = parseInt(m[2], 10);
    if (n > bestNum) {
      bestNum = n;
      bestPrefix = m[1];
      bestPadLen = m[2].length;
    }
  }
  if (bestNum === -1) return existingTagIds.length === 0 ? "C001" : "";
  return bestPrefix + String(bestNum + 1).padStart(bestPadLen, "0");
}

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

interface SavedCattle {
  tag: string;
  gender: string;
  breed: string;
  price: string;
  weight: string;
}

interface FormProps {
  existingTagIds: string[];
  existingBreeds: string[];
  onAddAnother: (addedTag: string) => void;
  onDone: () => void;
}

export function CattleForm({ existingTagIds, existingBreeds, onAddAnother, onDone }: FormProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const suggested = suggestNextTagId(existingTagIds);

  // All controlled state — hidden inputs submit these values
  const [tagId, setTagId] = useState(suggested);
  const [gender, setGender] = useState("");
  const [breed, setBreed] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [dob, setDob] = useState("");
  const [notes, setNotes] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [haatHasil, setHaatHasil] = useState("");

  // Body measurement calculator
  const [showMeasure, setShowMeasure] = useState(false);
  const [girth, setGirth] = useState("");
  const [bodyLen, setBodyLen] = useState("");

  const [savedCattle, setSavedCattle] = useState<SavedCattle | null>(null);

  const [state, formAction, isPending] = useActionState<CattleFormState, FormData>(
    createCattle,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Cattle #${tagId} added`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedCattle({ tag: tagId, gender, breed, price, weight });
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, tagId, gender, breed, price, weight, router]);

  const isDuplicate =
    tagId.trim() !== "" &&
    existingTagIds.some((t) => t.toLowerCase() === tagId.toLowerCase().trim());

  const pricePerKg =
    Number(price) > 0 && Number(weight) > 0
      ? Number(price) / Number(weight)
      : null;

  const ageText = dob ? calcAge(dob) : "";

  const estimatedWeight = useMemo(() => {
    const g = Number(girth);
    const l = Number(bodyLen);
    if (g > 0 && l > 0) return Math.round((g * g * l) / 10840);
    return null;
  }, [girth, bodyLen]);

  const allBreeds = useMemo(() => {
    const set = new Set([...existingBreeds, ...COMMON_BREEDS]);
    return [...set].sort();
  }, [existingBreeds]);

  // ── Success state ────────────────────────────────────────────────────────
  if (savedCattle) {
    const savedPricePerKg =
      Number(savedCattle.price) > 0 && Number(savedCattle.weight) > 0
        ? Number(savedCattle.price) / Number(savedCattle.weight)
        : null;

    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 ring-4 ring-emerald-100 dark:ring-emerald-950/30">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-semibold">Cattle #{savedCattle.tag} added!</p>
            <p className="text-sm text-muted-foreground">Record saved successfully.</p>
          </div>
        </div>

        {/* Summary card */}
        <div className="rounded-xl bg-muted/50 p-4 border border-border/50 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              #{savedCattle.tag}
            </span>
            <span className="text-sm font-medium">
              {savedCattle.gender === "male" ? "♂ Male" : "♀ Female"}
            </span>
            {savedCattle.breed && (
              <span className="text-sm text-muted-foreground">{savedCattle.breed}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {savedCattle.price && (
              <span className="font-semibold">
                ৳{Number(savedCattle.price).toLocaleString("en-IN")}
              </span>
            )}
            {savedCattle.weight && (
              <span className="text-muted-foreground">{savedCattle.weight} kg</span>
            )}
            {savedPricePerKg && (
              <span className="text-muted-foreground">
                ৳{savedPricePerKg.toLocaleString("en-IN", { maximumFractionDigits: 0 })}/kg
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onAddAnother(savedCattle.tag)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Another
          </Button>
          <Button className="flex-1" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <form action={formAction} className="space-y-4 pt-1">
      {/* All hidden inputs — always in DOM for FormData */}
      <input type="hidden" name="tag_id" value={tagId} />
      <input type="hidden" name="gender" value={gender} />
      <input type="hidden" name="breed" value={breed} />
      <input type="hidden" name="purchase_date" value={purchaseDate} />
      <input type="hidden" name="purchase_price" value={price} />
      <input type="hidden" name="initial_weight_kg" value={weight} />
      <input type="hidden" name="dob" value={dob} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="transport_cost" value={transportCost} />
      <input type="hidden" name="haat_hasil" value={haatHasil} />

      {/* ── Identity ─────────────────────────────────────── */}
      <SectionDivider label="Identity" />

      {/* Tag ID */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="tag_id_display">Tag ID *</Label>
          {suggested && tagId !== suggested && !isDuplicate && (
            <button
              type="button"
              onClick={() => setTagId(suggested)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              Use {suggested}
            </button>
          )}
        </div>
        <Input
          id="tag_id_display"
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          placeholder="e.g. C001"
          className={isDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {isDuplicate ? (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Tag ID already exists — use a different one
          </p>
        ) : suggested && tagId === suggested ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Auto-suggested based on your existing tags
          </p>
        ) : null}
      </div>

      {/* Gender — toggle cards */}
      <div className="space-y-1.5">
        <Label>Gender *</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "male",
                label: "Male",
                symbol: "♂",
                active:
                  "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
              },
              {
                value: "female",
                label: "Female",
                symbol: "♀",
                active:
                  "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
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
        <Label htmlFor="breed_display">Breed</Label>
        <Input
          id="breed_display"
          list="cattle-breeds-list"
          placeholder="e.g. Brahman"
          autoComplete="off"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
        />
        <datalist id="cattle-breeds-list">
          {allBreeds.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      {/* ── Purchase Details ──────────────────────────────── */}
      <SectionDivider label="Purchase" />

      {/* Purchase Date */}
      <div className="space-y-1.5">
        <Label htmlFor="purchase_date_display">Purchase Date *</Label>
        <Input
          id="purchase_date_display"
          type="date"
          max={today}
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
      </div>

      {/* Price + Weight */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="price_display">Purchase Price (৳) *</Label>
            <Input
              id="price_display"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 80000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight_display">Initial Weight (kg) *</Label>
            <Input
              id="weight_display"
              type="number"
              min="1"
              step="0.1"
              placeholder="e.g. 180"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-1.5">
          <div className="space-y-1.5">
            <Label htmlFor="transport_display">Transport Cost (৳)</Label>
            <Input
              id="transport_display"
              type="number"
              min="0"
              step="1"
              placeholder="Optional"
              value={transportCost}
              onChange={(e) => setTransportCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="haat_display">Haat Tax/Hasil (৳)</Label>
            <Input
              id="haat_display"
              type="number"
              min="0"
              step="1"
              placeholder="Optional"
              value={haatHasil}
              onChange={(e) => setHaatHasil(e.target.value)}
            />
          </div>
        </div>

        {/* Live ৳/kg */}
        {pricePerKg !== null && (
          <div
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium
              ${
                pricePerKg < 150 || pricePerKg > 700
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
              }`}
          >
            {pricePerKg < 150 || pricePerKg > 700 ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              ৳{pricePerKg.toLocaleString("en-IN", { maximumFractionDigits: 0 })}/kg
              {" — "}
              {pricePerKg < 150
                ? "unusually low"
                : pricePerKg > 700
                ? "unusually high"
                : "typical range"}
            </span>
          </div>
        )}
      </div>

      {/* Body measurement calculator */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowMeasure((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Ruler className="h-3.5 w-3.5" />
          Calculate weight from body measurements
          {showMeasure ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showMeasure && (
          <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Girth (cm)</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.5}
                  placeholder="e.g. 180"
                  value={girth}
                  onChange={(e) => setGirth(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Length (cm)</Label>
                <Input
                  type="number"
                  min={1}
                  step={0.5}
                  placeholder="e.g. 120"
                  value={bodyLen}
                  onChange={(e) => setBodyLen(e.target.value)}
                />
              </div>
            </div>
            {estimatedWeight !== null ? (
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Est. weight:{" "}
                  <strong className="text-foreground">{estimatedWeight} kg</strong>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setWeight(String(estimatedWeight))}
                >
                  Use this →
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter both measurements to estimate weight.
              </p>
            )}
            <p className="text-xs text-muted-foreground/60">
              Formula: Girth² × Length ÷ 10840
            </p>
          </div>
        )}
      </div>

      {/* ── Optional ─────────────────────────────────────── */}
      <SectionDivider label="Optional" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dob_display">Date of Birth</Label>
          <Input
            id="dob_display"
            type="date"
            max={today}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          {ageText && (
            <p className="text-xs text-muted-foreground">{ageText}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes_display">Notes</Label>
          <Textarea
            id="notes_display"
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
          disabled={isPending || !gender || !tagId.trim() || isDuplicate}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Cattle"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface Props {
  existingTagIds: string[];
  existingBreeds: string[];
}

export function AddCattleDialog({ existingTagIds, existingBreeds }: Props) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [allTagIds, setAllTagIds] = useState(existingTagIds);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setAllTagIds(existingTagIds);
      setFormKey((k) => k + 1);
    }
  };

  const handleAddAnother = (addedTag: string) => {
    setAllTagIds((prev) => [...prev, addedTag]);
    setFormKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({ size: "sm" })}
        aria-label="Add cattle"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add Cattle
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Cattle</DialogTitle>
        </DialogHeader>
        <CattleForm
          key={formKey}
          existingTagIds={allTagIds}
          existingBreeds={existingBreeds}
          onAddAnother={handleAddAnother}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
