"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpDown, Banknote, Beef, CalendarCheck, CheckSquare, ChevronDown, Download, FileSpreadsheet, HeartPulse,
  LayoutGrid, ListChecks, Moon, MoreHorizontal, Scale, Search, ShieldAlert, ShieldCheck, Skull, Square, Table2, Target, TrendingUp, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Board, BoardAnimal, BoardFilter, BoardSort } from "@/lib/cattle/board";
import { matchesFilter, sortAnimals } from "@/lib/cattle/board";
import { AddCattleDialog } from "@/components/cattle/AddCattleDialog";
import { BulkWeightDialog } from "@/components/cattle/BulkWeightDialog";
import { BulkCostDialog } from "@/components/cattle/BulkCostDialog";
import { BulkHealthEventDialog } from "@/components/cattle/BulkHealthEventDialog";
import { DeathDialog } from "@/components/cattle/DeathDialog";
import { BulkLivestockImportDialog } from "@/components/livestock/bulk/BulkLivestockImportDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toggleQurbaniMark } from "@/app/dashboard/(app)/cattle/actions";
import { toggleQuarantine } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { bulkBatchStatusAction } from "@/app/dashboard/(app)/cattle/bulk-actions";
import { CATTLE_TEXT, fillC, type CattleLang, type CattleText } from "./cattle-view-text";

type TB = Dictionary["cattle_board"];
type TH = Dictionary["home"];

/** what the viewer may do — each button shows only when allowed (the server checks again) */
export type CattlePerms = { create: boolean; edit: boolean; weigh: boolean; health: boolean; cost: boolean; export: boolean };

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
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-[100px] shrink sm:w-[120px]" role="img" aria-label={label}>
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

function Tile({ icon: Icon, label, value, sub, onClick }: { icon: React.ElementType; label: string; value: React.ReactNode; sub: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cn("rounded-xl border border-border bg-card p-4 text-left shadow-card", onClick && "transition-colors hover:border-primary/40")}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Icon className="h-4 w-4 shrink-0" aria-hidden />{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </Tag>
  );
}

