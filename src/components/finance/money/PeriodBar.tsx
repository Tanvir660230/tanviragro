"use client";

import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { FinanceDateFilter } from "@/components/finance/FinanceDateFilter";

/** The period every tab below uses (overview, expenses). */
export function PeriodBar({ from, to }: { from: string | null; to: string }) {
  const L = useL();
  const { locale } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold">
        {from ? `${fmtDay(from, locale)} – ${fmtDay(to, locale)}` : L(`শুরু থেকে ${fmtDay(to, locale)} পর্যন্ত`, `Since the start, to ${fmtDay(to, locale)}`)}
      </p>
      <FinanceDateFilter />
    </div>
  );
}
