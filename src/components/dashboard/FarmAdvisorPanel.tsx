"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  ClipboardList,
  Wheat,
  TrendingUp,
  Heart,
  BarChart3,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  askAdvisor,
  type AdvisorQuestion,
  type AdvisorResult,
  type AdvisorItem,
} from "@/app/dashboard/(app)/advisor-actions";

const QUESTIONS: {
  key: AdvisorQuestion;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "daily_tasks",         label: "আজকের কাজ",        icon: ClipboardList },
  { key: "feed_status",         label: "ফিড স্ট্যাটাস",     icon: Wheat },
  { key: "sell_ready",          label: "বিক্রির পরামর্শ",   icon: TrendingUp },
  { key: "health_status",       label: "স্বাস্থ্য রিপোর্ট",  icon: Heart },
  { key: "monthly_performance", label: "মাসের হিসাব",        icon: BarChart3 },
];

const STATUS_ICON = {
  ok:      CheckCircle2,
  warning: AlertTriangle,
  danger:  AlertCircle,
  info:    Info,
} as const;

const STATUS_TEXT = {
  ok:      "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger:  "text-red-600 dark:text-red-400",
  info:    "text-blue-600 dark:text-blue-400",
} as const;

const STATUS_ROW = {
  ok:      "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800",
  danger:  "bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800",
  info:    "bg-blue-50   dark:bg-blue-950/30   border-blue-200   dark:border-blue-800",
} as const;

function ResultRow({ item }: { item: AdvisorItem }) {
  const Icon = STATUS_ICON[item.status];
  const inner = (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-opacity",
        STATUS_ROW[item.status],
        item.href && "hover:opacity-75 cursor-pointer"
      )}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", STATUS_TEXT[item.status])} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{item.label}</span>
        <span className="mx-1.5 text-muted-foreground/50">·</span>
        <span className="text-muted-foreground">{item.value}</span>
      </div>
      {item.href && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
      )}
    </div>
  );

  return item.href ? <Link href={item.href}>{inner}</Link> : inner;
}

export function FarmAdvisorPanel() {
  const [active, setActive] = useState<AdvisorQuestion | null>(null);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const ask = (q: AdvisorQuestion) => {
    setActive(q);
    setResult(null);
    startTransition(async () => {
      const res = await askAdvisor(q);
      setResult(res);
    });
  };

  const activeQ = QUESTIONS.find((q) => q.key === active);

  return (
    <div className="rounded-xl bg-card border border-border/70 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Smart Farm Advisor</p>
          <p className="text-xs text-muted-foreground">ডেটা থেকে সরাসরি পরামর্শ</p>
        </div>
      </div>

      {/* Question buttons */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-border/40">
        {QUESTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => ask(key)}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all",
              active === key
                ? "bg-primary text-primary-foreground border-primary shadow-card"
                : "bg-muted/50 text-foreground border-border hover:bg-muted hover:border-primary/40",
              isPending && active !== key && "opacity-40 pointer-events-none"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Result area */}
      <div className="p-4 min-h-[160px]">
        {/* Loading */}
        {isPending && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">বিশ্লেষণ করছি...</span>
          </div>
        )}

        {/* Error */}
        {!isPending && result && !result.ok && (
          <div className="flex items-center gap-2 py-4 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{result.error}</span>
          </div>
        )}

        {/* Success */}
        {!isPending && result && result.ok && (
          <div className="space-y-3 animate-fade-in-up">
            {/* Title + summary */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {activeQ && <activeQ.icon className="h-4 w-4 text-primary shrink-0" />}
                <h3 className="text-sm font-semibold">{result.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{result.summary}</p>
            </div>

            {/* Item rows */}
            {result.items.length > 0 && (
              <div className="space-y-1.5">
                {result.items.map((item, i) => (
                  <ResultRow key={i} item={item} />
                ))}
              </div>
            )}

            {/* Tip */}
            {result.tip && (
              <p className="text-xs text-muted-foreground border-t border-border/40 pt-2.5">
                💡 {result.tip}
              </p>
            )}
          </div>
        )}

        {/* Idle placeholder */}
        {!isPending && !result && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Bot className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground max-w-[200px]">
              উপরের বোতামে চাপ দিন — ফার্মের ডেটা থেকে পরামর্শ পাবেন
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
