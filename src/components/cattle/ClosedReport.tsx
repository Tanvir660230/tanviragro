import { CalendarDays, CheckCircle2, HandCoins, Scale, Skull, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import type { CostParts } from "@/lib/cattle/cost-parts";
import type { SaleReport } from "@/lib/cattle/closed";
import { CostBar, type CostBarLabels } from "./CostBar";

type Lang = "en" | "bn";

const TEXT = {
  en: {
    sold: "Sold {date}", dead: "Died {date}", stolen: "Stolen / missing {date}", gone: "Left the farm",
    buyer: "Buyer: {buyer}", cause: "Cause: {cause}", days_line: "{days} days on the farm",
    closed: "This animal's account is closed: no more weights, feed or tasks are added. Its cost can still change if a cost dated before it left is recorded later.",
    closed_lost: "This animal's account is closed. If it was recorded by mistake or it came back, restore it from the ⋯ menu.",
    sale_price: "Sale price", total_cost: "Total cost", cost_sub: "purchase + own costs + farm share",
    profit: "Profit", loss: "Loss", on_cost: "{pct}% on cost", per_day: "Per day", per_day_sub: "over {days} days on the farm",
    days: "Days on the farm", bought: "bought {date}",
    cost_parts: "Where the money went",
    weight: "Weight and growth", at_purchase: "At purchase", at_sale: "At sale", last_weighed: "Last weighed", not_recorded: "Not recorded",
    growth: "Gain", growth_val: "{sign}{kg} kg in {days} days · {adg} kg/day", growth_from: "from {kg} kg on {date}",
    growth_none: "Growth needs two measured weights (an estimated purchase weight does not count).",
    price_kg: "Price per kg", price_kg_none: "Needs the weight at sale",
    changed_up: "When it was sold the total cost was {then}. Costs of {diff} dated on or before the sale were recorded afterwards, so the cost is now {now} and the profit {result}.",
    changed_down: "When it was sold the total cost was {then}. Costs of {diff} dated on or before the sale were removed or corrected afterwards, so the cost is now {now} and the profit {result}.",
    estimated: "estimated", measured: "measured",
  },
  bn: {
    sold: "বিক্রি হয়েছে {date}", dead: "মারা গেছে {date}", stolen: "চুরি / হারিয়েছে {date}", gone: "খামার ছেড়েছে",
    buyer: "ক্রেতা: {buyer}", cause: "কারণ: {cause}", days_line: "খামারে {days} দিন ছিল",
    closed: "এই গরুর হিসাব বন্ধ: নতুন ওজন, খাবার বা কাজ আর যোগ হবে না। তবে চলে যাওয়ার আগের তারিখের কোনো খরচ পরে লিখলে খরচ বদলাতে পারে।",
    closed_lost: "এই গরুর হিসাব বন্ধ। ভুল করে লেখা হলে বা গরু ফিরে এলে ⋯ মেনু থেকে আবার সক্রিয় করুন।",
    sale_price: "বিক্রয় মূল্য", total_cost: "মোট খরচ", cost_sub: "কেনা + নিজস্ব খরচ + খামারের ভাগ",
    profit: "লাভ", loss: "ক্ষতি", on_cost: "খরচের উপর {pct}%", per_day: "দৈনিক", per_day_sub: "খামারে {days} দিনে",
    days: "খামারে দিন", bought: "কেনা {date}",
    cost_parts: "টাকা কোথায় গেছে",
    weight: "ওজন ও বৃদ্ধি", at_purchase: "কেনার সময়", at_sale: "বিক্রির সময়", last_weighed: "শেষ মাপা", not_recorded: "লেখা হয়নি",
    growth: "বৃদ্ধি", growth_val: "{days} দিনে {sign}{kg} কেজি · দৈনিক {adg} কেজি", growth_from: "{date} তারিখের {kg} কেজি থেকে",
    growth_none: "বৃদ্ধি হিসাবের জন্য দুটো মাপা ওজন লাগে (আন্দাজে লেখা কেনার ওজন ধরা হয় না)।",
    price_kg: "কেজিপ্রতি দাম", price_kg_none: "বিক্রির ওজন লাগবে",
    changed_up: "বিক্রির দিন মোট খরচ ছিল {then}। পরে বিক্রির দিন বা তার আগের তারিখের {diff} খরচ লেখা হয়েছে, তাই এখন খরচ {now} আর লাভ {result}।",
    changed_down: "বিক্রির দিন মোট খরচ ছিল {then}। পরে বিক্রির দিন বা তার আগের তারিখের {diff} খরচ মুছে বা ঠিক করা হয়েছে, তাই এখন খরচ {now} আর লাভ {result}।",
    estimated: "আন্দাজ", measured: "মাপা",
  },
} as const;

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const tone = (n: number | null | undefined) => (n == null ? "" : n >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
const signed = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}`;

function Tile({ icon: Icon, label, value, sub, valueClass }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", valueClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export type ClosedReportProps = {
  lang: Lang;
  kind: "sold" | "dead" | "stolen" | "gone";
  date: string | null;
  buyer?: string | null;
  cause?: string | null;
  purchaseDate: string;
  days: number | null;
  parts: CostParts;
  costLabels: CostBarLabels;
  /** sold animals only */
  sale?: SaleReport | null;
  initial: { kg: number | null; estimated: boolean };
  lastWeighed: { kg: number; date: string } | null;
  /** the undo button (sold) — a client component */
  undo?: React.ReactNode;
};

/**
 * The page of an animal that has left the farm: what happened, what it made or lost, where
 * the money went, and (for a sale) how it grew. Replaces the day-to-day panels (value today,
 * break-even, weighing reminders) that no longer apply. Figures: lib/cattle/closed.ts.
 */
export function ClosedReport(p: ClosedReportProps) {
  const t = TEXT[p.lang];
  const sold = p.kind === "sold";
  const s = p.sale ?? null;
  const headline = p.kind === "sold" ? fill(t.sold, { date: fmtDay(p.date, p.lang) })
    : p.kind === "dead" ? fill(t.dead, { date: fmtDay(p.date, p.lang) })
    : p.kind === "stolen" ? fill(t.stolen, { date: fmtDay(p.date, p.lang) })
    : t.gone;
  const details = [
    p.buyer ? fill(t.buyer, { buyer: p.buyer }) : null,
    p.cause && p.cause !== "Not recorded" && p.kind === "dead" ? fill(t.cause, { cause: p.cause }) : null,
    p.days != null ? fill(t.days_line, { days: p.days }) : null,
  ].filter(Boolean).join(" · ");
  const result = s ? s.result : -p.parts.total;

  return (
    <div className="space-y-3">
      {/* what happened */}
      <section className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
        sold ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
        <div className="flex min-w-0 gap-3">
          {sold ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            : <Skull className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />}
          <div className="min-w-0">
            <p className="font-semibold">{headline}</p>
            {details && <p className="text-sm text-muted-foreground">{details}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{sold || p.kind === "gone" ? t.closed : t.closed_lost}</p>
          </div>
        </div>
        {p.undo && <div className="shrink-0">{p.undo}</div>}
      </section>

      {/* the result */}
      {sold && s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={HandCoins} label={t.sale_price} value={taka(s.salePrice)} sub={s.pricePerKg != null ? `${taka(s.pricePerKg)}/kg` : undefined} />
          <Tile icon={Wallet} label={t.total_cost} value={taka(s.cost)} sub={t.cost_sub} />
          <Tile icon={s.result >= 0 ? TrendingUp : TrendingDown} label={s.result >= 0 ? t.profit : t.loss} value={taka(s.result)} valueClass={tone(s.result)}
            sub={s.roiPct != null ? fill(t.on_cost, { pct: signed(s.roiPct) }) : undefined} />
          <Tile icon={CalendarDays} label={t.per_day} value={s.perDay != null ? taka(s.perDay) : "—"} valueClass={tone(s.perDay)}
            sub={fill(t.per_day_sub, { days: s.days })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile icon={Wallet} label={t.total_cost} value={taka(p.parts.total)} sub={t.cost_sub} />
          <Tile icon={TrendingDown} label={t.loss} value={taka(result)} valueClass={tone(result || null)} />
          <Tile icon={CalendarDays} label={t.days} value={p.days ?? "—"} sub={fill(t.bought, { date: fmtDay(p.purchaseDate, p.lang) })} />
        </div>
      )}

      {s?.changedBy != null && s.costAtSale != null && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {fill(s.changedBy > 0 ? t.changed_up : t.changed_down, { then: taka(s.costAtSale), diff: taka(Math.abs(s.changedBy)), now: taka(s.cost), result: taka(s.result) })}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.cost_parts}</h2>
          <CostBar parts={p.parts} labels={p.costLabels} />
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Scale className="h-3.5 w-3.5" aria-hidden />{t.weight}</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.at_purchase}</dt>
              <dd className="tabular-nums">{p.initial.kg ? `${Math.round(p.initial.kg)} kg` : "—"}{p.initial.kg ? <span className="ml-1 text-xs text-muted-foreground">({p.initial.estimated ? t.estimated : t.measured})</span> : null}</dd></div>
            {sold && (
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.at_sale}</dt>
                <dd className={cn("tabular-nums", !s?.saleWeightKg && "text-amber-700 dark:text-amber-400")}>{s?.saleWeightKg ? `${Math.round(s.saleWeightKg)} kg` : t.not_recorded}</dd></div>
            )}
            {p.lastWeighed && !(sold && s?.saleWeightKg) && (
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.last_weighed}</dt>
                <dd className="tabular-nums">{Math.round(p.lastWeighed.kg)} kg <span className="text-xs text-muted-foreground">· {fmtDay(p.lastWeighed.date, p.lang)}</span></dd></div>
            )}
            {sold && (
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.price_kg}</dt>
                <dd className="tabular-nums">{s?.pricePerKg != null ? `${taka(s.pricePerKg)}/kg` : <span className="text-xs text-muted-foreground">{t.price_kg_none}</span>}</dd></div>
            )}
          </dl>
          {sold && (s?.growth ? (
            <p className={cn("mt-3 text-sm font-medium", tone(s.growth.gainKg))}>
              {t.growth}: {fill(t.growth_val, { sign: s.growth.gainKg >= 0 ? "+" : "−", kg: Math.abs(s.growth.gainKg).toFixed(1), days: s.growth.days, adg: s.growth.adg.toFixed(2) })}
              <span className="block text-xs font-normal text-muted-foreground">{fill(t.growth_from, { kg: Math.round(s.growth.fromKg), date: fmtDay(s.growth.fromDate, p.lang) })}</span>
            </p>
          ) : <p className="mt-3 text-xs text-muted-foreground">{t.growth_none}</p>)}
        </section>
      </div>
    </div>
  );
}
