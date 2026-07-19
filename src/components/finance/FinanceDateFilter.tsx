"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nProvider";

type Preset = "this-month" | "last-month" | "last-3m" | "this-year" | "all";

export function FinanceDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const tf = t.finance;

  const fp = searchParams.get("fp");
  const fs = searchParams.get("fs");
  const fe = searchParams.get("fe");

  const isCustom = !fp && !!(fs || fe);
  const [showCustom, setShowCustom] = useState(isCustom);
  const activePreset: string | null = isCustom ? null : (fp ?? "this-month");

  const presets: { value: Preset; label: string }[] = [
    { value: "this-month",  label: tf.filter_this_month },
    { value: "last-month",  label: tf.filter_last_month },
    { value: "last-3m",     label: tf.filter_last_3m    },
    { value: "this-year",   label: tf.filter_this_year  },
    { value: "all",         label: tf.filter_all_time   },
  ];

  function setPreset(preset: Preset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fp", preset);
    params.delete("fs");
    params.delete("fe");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function setCustomRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("fp");
    if (from) params.set("fs", from); else params.delete("fs");
    if (to) params.set("fe", to); else params.delete("fe");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const today          = new Date();
  const todayStr       = today.toISOString().split("T")[0];
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex min-w-0 items-center gap-1 rounded-xl bg-muted/60 p-1.5 ring-1 ring-black/5 overflow-x-auto scrollbar-none flex-nowrap">
        {presets.map(p => (
          <button
            key={p.value}
            onClick={() => { setShowCustom(false); setPreset(p.value); }}
            className={cn(
              "rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0",
              activePreset === p.value && !showCustom
                ? "bg-card text-foreground shadow-card ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0",
            showCustom
              ? "bg-card text-foreground shadow-card ring-1 ring-black/5"
              : "text-muted-foreground hover:text-foreground hover:bg-card/60"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {tf.filter_custom}
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            defaultValue={fs ?? thisMonthStart}
            max={todayStr}
            onChange={e => setCustomRange(e.target.value, fe ?? todayStr)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground text-sm shrink-0">–</span>
          <input
            type="date"
            defaultValue={fe ?? todayStr}
            max={todayStr}
            onChange={e => setCustomRange(fs ?? thisMonthStart, e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground hidden sm:block lg:hidden">
        {tf.filter_scope_hint}
      </p>
    </div>
  );
}
