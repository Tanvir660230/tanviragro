import Link from "next/link";
import { CalendarDays, HandCoins, Receipt, Skull, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import type { BoardAnimal } from "@/lib/cattle/board";
import { closedSummary } from "@/lib/cattle/closed";

export type ClosedLang = "en" | "bn";

export const CLOSED_TEXT = {
  en: {
    f_sold: "Sold", f_lost: "Died / stolen",
    sold_n: "Animals sold", revenue: "Sold for {amount}", cost: "Total cost", cost_sub: "purchase + feed + farm costs",
    profit: "Total profit", loss: "Total loss", on_cost: "{pct}% on cost", avg: "Average per animal", avg_days: "{days} days on the farm on average",
    lost_n: "Died or stolen", lost_sub: "their whole cost is a loss",
    sold_on: "Sold {date}", died_on: "Died {date}", stolen_on: "Stolen {date}", gone: "Left the farm",
    days: "{days} days", buyer: "to {buyer}", cause: "cause: {cause}",
    sale_price: "Sale price", result: "Profit", loss_one: "Loss", per_kg: "৳{amount}/kg",
    none_sold: "No animal sold yet.", none_lost: "No animal has died or gone missing.",
    changed: "cost changed after the sale",
  },
  bn: {
    f_sold: "বিক্রিত", f_lost: "মৃত / চুরি",
    sold_n: "বিক্রি হয়েছে", revenue: "মোট বিক্রয় {amount}", cost: "মোট খরচ", cost_sub: "কেনা + খাবার + খামারের খরচ",
    profit: "মোট লাভ", loss: "মোট ক্ষতি", on_cost: "খরচের উপর {pct}%", avg: "গরুপ্রতি গড়", avg_days: "গড়ে {days} দিন খামারে ছিল",
    lost_n: "মৃত বা চুরি", lost_sub: "পুরো খরচই ক্ষতি",
    sold_on: "বিক্রি {date}", died_on: "মারা গেছে {date}", stolen_on: "চুরি {date}", gone: "খামার ছেড়েছে",
    days: "{days} দিন", buyer: "ক্রেতা: {buyer}", cause: "কারণ: {cause}",
    sale_price: "বিক্রয় মূল্য", result: "লাভ", loss_one: "ক্ষতি", per_kg: "৳{amount}/কেজি",
    none_sold: "এখনো কোনো গরু বিক্রি হয়নি।", none_lost: "কোনো গরু মারা যায়নি বা হারায়নি।",
    changed: "বিক্রির পরে খরচ বদলেছে",
  },
} as const;

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`);
const tone = (n: number | null | undefined) => (n == null ? "" : n >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400");

function Tile({ icon: Icon, label, value, sub, valueClass }: { icon: React.ElementType; label: string; value: React.ReactNode; sub: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", valueClass)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

/**
 * The animals that have left the farm: sold ones with what they made, or the ones that died
 * or were stolen with what was lost. Totals on top, newest first. Figures: lib/cattle/closed.ts.
 */
export function ClosedList({ kind, animals, lang }: { kind: "sold" | "lost"; animals: BoardAnimal[]; lang: ClosedLang }) {
  const t = CLOSED_TEXT[lang];
  const s = closedSummary(animals);
  const list = [...animals].sort((a, b) => (b.realised?.date ?? "").localeCompare(a.realised?.date ?? "") || a.tag.localeCompare(b.tag, undefined, { numeric: true }));

  return (
    <section className="space-y-3">
      {kind === "sold" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile icon={HandCoins} label={t.sold_n} value={s.sold.count} sub={fill(t.revenue, { amount: taka(s.sold.revenue) })} />
          <Tile icon={Wallet} label={t.cost} value={taka(s.sold.cost)} sub={t.cost_sub} />
          <Tile icon={TrendingUp} label={s.sold.result >= 0 ? t.profit : t.loss} value={taka(s.sold.result)} valueClass={tone(s.sold.result)}
            sub={fill(t.on_cost, { pct: pct(s.sold.roiPct) })} />
          <Tile icon={CalendarDays} label={t.avg} value={taka(s.sold.avgResult)} valueClass={tone(s.sold.avgResult)}
            sub={s.sold.avgDays != null ? fill(t.avg_days, { days: Math.round(s.sold.avgDays) }) : "—"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Tile icon={Skull} label={t.lost_n} value={s.lost.count} sub={t.lost_sub} />
          <Tile icon={Receipt} label={t.loss} value={taka(-s.lost.cost)} valueClass={tone(-s.lost.cost || null)} sub={t.cost_sub} />
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">{kind === "sold" ? t.none_sold : t.none_lost}</p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {list.map((a) => {
            const r = a.realised;
            const when = r?.kind === "sold" ? fill(t.sold_on, { date: fmtDay(r.date, lang) })
              : r?.kind === "dead" ? fill(t.died_on, { date: fmtDay(r.date, lang) })
              : r?.kind === "stolen" ? fill(t.stolen_on, { date: fmtDay(r.date, lang) })
              : t.gone;
            const roi = r && r.cost > 0 ? (r.result / r.cost) * 100 : null;
            const changed = r?.costAtSale != null && Math.abs(r.cost - r.costAtSale) >= 1;
            return (
              <li key={a.id}>
                <Link href={`/dashboard/cattle/${a.id}`} className="flex flex-col gap-2 px-4 py-3 text-sm hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.tag}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{when}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[
                        r?.days != null ? fill(t.days, { days: r.days }) : null,
                        r?.buyer ? fill(t.buyer, { buyer: r.buyer }) : null,
                        r?.weightKg && r.salePrice != null ? fill(t.per_kg, { amount: Math.round(r.salePrice / r.weightKg).toLocaleString("en-IN") }) : null,
                        r?.cause && r.cause !== "Not recorded" && r.kind !== "stolen" ? fill(t.cause, { cause: r.cause }) : null,
                        changed ? t.changed : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="grid shrink-0 grid-cols-3 gap-3 text-right text-xs tabular-nums sm:w-[22rem]">
                    <span><span className="block text-muted-foreground">{t.sale_price}</span><span className="font-medium">{taka(r?.salePrice)}</span></span>
                    <span><span className="block text-muted-foreground">{t.cost}</span><span className="font-medium">{taka(r?.cost)}</span></span>
                    <span><span className="block text-muted-foreground">{(r?.result ?? 0) >= 0 ? t.result : t.loss_one}</span>
                      <span className={cn("font-semibold", tone(r?.result))}>{taka(r?.result)}</span>
                      {roi != null && r?.kind === "sold" && <span className={cn("block text-[11px]", tone(roi))}>{pct(roi)}%</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
