"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpDown, Beef, ChevronDown, FileSpreadsheet, HeartPulse, LayoutGrid, MoreHorizontal,
  Scale, Search, ShieldAlert, Skull, Table2, Target, TrendingUp, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Board, BoardAnimal, BoardFilter, BoardSort } from "@/lib/cattle/board";
import { matchesFilter, sortAnimals } from "@/lib/cattle/board";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import { AddCattleDialog } from "@/components/cattle/AddCattleDialog";
import { CattleActionsMenu } from "@/components/cattle/CattleActionsMenu";
import { LivestockWorkspace } from "@/components/cattle/LivestockWorkspace";
import { BulkLivestockImportDialog } from "@/components/livestock/bulk/BulkLivestockImportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markAsDeceased } from "@/app/dashboard/(app)/cattle/actions";
import { toggleQuarantine } from "@/app/dashboard/(app)/cattle/[id]/actions";

type TB = Dictionary["cattle_board"];
type TH = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);
const kg = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n).toLocaleString("en-IN")} kg`);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

function Estimate({ th }: { th: TH }) {
  return <span className="ml-1 rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">{th.estimate_badge}</span>;
}

/** Weight history: measured points solid, estimated points hollow. */
function Sparkline({ series, label }: { series: BoardAnimal["series"]; label: string }) {
  if (series.length < 2) return null;
  const W = 120, H = 32, P = 3;
  const t0 = Date.parse(series[0].date), t1 = Date.parse(series[series.length - 1].date);
  const ks = series.map((s) => s.kg), lo = Math.min(...ks), hi = Math.max(...ks);
  const x = (d: string) => P + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
  const measured = series.filter((s) => s.type === "measured");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-[120px] shrink-0" role="img" aria-label={label}>
      {measured.length > 1 && (
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"
          points={measured.map((s) => `${x(s.date)},${y(s.kg)}`).join(" ")} />
      )}
      {series.map((s, i) => (
        <circle key={i} cx={x(s.date)} cy={y(s.kg)} r="2.2"
          className={s.type === "measured" ? "fill-primary" : "fill-background stroke-amber-500"} strokeWidth={s.type === "measured" ? 0 : 1.2} />
      ))}
    </svg>
  );
}

function AnimalCard({ a, tb, th }: { a: BoardAnimal; tb: TB; th: TH }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const m = a.metrics;
  const basis = m?.weightBasis === "measured" ? th.measured : m?.weightBasis === "projected" ? th.projected : m?.weightBasis === "estimated" ? th.estimated : th.not_weighed;
  const progress = a.targetWeightKg && m?.weightKg ? Math.min(100, (m.weightKg / a.targetWeightKg) * 100) : null;

  const quarantine = () => start(async () => {
    const res = await toggleQuarantine(a.id, !a.quarantined).catch(() => ({ error: "x" }));
    if (res?.error) toast.error(tb.failed);
    else { toast.success(fill(a.quarantined ? tb.ok_quarantine_off : tb.ok_quarantine_on, { tag: a.tag })); router.refresh(); }
  });
  const dead = () => {
    if (!window.confirm(fill(tb.confirm_dead, { tag: a.tag }))) return;
    start(async () => {
      const res = await markAsDeceased(a.id).catch(() => ({ error: "x" }));
      if (res?.error) toast.error(tb.failed);
      else { toast.success(fill(tb.ok_dead, { tag: a.tag })); router.refresh(); }
    });
  };

  return (
    <article className={cn("flex flex-col rounded-xl border border-border bg-card shadow-card transition-colors hover:border-primary/40", pending && "opacity-60")}>
      <Link href={`/dashboard/cattle/${a.id}`} className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold tracking-tight">{a.tag}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {[a.breed, a.gender === "male" ? tb.male : a.gender === "female" ? tb.female : a.gender].filter(Boolean).join(" · ")}{m ? `${a.breed || a.gender ? " · " : ""}${fill(th.days_on_farm, { days: m.daysOnFarm })}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {m?.readyToSell && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{th.ready}</span>}
            {a.quarantined && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">{tb.badge_quarantine}</span>}
            {a.qurbani && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{tb.badge_qurbani}</span>}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{th.weight}</p>
            <p className="text-xl font-bold tabular-nums leading-tight">{kg(m?.weightKg)}</p>
            <p className={cn("text-[11px]", m?.weightBasis === "measured" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
              {basis}{m?.daysSinceWeighed != null && m.daysSinceWeighed > 0 && <span className="text-muted-foreground"> · {fill(th.last_weighed, { days: m.daysSinceWeighed })}</span>}
            </p>
          </div>
          <Sparkline series={a.series} label={tb.weight_trend} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{th.adg}</p>
            {m?.adgKg != null
              ? <p className={cn("font-semibold tabular-nums", m.adgKg < 0 && "text-red-600 dark:text-red-400")}>{m.adgKg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{th.per_day}</span></p>
              : <p className="text-xs text-muted-foreground">{th.no_adg}</p>}
          </div>
          {progress != null && (
            <div>
              <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground"><Target className="h-3 w-3" aria-hidden />{fill(tb.target, { kg: a.targetWeightKg! })}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          )}
        </div>

        <dl className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{th.cost_so_far}</dt><dd className="font-medium tabular-nums">{taka(m?.costSoFar)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{th.value_today}<Estimate th={th} /></dt><dd className="font-medium tabular-nums">{taka(m?.valueToday)}</dd></div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{th.profit}<Estimate th={th} /></dt>
            <dd className={cn("font-semibold tabular-nums", m?.profitToday == null ? "" : m.profitToday >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(m?.profitToday)}</dd>
          </div>
        </dl>

        {a.nextHealth && (
          <p className={cn("mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
            a.nextHealth.overdue ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
            <HeartPulse className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate"><strong className="font-semibold">{a.nextHealth.overdue ? tb.overdue : tb.due}</strong> · {a.nextHealth.title} · {a.nextHealth.date}</span>
          </p>
        )}
      </Link>

      <div className="flex items-center gap-1 border-t border-border/60 p-2">
        <Link href={`/dashboard/cattle/${a.id}?tab=weight`} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium hover:bg-muted"><Scale className="h-4 w-4 text-primary" aria-hidden />{tb.btn_weight}</Link>
        <Link href={`/dashboard/cattle/${a.id}?tab=health`} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium hover:bg-muted"><HeartPulse className="h-4 w-4 text-primary" aria-hidden />{tb.btn_health}</Link>
        <Link href={`/dashboard/cattle/${a.id}`} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium hover:bg-muted"><Beef className="h-4 w-4 text-primary" aria-hidden />{tb.btn_details}</Link>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={tb.more} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem className="cursor-pointer gap-2" onClick={quarantine}>
              <ShieldAlert className="h-4 w-4" />{a.quarantined ? tb.quarantine_off : tb.quarantine_on}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 text-destructive" onClick={dead}>
              <Skull className="h-4 w-4" />{tb.mark_dead}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function CattleBoard({ board, rows, allBreeds, existingTagIds, alerts, today, openWeigh, openAdd, tb, th }: {
  board: Board; rows: CattleRowEnriched[]; allBreeds: string[]; existingTagIds: string[];
  alerts: { unweighedCount: number; overdueHealthCount: number; highFcrCount: number };
  today: string; openWeigh: boolean; openAdd: boolean; tb: TB; th: TH;
}) {
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [sort, setSort] = useState<BoardSort>("tag");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [importOpen, setImportOpen] = useState(false);
  const s = board.summary;

  const filters: { id: BoardFilter; label: string }[] = [
    { id: "all", label: tb.f_all }, { id: "ready", label: tb.f_ready }, { id: "weigh", label: tb.f_weigh },
    { id: "health", label: tb.f_health }, { id: "slow", label: tb.f_slow }, { id: "losing", label: tb.f_losing },
    { id: "quarantine", label: tb.f_quarantine }, { id: "qurbani", label: tb.f_qurbani }, { id: "past", label: tb.f_past },
  ];
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, board.animals.filter((a) => matchesFilter(a, f.id, today)).length])), [board, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = board.animals.filter((a) => matchesFilter(a, filter, today)
      && (!needle || a.tag.toLowerCase().includes(needle) || (a.breed ?? "").toLowerCase().includes(needle)));
    return sortAnimals(list, sort);
  }, [board, filter, sort, q, today]);

  const activeOptions = board.animals.filter((a) => a.status === "active").map((a) => ({ id: a.id, tag_id: a.tag }));
  const past = board.animals.filter((a) => a.status !== "active");

  return (
    <div className="w-full min-w-0 space-y-5 pb-12">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tb.title}</h1>
          <p className="text-sm text-muted-foreground">{fill(tb.active_count, { count: s.active })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setImportOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden />{tb.import}
          </button>
          <CattleActionsMenu activeCattle={activeOptions} defaultOpenWeigh={openWeigh} />
          <AddCattleDialog existingTagIds={existingTagIds} existingBreeds={allBreeds} defaultOpen={openAdd} />
        </div>
      </header>

      {/* herd summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Scale} label={tb.s_weight} value={kg(s.liveWeightKg)} sub={fill(tb.s_weight_sub, { weighed: s.weighedCount, estimated: s.estimatedCount })} />
        <Tile icon={TrendingUp} label={tb.s_adg} value={s.avgAdgKg != null ? `${s.avgAdgKg.toFixed(2)} ${th.per_day}` : "—"} sub={tb.s_adg_sub} />
        <Tile icon={Wallet} label={tb.s_invested} value={taka(s.herdCost)} sub={<>{fill(tb.s_worth_sub, { value: taka(s.herdValue) })}<Estimate th={th} /></>} />
        <Tile icon={Target} label={tb.s_ready} value={s.readyCount} sub={fill(tb.s_ready_sub, { count: s.active })} />
      </div>

      {/* search, filters, sort, view */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === "cards" && (<>
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">{tb.search}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tb.search}
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">{tb.sort}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as BoardSort)} className="bg-transparent text-xs font-medium outline-none">
              <option value="tag">{tb.s_tag}</option>
              <option value="profit">{tb.s_profit}</option>
              <option value="adg">{tb.s_adg_sort}</option>
              <option value="days">{tb.s_days}</option>
              <option value="weight">{tb.s_weight_sort}</option>
            </select>
          </label>
          </>)}
          <div className="flex h-10 rounded-lg border border-border bg-card p-0.5" role="group">
            {([["cards", tb.view_cards, LayoutGrid], ["table", tb.view_table, Table2]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={cn("flex items-center gap-1.5 rounded-md px-2.5 text-xs font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="h-3.5 w-3.5" aria-hidden />{label}
              </button>
            ))}
          </div>
        </div>
        {view === "cards" && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
            {filters.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                {f.label}
                <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", filter === f.id ? "bg-primary-foreground/20" : "bg-muted")}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "table" ? (
        <LivestockWorkspace cattle={rows} allBreeds={allBreeds} existingTagIds={existingTagIds} alerts={alerts} embedded />
      ) : filter === "past" ? null : shown.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" aria-hidden />{tb.no_match}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => <AnimalCard key={a.id} a={a} tb={tb} th={th} />)}
        </div>
      )}

      {/* sold and dead */}
      {view === "cards" && past.length > 0 && (
        <details open={filter === "past"} className="group rounded-xl border border-border bg-card shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            {tb.past_title} · {past.length}
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {past.map((a) => (
              <li key={a.id}>
                <Link href={`/dashboard/cattle/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/40">
                  <span className="font-medium">{a.tag}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {a.status === "sold" ? (a.realised?.date ? fill(tb.sold_on, { date: a.realised.date }) : tb.badge_sold) : tb.badge_dead}
                    </span>
                  </span>
                  <span className="flex gap-4 text-xs tabular-nums text-muted-foreground">
                    {a.realised?.salePrice != null && <span>{tb.sale_price}: {taka(a.realised.salePrice)}</span>}
                    <span>{tb.total_cost}: {taka(a.realised?.cost)}</span>
                    <span className={cn("font-semibold", (a.realised?.result ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{tb.result}: {taka(a.realised?.result)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <BulkLivestockImportDialog open={importOpen} onOpenChange={setImportOpen} existingTagIds={existingTagIds} />
    </div>
  );
}
