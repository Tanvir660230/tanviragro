"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

export function BudgetPeriodPicker({ currentDays }: { currentDays: number }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { t }        = useTranslation();
  const tb           = t.budget;

  const presets = [
    { label: tb.preset_1m, days: 30  },
    { label: tb.preset_2m, days: 60  },
    { label: tb.preset_3m, days: 90  },
    { label: tb.preset_6m, days: 180 },
  ];

  const isCustom = !presets.some((p) => p.days === currentDays);
  const [showCustom, setShowCustom] = useState(isCustom);

  const today   = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 1);

  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + currentDays);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  function updateDays(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bd", String(days));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const target = new Date(e.target.value);
    const now    = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((target.getTime() - now.getTime()) / 86_400_000));
    updateDays(days);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
        {presets.map((p) => (
          <button
            key={p.days}
            onClick={() => { setShowCustom(false); updateDays(p.days); }}
            className={cn(
              "rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0",
              currentDays === p.days && !showCustom
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0",
            showCustom
              ? "bg-background text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {tb.custom}
        </button>
      </div>

      {showCustom && (
        <input
          type="date"
          defaultValue={isCustom ? targetDateStr : ""}
          min={minDate.toISOString().split("T")[0]}
          onChange={handleDateChange}
          className="rounded-lg border border-border bg-background px-3 py-[7px] text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}
