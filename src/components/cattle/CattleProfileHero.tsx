import Link from "next/link";
import { ArrowLeft, HeartPulse, Receipt, Scale, Target, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { WeightBasis } from "@/lib/home/home-model";

type TP = Dictionary["cattle_profile"];
type TH = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

export type ProfileHeroProps = {
  tp: TP; th: TH;
  backLabel: string;
  tag: string; statusLabel: string; statusClass: string;
  subtitle: string;                                     // gender · breed
  badges: { ready: boolean; quarantined: boolean; qurbani: boolean };
  actions: React.ReactNode;                             // undo sale, edit, more menu (unchanged components)
  dates: { purchase: string; dob: string | null; daysOnFarm: number };
  weight: { kg: number | null; basis: WeightBasis; daysSinceWeighed: number | null; initialKg: number | null; initialType: string;
            growth: { gainKg: number; fromKg: number; from: string; fromPurchase: boolean } | null };
  adg: { kg: number | null; tier: "good" | "fair" | "poor" | "none"; tierLabel: string; adg14: number | null; breedAvg: number | null };
  target: { kg: number; progress: number } | null;
  /** farmShare: the feed and running costs shared by taka × days (the farm position) — when set, "feed" is not shown apart */
  cost: { total: number; purchase: number; feed: number; medical: number; other: number; running: number; planReference: number | null; breakEvenPerKg: number | null; farmShare?: number | null };
  value: { worth: number | null; profit: number | null } | null;                       // active animals (estimates)
  realised: { kind: "sold" | "dead"; salePrice: number | null; result: number } | null;  // sold / dead
  perKg: { cost: number | null; feed: number | null };
  nextHealth: { title: string; date: string; overdue: boolean } | null;
  notes: string | null;
  id: string;
};

function Estimate({ th }: { th: TH }) {
  return <span className="ml-1 rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">{th.estimate_badge}</span>;
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function CattleProfileHero(p: ProfileHeroProps) {
  const { tp, th } = p;
  const basis = p.weight.basis === "measured" ? th.measured : p.weight.basis === "projected" ? th.projected : p.weight.basis === "estimated" ? th.estimated : th.not_weighed;
  const tierClass = { good: "text-emerald-700 dark:text-emerald-400", fair: "text-amber-700 dark:text-amber-400", poor: "text-red-600 dark:text-red-400", none: "text-muted-foreground" }[p.adg.tier];
  const segments = [
    { label: tp.purchase, amount: p.cost.purchase, color: "bg-blue-500" },
    p.cost.farmShare != null
      ? { label: tp.farm_share, amount: p.cost.farmShare, color: "bg-amber-500" }
      : { label: tp.feed, amount: p.cost.feed, color: "bg-amber-500" },
    { label: tp.medical, amount: p.cost.medical, color: "bg-red-400" },
    { label: tp.other, amount: p.cost.other, color: "bg-slate-400" },
  ].filter((s) => s.amount > 0);

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* header */}
      <header className="flex items-start gap-3">
        <Link href="/dashboard/cattle" aria-label={p.backLabel}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{p.tag}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", p.statusClass)}>{p.statusLabel}</span>
            {p.badges.ready && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{th.ready}</span>}
            {p.badges.quarantined && <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">{tp.quarantine}</span>}
            {p.badges.qurbani && <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">{tp.qurbani}</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {p.subtitle} · {fill(th.days_on_farm, { days: p.dates.daysOnFarm })} · {tp.bought} {p.dates.purchase}{p.dates.dob ? ` · ${tp.born} ${p.dates.dob}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{p.actions}</div>
      </header>

      {/* quick actions */}
      <nav className="grid grid-cols-3 gap-2" aria-label={tp.quick_actions}>
        {[
          { href: `/dashboard/cattle/${p.id}?tab=weight`, label: tp.act_weight, Icon: Scale },
          { href: `/dashboard/cattle/${p.id}?tab=health`, label: tp.act_health, Icon: HeartPulse },
          { href: `/dashboard/cattle/${p.id}?tab=finance`, label: tp.act_money, Icon: Receipt },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium shadow-card hover:border-primary/40 hover:bg-primary/5">
            <Icon className="h-4 w-4 text-primary" aria-hidden />{label}
          </Link>
        ))}
      </nav>

      {p.nextHealth && (
        <p className={cn("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm",
          p.nextHealth.overdue ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
          <span>{tp.next_health}: <strong>{p.nextHealth.title}</strong> · {p.nextHealth.date} ({p.nextHealth.overdue ? tp.overdue : tp.due})</span>
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {/* weight & growth */}
        <Panel title={th.weight}>
          <p className="text-3xl font-bold tabular-nums leading-none">{p.weight.kg != null ? Math.round(p.weight.kg).toLocaleString("en-IN") : "—"}<span className="ml-1 text-base font-normal text-muted-foreground">kg</span></p>
          <p className={cn("mt-1 text-xs", p.weight.basis === "measured" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {basis}{p.weight.daysSinceWeighed != null && p.weight.daysSinceWeighed > 0 && <span className="text-muted-foreground"> · {fill(th.last_weighed, { days: p.weight.daysSinceWeighed })}</span>}
          </p>
          {p.weight.growth ? (
            <p className={cn("mt-2 text-sm font-medium", p.weight.growth.gainKg >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {p.weight.growth.gainKg >= 0 ? "+" : ""}{p.weight.growth.gainKg.toFixed(1)} kg {fill(tp.gain_from, { kg: p.weight.growth.fromKg })}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({p.weight.growth.fromPurchase ? tp.at_purchase : fill(tp.first_weighing, { date: p.weight.growth.from })})</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{tp.growth_needs_two}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{fill(tp.initial, { kg: p.weight.initialKg ?? "—", type: p.weight.initialType })}</p>
          {p.target && (
            <div className="mt-3">
              <p className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Target className="h-3 w-3" aria-hidden />{fill(tp.target, { kg: p.target.kg })}</span>
                <span className="tabular-nums">{Math.round(p.target.progress)}%</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(p.target.progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, p.target.progress)}%` }} />
              </div>
            </div>
          )}
        </Panel>

        {/* daily gain */}
        <Panel title={th.adg}>
          {p.adg.kg != null ? (
            <>
              <p className={cn("flex items-center gap-2 text-3xl font-bold tabular-nums leading-none", tierClass)}>
                {p.adg.kg >= 0 ? <TrendingUp className="h-6 w-6" aria-hidden /> : <TrendingDown className="h-6 w-6" aria-hidden />}
                {p.adg.kg.toFixed(2)}<span className="text-base font-normal text-muted-foreground">{th.per_day}</span>
              </p>
              <p className={cn("mt-1 text-xs font-semibold", tierClass)}>{p.adg.tierLabel}</p>
            </>
          ) : <p className="text-sm text-muted-foreground">{th.no_adg}</p>}
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.adg14}</dt><dd className="tabular-nums">{p.adg.adg14 != null ? p.adg.adg14.toFixed(2) : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.breed_avg}</dt><dd className="tabular-nums">{p.adg.breedAvg != null ? p.adg.breedAvg.toFixed(2) : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.cost_per_kg}</dt><dd className="tabular-nums">{p.perKg.cost != null ? `${taka(p.perKg.cost)}/kg` : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.feed_per_kg}</dt><dd className="tabular-nums">{p.perKg.feed != null ? `${taka(p.perKg.feed)}/kg` : "—"}</dd></div>
          </dl>
        </Panel>

        {/* money */}
        <Panel title={tp.money}>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{th.cost_so_far}</dt><dd className="text-lg font-bold tabular-nums">{taka(p.cost.total)}</dd></div>
            {p.value && (<>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{th.value_today}<Estimate th={th} /></dt><dd className="font-medium tabular-nums">{taka(p.value.worth)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{th.profit}<Estimate th={th} /></dt>
                <dd className={cn("font-semibold tabular-nums", p.value.profit == null ? "" : p.value.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(p.value.profit)}</dd></div>
            </>)}
            {p.realised && (<>
              {p.realised.salePrice != null && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.sale_price}</dt><dd className="font-medium tabular-nums">{taka(p.realised.salePrice)}</dd></div>}
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{p.realised.kind === "dead" ? tp.loss : tp.result}</dt>
                <dd className={cn("font-semibold tabular-nums", p.realised.result >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(p.realised.result)}</dd></div>
            </>)}
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tp.break_even}</dt><dd className="tabular-nums">{p.cost.breakEvenPerKg != null ? `${taka(p.cost.breakEvenPerKg)}/kg` : "—"}</dd></div>
          </dl>
          {p.cost.total > 0 && segments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
                {segments.map((s) => <div key={s.label} className={cn("h-full", s.color)} style={{ width: `${(s.amount / p.cost.total) * 100}%` }} title={`${s.label}: ${taka(s.amount)}`} />)}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {segments.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1"><span className={cn("inline-block h-2 w-2 rounded-full", s.color)} />{s.label}</span>
                    <span className="tabular-nums">{taka(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(p.cost.running > 0 || p.cost.planReference != null) && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {p.cost.running > 0 && <span className="block text-amber-700 dark:text-amber-400">{fill(tp.running, { amount: taka(p.cost.running) })}</span>}
              {p.cost.planReference != null && fill(tp.plan_reference, { amount: taka(p.cost.planReference) })}
            </p>
          )}
        </Panel>
      </div>

      {p.notes && (
        <Panel title={tp.notes}><p className="whitespace-pre-line text-sm leading-relaxed">{p.notes}</p></Panel>
      )}
    </div>
  );
}
