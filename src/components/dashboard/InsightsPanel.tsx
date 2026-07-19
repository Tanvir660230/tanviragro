"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, ChevronRight, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightItem } from "@/lib/supabase/queries/analytics";
import type { Dictionary } from "@/i18n/getDictionary";

const ICON_MAP = {
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const STYLE_MAP = {
  warning: {
    bar: "bg-amber-400",
    icon: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-950/50",
    border: "border-amber-200/60 dark:border-amber-800/30",
  },
  success: {
    bar: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/40",
    border: "border-emerald-200/60 dark:border-emerald-800/30",
  },
  info: {
    bar: "bg-blue-500",
    icon: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50/70 dark:bg-blue-950/25 hover:bg-blue-100/80 dark:hover:bg-blue-950/40",
    border: "border-blue-200/60 dark:border-blue-800/30",
  },
};

const STORAGE_KEY = "tanvir_agro_dismissed_insights";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Props {
  insights: InsightItem[];
  t: Dictionary;
}

export function InsightsPanel({ insights, t }: Props) {
  const label = t.dashboard.smart_insights;

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const entries: { id: string; at: number }[] = JSON.parse(raw);
      const now = Date.now();
      // Only keep dismissals from the last 24 hours
      const fresh = entries.filter(e => now - e.at < DISMISS_TTL_MS);
      if (fresh.length !== entries.length)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return new Set(fresh.map(e => e.id));
    } catch {
      return new Set();
    }
  });

  function dismiss(id: string) {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing: { id: string; at: number }[] = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line react-hooks/purity
      existing.push({ id, at: Date.now() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
  }

  const visible = insights.filter(i => !dismissed.has(i.id));

  return (
    <div className="rounded-xl bg-card border border-border/70 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        {visible.length > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary">
            {visible.length}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-foreground">{t.dashboard.insights_all_clear}</p>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-1.5">
          {visible.map((item) => {
            const Icon = ICON_MAP[item.type];
            const styles = STYLE_MAP[item.type];
            const isReadyToSell = item.id === "ready-to-sell";

            const inner = (
              <div className={cn(
                "relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all overflow-hidden",
                styles.bg, styles.border,
                item.href && "cursor-pointer",
                isReadyToSell && "ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] dark:shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-50/90 dark:bg-emerald-950/40 animate-pulse"
              )}>
                {/* Left color bar */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg", styles.bar)} />
                <div className="pl-1">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", styles.icon)} />
                </div>
                <p className="text-sm text-foreground flex-1 min-w-0 leading-snug">{item.message}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {item.href && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(item.id); }}
                    aria-label="Dismiss insight"
                    className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={item.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