/** one animal's badges: ready, quarantine, qurbani */
function Badges({ a, tb, th }: { a: BoardAnimal; tb: TB; th: TH }) {
  return (
    <>
      {a.metrics?.readyToSell && <span className="whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{th.ready}</span>}
      {a.quarantined && <span className="whitespace-nowrap rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">{tb.badge_quarantine}</span>}
      {a.qurbani && <span className="whitespace-nowrap rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">{tb.badge_qurbani}</span>}
    </>
  );
}

type RowAction = "quarantine" | "qurbani" | "dead";

/** An animal's "⋯" menu (card and table): open, weigh, health, quarantine, qurbani, mark dead. */
function AnimalMenu({ a, tb, t, perms, onAction, className }: {
  a: BoardAnimal; tb: TB; t: CattleText; perms: CattlePerms; onAction: (x: RowAction, a: BoardAnimal) => void; className?: string;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={fillC(t.actions_for, { tag: a.tag })}
        className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted", className)}>
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => router.push(`/dashboard/cattle/${a.id}`)}><Beef className="h-4 w-4" aria-hidden />{t.m_open}</DropdownMenuItem>
        {perms.weigh && <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => router.push(`/dashboard/cattle/${a.id}?tab=weight`)}><Scale className="h-4 w-4" aria-hidden />{t.m_weigh}</DropdownMenuItem>}
        <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => router.push(`/dashboard/cattle/${a.id}?tab=health`)}><HeartPulse className="h-4 w-4" aria-hidden />{t.m_health_one}</DropdownMenuItem>
        {(perms.health || perms.edit) && <DropdownMenuSeparator />}
        {perms.health && (
          <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => onAction("quarantine", a)}>
            {a.quarantined ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <ShieldAlert className="h-4 w-4" aria-hidden />}{a.quarantined ? tb.quarantine_off : tb.quarantine_on}
          </DropdownMenuItem>
        )}
        {perms.edit && (
          <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => onAction("qurbani", a)}>
            <Moon className="h-4 w-4" aria-hidden />{a.qurbani ? t.qurbani_off : t.qurbani_on}
          </DropdownMenuItem>
        )}
        {perms.health && (
          <DropdownMenuItem variant="destructive" className="min-h-10 gap-2.5" onClick={() => onAction("dead", a)}>
            <Skull className="h-4 w-4" aria-hidden />{tb.mark_dead}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AnimalCard({ a, tb, th, t, lang, perms, selecting, picked, onToggle, onAction }: {
  a: BoardAnimal; tb: TB; th: TH; t: CattleText; lang: CattleLang; perms: CattlePerms;
  selecting: boolean; picked: boolean; onToggle: () => void; onAction: (x: RowAction, a: BoardAnimal) => void;
}) {
  const m = a.metrics;
  const basis = m?.weightBasis === "measured" ? th.measured : m?.weightBasis === "projected" ? th.projected : m?.weightBasis === "estimated" ? th.estimated : th.not_weighed;
  const progress = a.targetWeightKg && m?.weightKg ? Math.min(100, (m.weightKg / a.targetWeightKg) * 100) : null;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold tracking-tight">{a.tag}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {[a.breed, a.gender === "male" ? tb.male : a.gender === "female" ? tb.female : a.gender].filter(Boolean).join(" · ")}{m ? `${a.breed || a.gender ? " · " : ""}${fill(th.days_on_farm, { days: m.daysOnFarm })}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1"><Badges a={a} tb={tb} th={th} /></div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{th.weight}</p>
          <p className="text-2xl font-bold tabular-nums leading-tight">{kg(m?.weightKg)}</p>
          <p className={cn("text-xs", m?.weightBasis === "measured" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {basis}{m?.daysSinceWeighed != null && m.daysSinceWeighed > 0 && <span className="text-muted-foreground"> · {fill(th.last_weighed, { days: m.daysSinceWeighed })}</span>}
          </p>
        </div>
        <Sparkline series={a.series} label={tb.weight_trend} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{th.adg}</p>
          {m?.adgKg != null
            ? <p className={cn("font-semibold tabular-nums", m.adgKg < 0 && "text-red-600 dark:text-red-400")}>{m.adgKg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{th.per_day}</span></p>
            : <p className="text-sm text-muted-foreground">{th.no_adg}</p>}
        </div>
        {progress != null && (
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><Target className="h-3 w-3" aria-hidden />{fill(tb.target, { kg: a.targetWeightKg! })}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{Math.round(progress)}%</p>
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
        <p className={cn("mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm",
          a.nextHealth.overdue ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate"><strong className="font-semibold">{a.nextHealth.overdue ? tb.overdue : tb.due}</strong> · {a.nextHealth.title} · {fmtDay(a.nextHealth.date, lang)}</span>
        </p>
      )}
    </>
  );

  return (
    <article className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-card transition-colors", picked ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40")}>
      {selecting ? (
        <label className="flex flex-1 cursor-pointer flex-col p-4">
          <input type="checkbox" checked={picked} onChange={onToggle} aria-label={a.tag} className="mb-2 h-5 w-5 accent-primary" />
          {body}
        </label>
      ) : (
        <Link href={`/dashboard/cattle/${a.id}`} className="flex flex-1 flex-col p-4">{body}</Link>
      )}

      <div className="flex items-center gap-1 border-t border-border/60 p-2">
        {perms.weigh && <Link href={`/dashboard/cattle/${a.id}?tab=weight`} className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium hover:bg-muted"><Scale className="h-4 w-4 text-primary" aria-hidden />{tb.btn_weight}</Link>}
        <Link href={`/dashboard/cattle/${a.id}?tab=health`} className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium hover:bg-muted"><HeartPulse className="h-4 w-4 text-primary" aria-hidden />{tb.btn_health}</Link>
        <Link href={`/dashboard/cattle/${a.id}`} className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium hover:bg-muted"><Beef className="h-4 w-4 text-primary" aria-hidden />{tb.btn_details}</Link>
        <AnimalMenu a={a} tb={tb} t={t} perms={perms} onAction={onAction} />
      </div>
    </article>
  );
}

/** The table view: the same animals and figures as the cards, one row each. */
function AnimalTable({ list, tb, th, t, lang, perms, selecting, picked, onToggle, onToggleAll, onAction, sort, setSort }: {
  list: BoardAnimal[]; tb: TB; th: TH; t: CattleText; lang: CattleLang; perms: CattlePerms;
  selecting: boolean; picked: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void;
  onAction: (x: RowAction, a: BoardAnimal) => void; sort: BoardSort; setSort: (s: BoardSort) => void;
}) {
  const router = useRouter();
  const allPicked = list.length > 0 && list.every((a) => picked.has(a.id));
  const head = (label: string, key?: BoardSort, right = true) => (
    <th scope="col" className={cn("whitespace-nowrap px-3 py-2.5 font-medium", right && "text-right")}>
      {key ? (
        <button type="button" onClick={() => setSort(key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort === key && "text-foreground")}>
          {label}<ArrowUpDown className="h-3 w-3" aria-hidden />
        </button>
      ) : label}
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
          <tr>
            {selecting && (
              <th scope="col" className="w-10 px-3">
                <input type="checkbox" checked={allPicked} onChange={onToggleAll} aria-label={t.select_all} className="h-4 w-4 accent-primary" />
              </th>
            )}
            {head(t.col_tag, "tag", false)}
            {head(t.col_weight, "weight")}
            {head(t.col_adg, "adg")}
            {head(t.col_days, "days")}
            {head(t.col_cost)}
            {head(t.col_value)}
            {head(t.col_profit, "profit")}
            {head(t.col_next, undefined, false)}
            <th scope="col" className="w-12"><span className="sr-only">{t.more}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {list.map((a) => {
            const m = a.metrics;
            return (
              <tr key={a.id} onClick={() => (selecting ? onToggle(a.id) : router.push(`/dashboard/cattle/${a.id}`))}
                className={cn("cursor-pointer hover:bg-muted/40", picked.has(a.id) && "bg-primary/5")}>
                {selecting && (
                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={picked.has(a.id)} onChange={() => onToggle(a.id)} aria-label={a.tag} className="h-4 w-4 accent-primary" />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <p className="flex flex-wrap items-center gap-1.5"><span className="font-semibold">{a.tag}</span><Badges a={a} tb={tb} th={th} /></p>
                  <p className="text-xs text-muted-foreground">{[a.breed, a.gender === "male" ? tb.male : a.gender === "female" ? tb.female : null].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className="font-semibold">{kg(m?.weightKg)}</span>
                  <span className={cn("block text-xs", m?.weightBasis === "measured" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                    {m?.weightBasis === "measured" ? th.measured : m?.weightBasis === "projected" ? th.projected : m?.weightBasis === "estimated" ? th.estimated : th.not_weighed}
                  </span>
                </td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums", m?.adgKg != null && m.adgKg < 0 && "text-red-600 dark:text-red-400")}>{m?.adgKg != null ? m.adgKg.toFixed(2) : "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m?.daysOnFarm ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{taka(m?.costSoFar)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{taka(m?.valueToday)}</td>
                <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", m?.profitToday == null ? "" : m.profitToday >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{taka(m?.profitToday)}</td>
                <td className="px-3 py-2.5 text-xs">
                  {a.nextHealth ? (
                    <span className={a.nextHealth.overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                      {a.nextHealth.title} · {fmtDay(a.nextHealth.date, lang)}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-1" onClick={(e) => e.stopPropagation()}>
                  <AnimalMenu a={a} tb={tb} t={t} perms={perms} onAction={onAction} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Dlg = { kind: "weigh" | "health" | "cost" | "import"; ids?: string[] } | { kind: "dead"; animals: BoardAnimal[] } | null;

export function CattleBoard({ board, existingTagIds, allBreeds, today, openWeigh, openAdd, perms, lang, tb, th }: {
  board: Board; existingTagIds: string[]; allBreeds: string[];
  today: string; openWeigh: boolean; openAdd: boolean; perms: CattlePerms; lang: CattleLang; tb: TB; th: TH;
}) {
  const t = CATTLE_TEXT[lang];
  const router = useRouter();
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [sort, setSort] = useState<BoardSort>("tag");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dlg, setDlg] = useState<Dlg>(openWeigh && perms.weigh ? { kind: "weigh" } : null);
  const [pending, start] = useTransition();
  const s = board.summary;

  const filters: { id: BoardFilter; label: string }[] = [
    { id: "all", label: tb.f_all }, { id: "ready", label: tb.f_ready }, { id: "weigh", label: tb.f_weigh },
    { id: "health", label: tb.f_health }, { id: "slow", label: tb.f_slow }, { id: "losing", label: tb.f_losing },
    { id: "quarantine", label: tb.f_quarantine }, { id: "qurbani", label: tb.f_qurbani }, { id: "past", label: tb.f_past },
  ];
  const counts = useMemo(() => Object.fromEntries(filters.map((f) => [f.id, board.animals.filter((a) => matchesFilter(a, f.id, today)).length])), [board, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => sortAnimals(board.animals.filter((a) => a.status === "active" && filter !== "past" && matchesFilter(a, filter, today)
    && (!needle || a.tag.toLowerCase().includes(needle) || (a.breed ?? "").toLowerCase().includes(needle))), sort), [board, filter, sort, needle, today]);
  const active = board.animals.filter((a) => a.status === "active");
  const activeOptions = active.map((a) => ({ id: a.id, tag_id: a.tag }));
  const past = board.animals.filter((a) => a.status !== "active" && (!needle || a.tag.toLowerCase().includes(needle)));

  const canSelect = perms.weigh || perms.health || perms.cost;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setPicked((p) => (shown.every((a) => p.has(a.id)) ? new Set() : new Set(shown.map((a) => a.id))));
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  // only the selected animals still on screen: a filter or search change never acts on hidden ones
  const pickedAnimals = shown.filter((a) => picked.has(a.id));
  const pickedIds = pickedAnimals.map((a) => a.id);
  const close = () => setDlg(null);
  // a file download (a route that answers with CSV), not a page to navigate to
  const downloadCsv = () => {
    const link = document.createElement("a");
    link.href = "/dashboard/cattle/export";
    link.download = `cattle-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const onAction = (x: RowAction, a: BoardAnimal) => {
    if (x === "dead") { setDlg({ kind: "dead", animals: [a] }); return; }
    start(async () => {
      const res = x === "quarantine"
        ? await toggleQuarantine(a.id, !a.quarantined).catch(() => ({ error: tb.failed }))
        : await toggleQurbaniMark(a.id, !a.qurbani).catch(() => ({ error: tb.failed }));
      if (res?.error) { toast.error(res.error || tb.failed); return; }
      toast.success(x === "quarantine" ? fill(a.quarantined ? tb.ok_quarantine_off : tb.ok_quarantine_on, { tag: a.tag }) : fillC(a.qurbani ? t.ok_qurbani_off : t.ok_qurbani_on, { tag: a.tag }));
      router.refresh();
    });
  };
  const quarantineMany = (on: boolean) => start(async () => {
    const res = await bulkBatchStatusAction(pickedIds, on ? "quarantined" : "active").catch(() => ({ success: false, updatedCount: 0, error: tb.failed }));
    if (!res.success) { toast.error(res.error || tb.failed); return; }
    toast.success(fillC(on ? t.q_ok_on : t.q_ok_off, { n: res.updatedCount }));
    stopSelecting();
    router.refresh();
  });

  return (
    <div className={cn("w-full min-w-0 space-y-5 pb-12", pending && "opacity-80 transition-opacity")}>
      {/* header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tb.title}</h1>
          <p className="text-sm text-muted-foreground">{fill(tb.active_count, { count: s.active })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perms.create && <AddCattleDialog existingTagIds={existingTagIds} existingBreeds={allBreeds} defaultOpen={openAdd} />}
          {perms.weigh && active.length > 0 && (
            <button type="button" onClick={() => setDlg({ kind: "weigh" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <Scale className="h-4 w-4 text-primary" aria-hidden />{t.weigh}
            </button>
          )}
          {(perms.health || perms.cost || perms.create || perms.export) && (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={t.more}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted">
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {perms.health && active.length > 0 && <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => setDlg({ kind: "health" })}><CalendarCheck className="h-4 w-4" aria-hidden />{t.m_health}</DropdownMenuItem>}
                {perms.cost && active.length > 0 && <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => setDlg({ kind: "cost" })}><Banknote className="h-4 w-4" aria-hidden />{t.m_cost}</DropdownMenuItem>}
                {perms.create && <DropdownMenuItem className="min-h-10 gap-2.5" onClick={() => setDlg({ kind: "import" })}><FileSpreadsheet className="h-4 w-4" aria-hidden />{t.m_import}</DropdownMenuItem>}
                {perms.export && (
                  <DropdownMenuItem className="min-h-10 gap-2.5" onClick={downloadCsv}>
                    <Download className="h-4 w-4" aria-hidden />{t.m_export}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* herd summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Scale} label={tb.s_weight} value={kg(s.liveWeightKg)} sub={fill(tb.s_weight_sub, { weighed: s.weighedCount, estimated: s.estimatedCount })} onClick={() => setFilter("weigh")} />
        <Tile icon={TrendingUp} label={tb.s_adg} value={s.avgAdgKg != null ? `${s.avgAdgKg.toFixed(2)} ${th.per_day}` : "—"} sub={tb.s_adg_sub} onClick={() => { setSort("adg"); setFilter("all"); }} />
        <Tile icon={Wallet} label={tb.s_invested} value={taka(s.herdCost)} sub={<>{fill(tb.s_worth_sub, { value: taka(s.herdValue) })}<Estimate th={th} /></>} onClick={() => { setSort("profit"); setFilter("all"); }} />
        <Tile icon={Target} label={tb.s_ready} value={s.readyCount} sub={fill(tb.s_ready_sub, { count: s.active })} onClick={() => setFilter("ready")} />
      </div>

      {/* search, sort, view, select — the same for cards and table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">{tb.search}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tb.search}
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">{tb.sort}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as BoardSort)} className="bg-transparent text-sm font-medium outline-none">
              <option value="tag">{tb.s_tag}</option>
              <option value="profit">{tb.s_profit}</option>
              <option value="adg">{tb.s_adg_sort}</option>
              <option value="days">{tb.s_days}</option>
              <option value="weight">{tb.s_weight_sort}</option>
            </select>
          </label>
          <div className="flex h-10 rounded-lg border border-border bg-card p-0.5" role="group">
            {([["cards", tb.view_cards, LayoutGrid], ["table", tb.view_table, Table2]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                className={cn("flex items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="h-4 w-4" aria-hidden />{label}
              </button>
            ))}
          </div>
          {canSelect && active.length > 0 && (
            <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}
              className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium",
                selecting ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <ListChecks className="h-4 w-4" aria-hidden />{selecting ? t.select_done : t.select}
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
          {filters.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn("flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              {f.label}
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filter === f.id ? "bg-primary-foreground/20" : "bg-muted")}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        {selecting && view === "cards" && shown.length > 0 && (
          <button type="button" onClick={toggleAll} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            {shown.every((a) => picked.has(a.id)) ? <CheckSquare className="h-5 w-5 text-primary" aria-hidden /> : <Square className="h-5 w-5" aria-hidden />}{t.select_all}
          </button>
        )}
      </div>

      {/* the animals */}
      {filter === "past" ? null : shown.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" aria-hidden />{tb.no_match}</p>
      ) : view === "table" ? (
        <AnimalTable list={shown} tb={tb} th={th} t={t} lang={lang} perms={perms} selecting={selecting} picked={picked}
          onToggle={toggle} onToggleAll={toggleAll} onAction={onAction} sort={sort} setSort={setSort} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <AnimalCard key={a.id} a={a} tb={tb} th={th} t={t} lang={lang} perms={perms}
              selecting={selecting} picked={picked.has(a.id)} onToggle={() => toggle(a.id)} onAction={onAction} />
          ))}
        </div>
      )}

      {/* sold, dead and gone */}
      {past.length > 0 && (
        <details open={filter === "past"} className="group rounded-xl border border-border bg-card shadow-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
            {t.past_title} · {past.length}
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {past.map((a) => {
              const r = a.realised;
              const badge = a.status === "sold" ? (r?.date ? fill(tb.sold_on, { date: fmtDay(r.date, lang) }) : tb.badge_sold)
                : a.status === "dead" ? (r?.date ? fillC(t.died_on, { date: fmtDay(r.date, lang) }) : tb.badge_dead)
                : t.badge_gone;
              return (
                <li key={a.id}>
                  <Link href={`/dashboard/cattle/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/40">
                    <span className="min-w-0">
                      <span className="font-semibold">{a.tag}</span>
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
                      {r?.cause && r.cause !== "Not recorded" && <span className="ml-2 text-xs text-muted-foreground">{t.cause}: {r.cause}</span>}
                    </span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                      {r?.salePrice != null && <span>{tb.sale_price}: {taka(r.salePrice)}</span>}
                      <span>{tb.total_cost}: {taka(r?.cost)}</span>
                      <span className={cn("font-semibold", (r?.result ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{tb.result}: {taka(r?.result)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {/* what to do with the selection */}
      {selecting && pickedAnimals.length > 0 && (
        <div className="sticky bottom-20 z-30 md:bottom-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-floating backdrop-blur">
            <span className="px-1 text-sm font-semibold">{fillC(t.selected, { n: pickedAnimals.length })}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {perms.weigh && <BarButton icon={Scale} label={t.b_weigh} onClick={() => setDlg({ kind: "weigh", ids: pickedIds })} />}
              {perms.health && <BarButton icon={CalendarCheck} label={t.b_health} onClick={() => setDlg({ kind: "health", ids: pickedIds })} />}
              {perms.cost && <BarButton icon={Banknote} label={t.b_cost} onClick={() => setDlg({ kind: "cost", ids: pickedIds })} />}
              {perms.health && (pickedAnimals.some((a) => !a.quarantined)
                ? <BarButton icon={ShieldAlert} label={t.b_q_on} onClick={() => quarantineMany(true)} />
                : <BarButton icon={ShieldCheck} label={t.b_q_off} onClick={() => quarantineMany(false)} />)}
              {perms.health && <BarButton icon={Skull} label={t.b_dead} danger onClick={() => setDlg({ kind: "dead", animals: pickedAnimals })} />}
              <button type="button" onClick={() => setPicked(new Set())} aria-label={t.clear}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
        </div>
      )}

      {/* the dialogs (never inside a menu, which closes them) */}
      {dlg?.kind === "weigh" && (
        <BulkWeightDialog open onOpenChange={(o) => { if (!o) close(); }}
          cattle={dlg.ids?.length ? activeOptions.filter((c) => dlg.ids!.includes(c.id)) : activeOptions} />
      )}
      {dlg?.kind === "health" && (
        <BulkHealthEventDialog activeCattle={activeOptions} initialSelectedIds={dlg.ids ?? []} open onOpenChange={(o) => { if (!o) close(); }} />
      )}
      {dlg?.kind === "cost" && (
        <BulkCostDialog activeCattle={activeOptions} initialSelectedIds={dlg.ids ?? []} open onOpenChange={(o) => { if (!o) close(); }} />
      )}
      {dlg?.kind === "dead" && (
        <DeathDialog animals={dlg.animals.map((a) => ({ id: a.id, tag: a.tag }))} lang={lang} onClose={close} onDone={stopSelecting} />
      )}
      <BulkLivestockImportDialog open={dlg?.kind === "import"} onOpenChange={(o) => { if (!o) close(); }} existingTagIds={existingTagIds} />
    </div>
  );
}

function BarButton({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
        danger ? "text-red-600 hover:bg-red-500/10 dark:text-red-400" : "bg-muted/60 hover:bg-muted")}>
      <Icon className="h-4 w-4" aria-hidden />{label}
    </button>
  );
}
