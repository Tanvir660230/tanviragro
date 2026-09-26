"use client";

import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import type { MoneyModel } from "@/lib/money/money-model";
import { taka } from "./MoneyToday";

const monthName = (m: string, locale: string | undefined) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

/** The last six months: running costs, and cash in and out — side by side, same scale. */
export function MonthlyTrend({ months }: { months: MoneyModel["months"] }) {
  const L = useL();
  const { locale } = useTranslation();
  // bars: running costs only (cattle purchases and capital would dwarf them); cash in/out as figures
  const max = Math.max(1, ...months.map((m) => m.expenses));
  const h = (v: number) => `${Math.max(2, (Math.max(0, v) / max) * 100)}%`;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label={L("গত ৬ মাস", "The last six months")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{L("গত ৬ মাস", "The last six months")}</h3>
        <span className="text-[11px] text-muted-foreground">{L("বার = চলতি খরচ · নিচে টাকা এসেছে ↓ / গেছে ↑", "bars = running costs · below: cash in ↓ / out ↑")}</span>
      </div>
      <div className="mt-4 grid h-40 grid-cols-6 items-end gap-2 sm:gap-4" role="img"
        aria-label={months.map((m) => `${m.month}: ${taka(m.expenses)}`).join(", ")}>
        {months.map((m) => (
          <div key={m.month} className="flex h-full flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium tabular-nums">{m.expenses > 0 ? taka(m.expenses) : ""}</span>
            <div className="w-6 rounded-t bg-primary/70 sm:w-10" style={{ height: h(m.expenses) }} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-2 text-center sm:gap-4">
        {months.map((m) => (
          <div key={m.month}>
            <p className="text-[11px] font-medium">{monthName(m.month, locale)}</p>
            <p className="text-[10px] tabular-nums text-emerald-700 dark:text-emerald-400">↓{taka(m.cashIn)}</p>
            <p className="text-[10px] tabular-nums text-muted-foreground">↑{taka(m.cashOut)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
