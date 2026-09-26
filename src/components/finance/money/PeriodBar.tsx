"use client";

import { useSearchParams } from "next/navigation";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { FinanceDateFilter } from "@/components/finance/FinanceDateFilter";

/** The tabs the period applies to; the cash statement has its own dates, the others are "today". */
const PERIOD_TABS = new Set(["overview", "costs"]);

/** The period the overview and the expenses tab use — hidden on tabs it does not change. */
export function PeriodBar({ from, to }: { from: string | null; to: string }) {
  const L = useL();
  const { locale } = useTranslation();
  if (!PERIOD_TABS.has(useSearchParams().get("tab") ?? "overview")) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold">
        {from ? `${fmtDay(from, locale)} – ${fmtDay(to, locale)}` : L(`শুরু থেকে ${fmtDay(to, locale)} পর্যন্ত`, `Since the start, to ${fmtDay(to, locale)}`)}
      </p>
      <FinanceDateFilter />
    </div>
  );
}
