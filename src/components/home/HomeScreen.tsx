import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Banknote, Beef, CalendarClock, CheckCircle2, ClipboardList, HeartPulse,
  Moon, Package, PlayCircle, Scale, ShoppingCart, Stethoscope, Tag, TrendingUp, Wallet, Wheat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Attention, HomeCattle, HomeModel } from "@/lib/home/home-model";
import { EID_PROJECTION_DAYS, WEIGH_EVERY_DAYS } from "@/lib/home/home-model";

type T = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);
const kg = (n: number | null | undefined, dp = 0) => (n == null ? "—" : `${n.toLocaleString("en-IN", { maximumFractionDigits: dp, minimumFractionDigits: dp })} kg`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

function greeting(t: T, hour: number) {
  return hour < 12 ? t.greeting_morning : hour < 17 ? t.greeting_afternoon : t.greeting_evening;
}

function EstimateChip({ t }: { t: T }) {
  return <span className="ml-1 rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">{t.estimate_badge}</span>;
}

function SectionTitle({ icon: Icon, children, href, linkLabel }: { icon: React.ElementType; children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {children}
      </h2>
      {href && linkLabel && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {linkLabel} <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

// ── 1. What needs doing ─────────────────────────────────────────────
function attentionText(a: Attention, t: T): { title: string; sub: string; icon: React.ElementType } {
  switch (a.kind) {
    case "feed_low": return { title: fill(t.feed_low, { name: a.title, days: a.detail }), sub: t.feed_low_sub, icon: Wheat };
    case "feed_to_mix": return { title: fill(t.feed_to_mix, { count: a.detail }), sub: fill(t.feed_to_mix_sub, { names: a.title }), icon: Wheat };
    case "feed_not_started": return { title: fill(t.feed_not_started, { count: a.detail }), sub: fill(t.feed_not_started_sub, { names: a.title }), icon: PlayCircle };
    case "feed_unreconciled": return { title: fill(t.feed_unreconciled, { count: a.detail }), sub: t.feed_unreconciled_sub, icon: AlertTriangle };
    case "weigh": return { title: fill(t.weigh, { count: a.detail }), sub: fill(t.weigh_sub, { days: WEIGH_EVERY_DAYS, tags: a.title }), icon: Scale };
    case "price": return { title: t.price_missing, sub: t.price_missing_sub, icon: Tag };
    case "health_overdue": return { title: fill(t.health_overdue_count, { count: a.detail }), sub: a.title, icon: HeartPulse };
    case "health_due": return { title: fill(t.health_due_count, { count: a.detail }), sub: a.title, icon: HeartPulse };
  }
}

function AttentionSection({ items, t }: { items: Attention[]; t: T }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{t.all_good}</p>
      </div>
    );
  }
  const shown = items.slice(0, 5);
  return (
    <section aria-labelledby="attention-title" className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <SectionTitle icon={ClipboardList}><span id="attention-title">{t.attention_title}</span></SectionTitle>
      <ul className="divide-y divide-border/60">
        {shown.map((a, i) => {
          const { title, sub, icon: Icon } = attentionText(a, t);
          const urgent = a.severity === "urgent";
          return (
            <li key={`${a.kind}-${i}`}>
              <Link href={a.href} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  urgent ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{sub}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > shown.length && <p className="mt-2 text-xs text-muted-foreground">+{items.length - shown.length} {t.more}</p>}
    </section>
  );
}

// ── 2. Cattle ────────────────────────────────────────────────────────
function CattleCard({ c, t }: { c: HomeCattle; t: T }) {
  const basisLabel = c.weightBasis === "measured" ? t.measured : c.weightBasis === "projected" ? t.projected : c.weightBasis === "estimated" ? t.estimated : t.not_weighed;
  const profitUp = (c.profitToday ?? 0) >= 0;
  return (
    <Link href={`/dashboard/cattle/${c.id}`} className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">{c.tag}</p>
          <p className="text-xs text-muted-foreground">{fill(t.days_on_farm, { days: c.daysOnFarm })}</p>
        </div>
        {c.readyToSell && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{t.ready}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.weight}</p>
          <p className="text-lg font-bold tabular-nums leading-tight">{kg(c.weightKg)}</p>
          <p className={cn("text-[11px]", c.weightBasis === "measured" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {basisLabel}
            {c.daysSinceWeighed != null && c.daysSinceWeighed > 0 && <span className="text-muted-foreground"> · {fill(t.last_weighed, { days: c.daysSinceWeighed })}</span>}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.adg}</p>
          {c.adgKg != null
            ? <p className={cn("text-lg font-bold tabular-nums leading-tight", c.adgKg < 0 && "text-red-600 dark:text-red-400")}>{c.adgKg.toFixed(2)} <span className="text-xs font-medium text-muted-foreground">{t.per_day}</span></p>
            : <p className="pt-1 text-xs text-muted-foreground">{t.no_adg}</p>}
        </div>
      </div>

      <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.cost_so_far}</dt><dd className="tabular-nums font-medium">{taka(c.costSoFar)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t.value_today}<EstimateChip t={t} /></dt><dd className="tabular-nums font-medium">{taka(c.valueToday)}</dd></div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t.profit}<EstimateChip t={t} /></dt>
          <dd className={cn("tabular-nums font-semibold", c.profitToday == null ? "" : profitUp ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(c.profitToday)}</dd>
        </div>
      </dl>
    </Link>
  );
}

// ── 3. Money ─────────────────────────────────────────────────────────
function MoneyTile({ icon: Icon, label, value, sub, tone, estimate, t }: { icon: React.ElementType; label: string; value: number | null; sub: React.ReactNode; tone?: "good" | "bad"; estimate?: boolean; t: T }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}</p>
      <p className={cn("mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
        tone === "good" && "text-emerald-700 dark:text-emerald-400", tone === "bad" && "text-red-600 dark:text-red-400")}>{taka(value)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}{estimate && <EstimateChip t={t} />}</p>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────
export function HomeScreen({ model, t, hour, dateLabel }: { model: HomeModel; t: T; hour: number; dateLabel: string }) {
  const { money, cattle, feed, eid } = model;
  const profitTone = money.herdProfit == null ? undefined : money.herdProfit >= 0 ? "good" : "bad";
  const actions = [
    { href: "/dashboard/inventory/purchase", label: t.act_buy_feed, icon: ShoppingCart },
    { href: "/dashboard/inventory/usage", label: t.act_feed_usage, icon: PlayCircle },
    { href: "/dashboard/cattle/growth", label: t.act_weight, icon: Scale },
    { href: "/dashboard/finance", label: t.act_expense, icon: Wallet },
    { href: "/dashboard/health/treatments", label: t.act_treatment, icon: Stethoscope },
    { href: "/dashboard/cattle", label: t.act_cattle, icon: Beef },
  ];

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      <header>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h1 className="text-2xl font-bold tracking-tight">{greeting(t, hour)}</h1>
      </header>

      {/* 1 — what needs doing */}
      <AttentionSection items={model.attention} t={t} />

      {/* 2 — cattle */}
      {cattle.length > 0 && (
        <section aria-label={t.herd_title}>
          <SectionTitle icon={Beef} href="/dashboard/cattle" linkLabel={t.act_cattle}>{t.herd_title} · {cattle.length}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cattle.map((c) => <CattleCard key={c.id} c={c} t={t} />)}
          </div>
        </section>
      )}

      {/* 3 — money */}
      <section aria-label={t.money_title}>
        <SectionTitle icon={Banknote} href="/dashboard/finance" linkLabel={t.money_title}>{t.money_title}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MoneyTile icon={Wallet} label={t.cash} value={money.cash} sub={t.cash_sub} tone={money.cash != null && money.cash < 0 ? "bad" : undefined} t={t} />
          <MoneyTile icon={Package} label={t.month_expenses} value={money.monthOperatingExpenses} sub={t.month_expenses_sub} t={t} />
          <MoneyTile icon={Beef} label={t.herd_cost} value={money.herdCost} sub={<>{t.herd_value}: {taka(money.herdValue)}<EstimateChip t={t} /></>} t={t} />
          <MoneyTile icon={TrendingUp} label={t.profit_today} value={money.herdProfit} sub={t.profit_today_sub} tone={profitTone} estimate t={t} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4 — feed */}
        <section aria-label={t.feed_title} className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
          <SectionTitle icon={Wheat} href="/dashboard/inventory/usage" linkLabel={t.open_usage}>{t.feed_title}</SectionTitle>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.feed_month} <span className="text-[11px]">({t.feed_month_sub})</span></p>
              <p className="text-xl font-bold tabular-nums">{taka(feed.monthActual)}</p>
              {feed.monthRunning > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-400">{t.feed_running} {taka(feed.monthRunning)}<EstimateChip t={t} /></p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t.feed_per_head} <span className="text-[11px]">({t.feed_per_head_sub})</span></p>
              <p className="text-xl font-bold tabular-nums">{taka(feed.dailyPerHead)}</p>
            </div>
          </div>
          {feed.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.no_feed}</p>
          ) : (
            <ul className="space-y-2.5">
              {feed.items.map((i) => {
                const low = i.inUse && i.daysLeft != null && i.daysLeft <= 7;
                const pct = i.daysLeft != null ? Math.max(4, Math.min(100, (i.daysLeft / 30) * 100)) : null;
                return (
                  <li key={i.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{i.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {i.stockQty.toLocaleString("en-IN", { maximumFractionDigits: 1 })} {i.unit}
                        <span className={cn("ml-2 rounded px-1.5 py-px text-[10px] font-semibold",
                          i.inUse ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                          {i.inUse ? t.in_use : i.role === "ingredient" ? t.to_mix : t.not_started}
                        </span>
                      </span>
                    </div>
                    {i.inUse && (
                      <div className="mt-1">
                        {pct != null && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                            <div className={cn("h-full rounded-full", low ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        <p className={cn("mt-0.5 text-[11px]", low ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                          {i.daysLeft != null ? fill(t.days_left, { days: i.daysLeft }) : t.days_left_unknown}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 5 — Eid */}
        {eid && (
          <section aria-label={t.eid_title} className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
            <SectionTitle icon={Moon} href="/dashboard/cattle/qurbani" linkLabel={t.eid_title}>{t.eid_title}</SectionTitle>
            <div className="flex items-end gap-3">
              <CalendarClock className="h-8 w-8 text-primary" aria-hidden />
              <div>
                <p className="text-3xl font-bold tabular-nums leading-none">{fill(t.eid_days, { days: eid.daysLeft })}</p>
                <p className="mt-1 text-xs text-muted-foreground">{eid.date}</p>
              </div>
            </div>
            {eid.tooFar ? (
              <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">{fill(t.eid_too_far, { days: EID_PROJECTION_DAYS })}</p>
            ) : eid.projectedValue != null ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
                <div><dt className="text-xs text-muted-foreground">{t.eid_value}<EstimateChip t={t} /></dt><dd className="text-lg font-bold tabular-nums">{taka(eid.projectedValue)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t.eid_profit}<EstimateChip t={t} /></dt>
                  <dd className={cn("text-lg font-bold tabular-nums", (eid.projectedProfit ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(eid.projectedProfit)}</dd></div>
                <p className="col-span-2 text-[11px] leading-snug text-muted-foreground">{t.eid_note}</p>
              </dl>
            ) : (
              <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">{t.eid_incomplete}</p>
            )}
          </section>
        )}
      </div>

      {/* 6 — quick actions */}
      <section aria-label={t.actions_title}>
        <SectionTitle icon={ClipboardList}>{t.actions_title}</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-center shadow-card transition-colors hover:border-primary/40 hover:bg-primary/5">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-xs font-medium leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
