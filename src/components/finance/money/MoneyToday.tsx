"use client";

import Link from "next/link";
import { Banknote, CalendarDays, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import type { MoneyModel } from "@/lib/money/money-model";

export const taka = (n: number) => `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
export const signed = (n: number) => (Math.round(n) === 0 ? "৳0" : `${n > 0 ? "+" : "−"}${taka(n)}`);
export const tone = (n: number) => (Math.round(n) > 0 ? "text-emerald-600 dark:text-emerald-400" : Math.round(n) < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground");

/** The money today — the same figures as the homepage and the partners page. */
export function MoneyToday({ m }: { m: MoneyModel }) {
  const L = useL();
  const { locale } = useTranslation();
  // against the same days of last month: a month half gone always looks cheaper than a whole one
  const change = m.monthExpenses - m.lastMonthSameDays;
  const day = Number(m.today.slice(8, 10));
  const oldPrice = m.marketPriceAgeDays != null && m.marketPriceAgeDays > 30;
  const w = m.netWorth;

  return (
    <section className="rounded-xl border border-border bg-card shadow-card" aria-label={L("টাকার অবস্থা", "Money today")}>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/60 lg:grid-cols-4">
        <Tile icon={Banknote} label={L("হাতের নগদ", "Cash on hand")} value={(m.cash < 0 ? "−" : "") + taka(m.cash)} valueCls={m.cash < 0 ? "text-red-600 dark:text-red-400" : undefined}
          note={m.runwayDays != null
            ? L(`গত ৩০ দিনে গড়ে দিনে ${taka(m.avgDailySpend)} খরচ — এই হারে প্রায় ${m.runwayDays} দিন চলবে`, `Spent ${taka(m.avgDailySpend)} a day over 30 days — lasts about ${m.runwayDays} days at that rate`)
            : L("হাত ও ব্যাংক মিলিয়ে", "on hand and in the bank")}
          warn={m.runwayDays != null && m.runwayDays < 7} />
        <Tile icon={CalendarDays} label={L("এই মাসের চলতি খরচ", "Running costs this month")} value={taka(m.monthExpenses)}
          note={m.lastMonthSameDays > 0
            ? L(`গত মাসের প্রথম ${day} দিনে ${taka(m.lastMonthSameDays)} (${change >= 0 ? "বেশি" : "কম"} ${taka(change)}) · পুরো মাসে ${taka(m.lastMonthExpenses)}`,
                `first ${day} days of last month ${taka(m.lastMonthSameDays)} (${change >= 0 ? "up" : "down"} ${taka(change)}) · whole month ${taka(m.lastMonthExpenses)}`)
            : L("খাবার, ডাক্তার, মজুরি, বিদ্যুৎ …", "feed, vet, labour, utilities …")} />
        <Tile icon={m.farmResult.total >= 0 ? TrendingUp : TrendingDown} label={L("আজ সব গরু বিক্রি করলে", "If every animal were sold today")}
          value={signed(m.farmResult.total)} valueCls={tone(m.farmResult.total)}
          note={<>
            {L(`পাকা ${signed(m.farmResult.realized)} · আনুমানিক ${signed(m.farmResult.estimate)}`, `final ${signed(m.farmResult.realized)} · estimate ${signed(m.farmResult.estimate)}`)}
            {m.marketPrice && <span className="block">{L(`দাম ±১০%: ${signed(m.farmResult.realized + m.farmResult.range.low)} … ${signed(m.farmResult.realized + m.farmResult.range.high)}`, `price ±10%: ${signed(m.farmResult.realized + m.farmResult.range.low)} … ${signed(m.farmResult.realized + m.farmResult.range.high)}`)}</span>}
          </>} />
        <Tile icon={Landmark} label={L("খামারের মোট মূল্য আজ", "The farm's worth today")} value={(w.total < 0 ? "−" : "") + taka(w.total)}
          note={L(`নগদ ${taka(w.cash)} + স্টক ${taka(w.stock)} + গরু ${taka(w.herd)} + সম্পদ ${taka(w.assets)}${w.dues > 0.5 ? ` − দেনা ${taka(w.dues)}` : ""}`,
                  `cash ${taka(w.cash)} + stock ${taka(w.stock)} + cattle ${taka(w.herd)} + assets ${taka(w.assets)}${w.dues > 0.5 ? ` − dues ${taka(w.dues)}` : ""}`)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-2.5 text-xs text-muted-foreground">
        <span className={cn("flex items-center gap-1.5", oldPrice && "font-medium text-amber-700 dark:text-amber-400")}>
          <Scale className="h-3.5 w-3.5" aria-hidden />
          {m.marketPrice
            ? L(`গরুর দাম ধরা হয়েছে ৳${m.marketPrice.perKg}/কেজি (${fmtDay(m.marketPrice.date, locale)})`, `Cattle valued at ৳${m.marketPrice.perKg}/kg (${fmtDay(m.marketPrice.date, locale)})`)
            : L("বাজারদর দেওয়া নেই — গরু খরচে ধরা হয়েছে", "No market price — cattle counted at cost")}
          {oldPrice && L(` — ${m.marketPriceAgeDays} দিন পুরনো, নতুন দাম দিন`, ` — ${m.marketPriceAgeDays} days old, set today's price`)}
        </span>
        <Link href="#market-price" className="font-medium text-primary hover:underline">{L("বাজারদর বদলান", "Update the price")}</Link>
      </div>
    </section>
  );
}

function Tile({ icon: Icon, label, value, note, valueCls, warn }: { icon: React.ElementType; label: string; value: string; note: React.ReactNode; valueCls?: string; warn?: boolean }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl", valueCls)}>{value}</p>
      <p className={cn("mt-0.5 text-[11px] leading-snug", warn ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{note}</p>
    </div>
  );
}
