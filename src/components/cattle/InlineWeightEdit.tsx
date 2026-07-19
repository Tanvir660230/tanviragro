"use client";

import { useState, useRef, useEffect } from "react";
import { Check, X, Loader2, Edit3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createWeightLog } from "@/app/dashboard/(app)/cattle/[id]/actions";

interface Props {
  cattleId: string;
  currentWeight: number;
  initialWeight: number;
  /** Show edit icon always (not just on hover) — use for cattle that haven't been weighed recently */
  alwaysShowEdit?: boolean;
}

export function InlineWeightEdit({ cattleId, currentWeight, initialWeight, alwaysShowEdit = false }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(currentWeight));
  const [isPending, setIsPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const gain = currentWeight - initialWeight;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  async function handleSave() {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      toast.error("Invalid weight");
      setValue(String(currentWeight));
      setIsEditing(false);
      return;
    }

    if (numValue === currentWeight) {
      setIsEditing(false);
      return;
    }

    setIsPending(true);
    const formData = new FormData();
    formData.append("weight_kg", String(numValue));
    formData.append("recorded_at", new Date().toISOString().split("T")[0]);

    formData.append("cattle_id", cattleId);

    try {
      const res = await createWeightLog(undefined, formData);
      if (res?.error) {
        toast.error(res.error);
        setValue(String(currentWeight));
      } else {
        toast.success("Weight updated!");
      }
    } catch {
      toast.error("Failed to update weight");
      setValue(String(currentWeight));
    } finally {
      setIsPending(false);
      setIsEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(String(currentWeight));
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Input
          ref={inputRef}
          type="number"
          min={0}
          step={0.1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-20 px-2 py-0 text-right text-sm"
          disabled={isPending}
        />
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-emerald-100 p-0.5 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            onClick={() => {
              setValue(String(currentWeight));
              setIsEditing(false);
            }}
            disabled={isPending}
            className="rounded bg-red-100 p-0.5 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex cursor-pointer items-center justify-end gap-1.5 rounded hover:bg-muted/50 px-1 py-0.5 transition-colors"
      onClick={() => setIsEditing(true)}
      title="Click to log new weight"
      aria-label="Log new weight"
    >
      <Edit3 className={`h-3 w-3 transition-opacity text-muted-foreground ${alwaysShowEdit ? "opacity-60" : "opacity-0 group-hover:opacity-100"}`} />
      <span>
        <span className="font-semibold">{currentWeight}</span>
        {gain > 0 && (
          <span className="text-muted-foreground text-xs ml-1">
            (+{gain.toFixed(1)})
          </span>
        )}
      </span>
    </div>
  );
}
