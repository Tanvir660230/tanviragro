"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Square, Pencil, AlertTriangle, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { startFeedUsage, endFeedUsage, cancelFeedUsage, setFeedUsageRule, type UsageFormState } from "@/app/dashboard/(app)/inventory/usage/actions";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";

export type UsagePageData = {
  asOf: string;
  canEdit: boolean;
  periods: Period[];
  lines: LineResult[];
  items: FeedItemStatus[];
  recipes: { id: string; name: string }[];
  /** targets with a feeding chart: "item:<id>" / "recipe:<id>" */
  chartTargets: string[];
  totals: {
    actualThisMonth: number; estimatedThisMonth: number; actualAll: number; estimatedAll: number;
    unreconciledLines: number; recordedMissingCost: number; stockValue: number; unallocated: number;
  };
  byMonth: [string, { actual: number; estimated: number }][];
  byItem: { id: string; name: string; unit: string; actualQty: number; actualValue: number; estimatedQty: number; estimatedValue: number }[];
  cattle: { id: string; tag: string; actual: number; estimated: number; gainKg: number | null; costPerKgGain: number | null }[];
};

const taka = (n: number | null | undefined) => (n == null ? "—" : `৳${Math.round(n).toLocaleString("en-IN")}`);
const qty = (n: number | null | undefined, unit: string) => (n == null ? "—" : `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}`);

function Badge({ kind }: { kind: "actual" | "estimated" | "unreconciled" }) {
  const cls = {
    actual: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    estimated: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    unreconciled: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  }[kind];
  const label = { actual: "Actual", estimated: "Estimated · running", unreconciled: "Needs attention" }[kind];
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{label}</span>;
}

export function FeedUsageClient({ data }: { data: UsagePageData }) {
  const [start, setStart] = useState<string | null>(null);      // preselected target or "" for a free choice
  const [ending, setEnding] = useState<Period | null>(null);
  const [checking, setChecking] = useState<Period | null>(null);
  const [ruleOf, setRuleOf] = useState<Period | null>(null);
  const openPeriods = data.periods.filter((p) => p.status === "open");
  const closedPeriods = data.periods.filter((p) => p.status !== "open");
  const lineOf = (periodId: string, itemId: string) => data.lines.find((l) => l.periodId === periodId && l.itemId === itemId);
  const idleWithStock = data.items.filter((i) => !i.openPeriodId && i.stockQty > 0.0001);
  const attention = data.periods.filter((p) => p.status === "unreconciled");

  return (
    <div className="space-y-5">
      {/* Summary: never one mixed number */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Feed cost this month" value={taka(data.totals.actualThisMonth)} tag="actual" sub="deducted daily, settled at each count" />
        <Stat label="Running this month" value={taka(data.totals.estimatedThisMonth)} tag="estimated" sub="today, not deducted yet" />
        <Stat label="Feed stock value" value={taka(data.totals.stockValue)} sub="ledger, weighted average cost" />
        <Stat label="Needs attention" value={String(attention.length + (data.totals.recordedMissingCost > 0 ? 1 : 0))} tag={attention.length ? "unreconciled" : undefined} sub="gaps or missing prices" />
      </div>

      {attention.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm dark:border-rose-900/60 dark:bg-rose-950/20">
          <p className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300"><AlertTriangle className="h-4 w-4" /> Reconciliation gap</p>
          <ul className="mt-1 space-y-0.5 text-xs text-rose-800/90 dark:text-rose-300/90">
            {attention.flatMap((p) => p.lines.filter((l) => (l.gapQty ?? 0) > 0 || l.costMissing).map((l) => (
              <li key={p.id + l.itemId}>
                {l.itemName} ({p.startDate} → {p.endDate}):{" "}
                {(l.gapQty ?? 0) > 0
                  ? `you counted ${qty(l.gapQty, l.unit)} more than the recorded stock — a purchase in this period is probably not entered yet. Enter it with its real purchase date; this period then reconciles automatically.`
                  : "no priced stock-in yet, so the cost is unknown. Enter the purchase price."}
              </li>
            )))}
          </ul>
        </div>
      )}

      {/* Active periods */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Feeds in use now</h2>
            <p className="text-xs text-muted-foreground">Each day&apos;s use comes off the stock automatically. Count any time (it keeps running), or end it when the feed finishes — the difference is adjusted.</p>
          </div>
          {data.canEdit && <Button size="sm" onClick={() => setStart("")}><Play className="mr-1 h-4 w-4" />Start using a feed</Button>}
        </header>
        {openPeriods.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No feed is in use. Start one to get automatic daily usage and cost.</p>
        ) : (
          <ul className="divide-y divide-border">
            {openPeriods.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.targetName}</span>
                  <Badge kind="estimated" />
                  <span className="text-xs text-muted-foreground">since {p.startDate} · {ruleText(p)}</span>
                  {data.canEdit && (
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRuleOf(p)}><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />Rule</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setChecking(p)}><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Count check</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEnding(p)}><Square className="mr-1 h-3.5 w-3.5" />Finished / end</Button>
                      <CancelButton periodId={p.id} />
                    </div>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {p.lines.map((l) => {
                    const r = lineOf(p.id, l.itemId);
                    const item = data.items.find((i) => i.id === l.itemId);
                    return (
                      <div key={l.itemId} className="rounded-lg bg-muted/40 p-2.5 text-xs">
                        <p className="font-medium text-sm">{l.itemName}{p.targetType === "recipe" && <span className="ml-1 text-muted-foreground">({Math.round(l.share * 100)}%)</span>}</p>
                        {!r ? null : r.estimateBasis === "none" ? (
                          <p className="text-muted-foreground">Nothing can be deducted daily yet — set a feeding chart or rule, or it is learned when this period ends.</p>
                        ) : (
                          <>
                            <p>Deducted so far <strong>{qty(r?.postedQty ?? 0, l.unit)}</strong> ({taka(r?.postedValue ?? 0)}){r?.lastPosted ? <span className="text-muted-foreground"> · last {r.lastPosted}</span> : null}</p>
                            <p className="text-muted-foreground">{qty(r?.dailyQty, l.unit)}/day — {r?.estimateBasis === "rule" ? (p.ruleType === "chart" ? "by feeding chart" : "by feeding rule") : "learned from earlier periods"}{(r?.pendingQty ?? 0) > 0 ? ` · today ≈ ${qty(r?.pendingQty, l.unit)} (not deducted yet)` : ""}</p>
                          </>
                        )}
                        {item && (
                          <p className="text-muted-foreground">
                            Recorded stock {qty(item.stockQty, l.unit)}
                            {item.daysLeft != null && <> · expected to finish in ≈ <strong className="text-foreground">{Math.max(0, Math.floor(item.daysLeft))} days</strong> ({item.depletionDate})</>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {idleWithStock.length > 0 && data.canEdit && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            In stock but not in use:{" "}
            {idleWithStock.map((i, k) => (
              <span key={i.id}>
                {k > 0 && ", "}
                <button className="text-primary underline-offset-2 hover:underline" onClick={() => setStart(`item:${i.id}`)}>{i.name} ({qty(i.stockQty, i.unit)})</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Usage period history</h2>
          <p className="text-xs text-muted-foreground">Actual use = stock at the start + purchases − what was left at the end. Expected comes from the feeding rule or earlier periods.</p>
        </header>
        {closedPeriods.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No data</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>{["Feed", "Period", "Days", "Used", "Per day", "Expected", "Variance", "Cost", "Status", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedPeriods.flatMap((p) => p.lines.map((l) => {
                  const r = lineOf(p.id, l.itemId);
                  return (
                    <tr key={p.id + l.itemId}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{l.itemName}{p.targetType === "recipe" && <span className="text-muted-foreground"> · {p.targetName}</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.startDate} → {p.endDate}</td>
                      <td className="px-3 py-2">{r?.days}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(l.consumedQty, l.unit)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(r?.dailyQty, l.unit)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(r?.expectedQty, l.unit)}</td>
                      <td className={cn("px-3 py-2 whitespace-nowrap", (r?.varianceQty ?? 0) > 0 ? "text-rose-600" : "text-emerald-700")}>
                        {r?.varianceQty == null ? "—" : `${r.varianceQty > 0 ? "+" : ""}${qty(r.varianceQty, l.unit)} (${r.variancePct?.toFixed(0)}%)`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.costMissing ? "unknown" : taka(l.consumedValue)}</td>
                      <td className="px-3 py-2"><Badge kind={r?.status === "unreconciled" ? "unreconciled" : "actual"} /></td>
                      <td className="px-3 py-2">{data.canEdit && l === p.lines[0] && <button className="text-primary" title="Correct end date or count" onClick={() => setEnding(p)}><Pencil className="h-3.5 w-3.5" /></button>}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Variance is shown, not explained: it can be wastage, a counting difference or a change in feeding — check before drawing conclusions.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Per cattle */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Feed cost per animal</h2>
            <p className="text-xs text-muted-foreground">Split by live weight, only for the days each animal was on the farm.</p>
          </header>
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Animal", "Actual", "Running (est.)", "Measured gain", "Actual cost / kg gain"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.cattle.length === 0 ? <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>No data</td></tr> : data.cattle.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.tag}</td>
                  <td className="px-3 py-2">{taka(c.actual)}</td>
                  <td className="px-3 py-2 text-amber-700 dark:text-amber-400">{c.estimated ? taka(c.estimated) : "—"}</td>
                  <td className="px-3 py-2">{c.gainKg == null ? "needs 2 weighings" : `${c.gainKg.toFixed(1)} kg`}</td>
                  <td className="px-3 py-2">{c.costPerKgGain == null ? "—" : `৳${c.costPerKgGain.toFixed(0)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totals.unallocated > 0.5 && <p className="px-4 py-2 text-[11px] text-muted-foreground">{taka(data.totals.unallocated)} was used on days with no animal recorded on the farm (not assigned to any animal).</p>}
        </section>

        {/* By month and by feed */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Feed cost by month and by feed</h2></header>
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Month", "Actual", "Running (est.)"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.byMonth.length === 0 ? <tr><td className="px-3 py-3 text-muted-foreground" colSpan={3}>No data</td></tr> : data.byMonth.map(([m, v]) => (
                <tr key={m}><td className="px-3 py-2">{m}</td><td className="px-3 py-2">{taka(v.actual)}</td><td className="px-3 py-2 text-amber-700 dark:text-amber-400">{v.estimated ? taka(v.estimated) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs border-t border-border">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Feed", "Actual used", "Actual cost", "Running (est.)"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.byItem.map((i) => (
                <tr key={i.id}><td className="px-3 py-2">{i.name}</td><td className="px-3 py-2">{qty(i.actualQty, i.unit)}</td><td className="px-3 py-2">{taka(i.actualValue)}</td><td className="px-3 py-2 text-amber-700 dark:text-amber-400">{i.estimatedValue ? taka(i.estimatedValue) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {start !== null && <StartDialog data={data} preset={start} onClose={() => setStart(null)} />}
      {ending && <EndDialog data={data} period={ending} onClose={() => setEnding(null)} />}
      {checking && <EndDialog data={data} period={checking} checkpoint onClose={() => setChecking(null)} />}
      {ruleOf && <RuleDialog data={data} period={ruleOf} onClose={() => setRuleOf(null)} />}
    </div>
  );
}

function ruleText(p: Period): string {
  if (p.ruleType === "pct_live_weight") return `${p.ruleValue}% of live weight per day`;
  if (p.ruleType === "per_head") return `${p.ruleValue} per head per day`;
  if (p.ruleType === "chart") return "by feeding chart";
  return "learned from what gets used";
}

function Stat({ label, value, sub, tag }: { label: string; value: string; sub: string; tag?: "actual" | "estimated" | "unreconciled" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p>{tag && <Badge kind={tag} />}</div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function CancelButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={pending} onClick={() => {
      const reason = prompt("Why cancel this period? (kept in the history)");
      if (!reason) return;
      start(async () => {
        const r = await cancelFeedUsage(periodId, reason);
        if (r.error) toast.error(r.error); else { toast.success("Period cancelled"); router.refresh(); }
      });
    }}>Cancel</Button>
  );
}

// ── dialogs (also used by the inventory page, in Bangla or English) ─────────
const DLG = {
  en: {
    start_title: "Start using a feed", target: "Feed or recipe *", choose: "Choose…", nothing_new: "— nothing new —",
    feeds: "Feeds", recipes: "Recipes (ingredients fed together)", started_on: "Started feeding on *", past_ok: "Past dates are fine.",
    rule_label: "How much is fed each day?", r_chart: "By the feeding chart (each animal's weight)", r_chart_none: "Feeding chart — not set for this feed yet",
    r_learn: "I don't know exactly — learn it from what gets used", r_pct: "A % of each animal's live weight per day", r_head: "A fixed amount per animal per day",
    pct_ph: "e.g. 1.5 (%)", head_ph: "e.g. 2 (kg or pieces per animal)",
    rule_note: "This amount comes off the stock every day automatically. When you count, the difference is adjusted.",
    learn_note: "Until it has been used up once, nothing can be deducted daily; the count settles it.",
    set_chart: "Set a feeding chart", cancel: "Cancel", start: "Start", started: "Feed started — it comes off the stock every day",
    end_title: "Finished", correct_title: "Correct", mode_finish: "Finished — no longer fed", mode_check: "Count check — keep feeding it",
    last_day: "Last day it was fed *", count_day: "Counted on *", left: "What is left now? (0 if finished)",
    expected: "By the daily deduction ≈ {qty} should be left", more_used: "{qty} more was used — it will be deducted",
    less_used: "{qty} less was used — it goes back to stock", matches: "Matches the daily deduction",
    used_note: "Actual use = stock at the start + purchases − what is left. The daily deduction is corrected to exactly this.",
    reason: "Reason for the correction *", reason_ph: "e.g. recounted the store",
    next: "Start the next feed right away? (optional)", next_note: "The next feed follows its feeding chart if it has one; you can change it later.",
    save_end: "End", save_check: "Save count", save_correct: "Save correction",
    ended: "Ended — actual use calculated and adjusted", checked: "Counted — difference adjusted, still in use",
    unrec: "Saved — but the count is higher than the recorded stock (a purchase may be missing)",
    rule_title: "How it is fed · {name}", save: "Save", rule_saved: "Saved — applies from today",
    rule_note2: "Days already deducted stay as they are; the count settles any difference.",
  },
  bn: {
    start_title: "খাবার চালু করুন", target: "খাবার বা রেসিপি *", choose: "বাছাই করুন…", nothing_new: "— নতুন কিছু না —",
    feeds: "খাবার", recipes: "রেসিপি (একসাথে মেশানো)", started_on: "কবে থেকে খাওয়ানো শুরু *", past_ok: "আগের তারিখ দিলেও চলবে।",
    rule_label: "প্রতিদিন কতটা খাওয়ানো হয়?", r_chart: "খাবারের চার্ট অনুযায়ী (প্রতিটি গরুর ওজন দেখে)", r_chart_none: "খাবারের চার্ট — এই খাবারের চার্ট এখনো নেই",
    r_learn: "ঠিক জানি না — যা খরচ হয় তা থেকে শিখে নিক", r_pct: "প্রতিদিন ওজনের কত %", r_head: "প্রতি গরু প্রতিদিন নির্দিষ্ট পরিমাণ",
    pct_ph: "যেমন 1.5 (%)", head_ph: "যেমন 2 (প্রতি গরু kg বা পিস)",
    rule_note: "এই পরিমাণ প্রতিদিন নিজে থেকে স্টক থেকে কাটা হবে। গুনে দিলে পার্থক্যটা মিলিয়ে নেওয়া হবে।",
    learn_note: "একবার শেষ না হওয়া পর্যন্ত প্রতিদিন কাটার হিসাব থাকে না; গোনার সময় মিলে যাবে।",
    set_chart: "খাবারের চার্ট দিন", cancel: "বাতিল", start: "চালু করুন", started: "খাবার চালু হলো — প্রতিদিন নিজে স্টক থেকে কাটা হবে",
    end_title: "শেষ হয়েছে", correct_title: "ঠিক করুন", mode_finish: "শেষ — আর খাওয়ানো হচ্ছে না", mode_check: "শুধু গুনে মেলাই — চালু থাকবে",
    last_day: "শেষ কবে খাওয়ানো হয়েছে *", count_day: "কবে গুনলেন *", left: "এখন কতটা বাকি আছে? (শেষ হলে 0)",
    expected: "প্রতিদিনের হিসাবে বাকি থাকার কথা ≈ {qty}", more_used: "{qty} বেশি খাওয়া হয়েছে — এটা আরও কাটা হবে",
    less_used: "{qty} কম খাওয়া হয়েছে — এটা স্টকে ফেরত যাবে", matches: "প্রতিদিনের হিসাবের সাথে মিলে গেছে",
    used_note: "আসল খরচ = শুরুর স্টক + কেনা − যা বাকি। প্রতিদিনের কাটা ঠিক এই হিসাবে মিলিয়ে নেওয়া হবে।",
    reason: "ঠিক করার কারণ *", reason_ph: "যেমন আবার গুনেছি",
    next: "সাথে সাথে পরের খাবার চালু করবেন? (ঐচ্ছিক)", next_note: "পরের খাবারের চার্ট থাকলে চার্ট অনুযায়ী কাটা হবে; পরে বদলানো যাবে।",
    save_end: "শেষ করুন", save_check: "গোনা সেভ করুন", save_correct: "সংশোধন সেভ করুন",
    ended: "শেষ হলো — আসল খরচ হিসাব করে মিলিয়ে নেওয়া হলো", checked: "গোনা হলো — পার্থক্য মিলানো হলো, খাবার চালু আছে",
    unrec: "সেভ হলো — কিন্তু গোনা স্টক রেকর্ডের চেয়ে বেশি (কোনো কেনা এন্ট্রি বাকি থাকতে পারে)",
    rule_title: "কীভাবে খাওয়ানো হয় · {name}", save: "সেভ", rule_saved: "সেভ হলো — আজ থেকে প্রযোজ্য",
    rule_note2: "আগের দিনের কাটা যেমন আছে থাকবে; গোনার সময় পার্থক্য মিলে যাবে।",
  },
} as const;
export type DialogLocale = keyof typeof DLG;
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** What the start / finish dialogs need (also used by the inventory page). */
export type UsageDialogData = Pick<UsagePageData, "asOf" | "items" | "recipes"> & {
  /** targets that have a feeding chart: "item:<id>" / "recipe:<id>" */
  chartTargets?: string[];
};

function RuleFields({ prefix = "", hasChart, initial, initialValue, lang = "en" }: {
  prefix?: string; hasChart: boolean; initial?: string; initialValue?: number | null; lang?: DialogLocale;
}) {
  const t = DLG[lang];
  // default follows the chosen feed (chart when it has one) until the user picks a rule
  const [picked, setType] = useState<string | null>(initial ?? null);
  const type = picked === "chart" && !hasChart ? "weight_share" : picked ?? (hasChart ? "chart" : "weight_share");
  return (
    <div className="space-y-1.5">
      <Label>{t.rule_label}</Label>
      <select name={`${prefix}rule_type`} value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="chart" disabled={!hasChart}>{hasChart ? t.r_chart : t.r_chart_none}</option>
        <option value="weight_share">{t.r_learn}</option>
        <option value="pct_live_weight">{t.r_pct}</option>
        <option value="per_head">{t.r_head}</option>
      </select>
      {(type === "pct_live_weight" || type === "per_head") && (
        <Input name={`${prefix}rule_value`} type="number" min="0.001" step="0.001" required defaultValue={initialValue ?? undefined}
          placeholder={type === "pct_live_weight" ? t.pct_ph : t.head_ph} />
      )}
      <p className="text-[11px] text-muted-foreground">{type === "weight_share" ? t.learn_note : t.rule_note}</p>
      {!hasChart && (
        <Link href="/dashboard/inventory/feeding-chart" className="inline-block text-[11px] font-medium text-primary hover:underline">{t.set_chart} →</Link>
      )}
    </div>
  );
}

function TargetSelect({ data, name, value, onChange, allowEmpty, lang = "en" }: {
  data: UsageDialogData; name: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean; lang?: DialogLocale;
}) {
  const t = DLG[lang];
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} required={!allowEmpty} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
      <option value="">{allowEmpty ? t.nothing_new : t.choose}</option>
      <optgroup label={t.feeds}>
        {data.items.filter((i) => !i.openPeriodId).map((i) => <option key={i.id} value={`item:${i.id}`}>{i.name} ({i.unit})</option>)}
      </optgroup>
      {data.recipes.length > 0 && (
        <optgroup label={t.recipes}>
          {data.recipes.map((r) => <option key={r.id} value={`recipe:${r.id}`}>{r.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}

export function StartDialog({ data, preset, onClose, lang = "en" }: { data: UsageDialogData; preset: string; onClose: () => void; lang?: DialogLocale }) {
  const t = DLG[lang];
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [target, setTarget] = useState(preset);
  const [state, action, pending] = useActionState<UsageFormState, FormData>(startFeedUsage, undefined);
  useEffect(() => { if (state?.success) { toast.success(t.started); onClose(); router.refresh(); } }, [state?.success, onClose, router, t.started]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t.start_title}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="key" value={key} />
          <div className="space-y-1.5"><Label>{t.target}</Label><TargetSelect data={data} name="target" value={target} onChange={setTarget} lang={lang} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="us_start">{t.started_on}</Label>
            <Input id="us_start" name="start_date" type="date" max={data.asOf} defaultValue={data.asOf} required />
            <p className="text-[11px] text-muted-foreground">{t.past_ok}</p>
          </div>
          <RuleFields hasChart={!!target && (data.chartTargets ?? []).includes(target)} lang={lang} />
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.start}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DAY_MS = 86400000;
const fmtQty = (n: number, unit: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}`;

export function EndDialog({ data, period, onClose, lang = "en", checkpoint = false }: {
  data: UsageDialogData; period: Period; onClose: () => void; lang?: DialogLocale; checkpoint?: boolean;
}) {
  const t = DLG[lang];
  const router = useRouter();
  const correcting = period.status !== "open";
  const [mode, setMode] = useState<"finish" | "checkpoint">(checkpoint ? "checkpoint" : "finish");
  const [endDate, setEndDate] = useState(period.endDate ?? data.asOf);
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(period.lines.map((l) => [l.itemId, correcting ? String(l.closingQty ?? 0) : ""])));
  const [next, setNext] = useState("");
  const [state, action, pending] = useActionState<UsageFormState, FormData>(endFeedUsage, undefined);
  useEffect(() => {
    if (state?.success) {
      toast.success(state.status === "unreconciled" ? t.unrec : state.status === "checkpoint" ? t.checked : t.ended);
      onClose(); router.refresh();
    }
  }, [state?.success, state?.status, onClose, router, t]);

  // what the daily deduction says should be left on the chosen date (open periods only)
  const daysAfter = Math.max(0, Math.round((Date.parse(`${data.asOf}T00:00:00Z`) - Date.parse(`${endDate}T00:00:00Z`)) / DAY_MS));
  const expectedFor = (itemId: string): number | null => {
    if (correcting) return null;
    const it = data.items.find((i) => i.id === itemId);
    if (!it || it.openPeriodId !== period.id) return null;
    return Math.max(0, it.expectedLeft + (it.dailyQty ?? 0) * daysAfter);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{correcting ? t.correct_title : mode === "checkpoint" ? t.mode_check : t.end_title} · {period.targetName}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="period_id" value={period.id} />
          <input type="hidden" name="mode" value={correcting ? "finish" : mode} />
          {!correcting && (
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
              {(["finish", "checkpoint"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={cn("rounded-md px-2 py-1.5 text-center transition-colors", mode === m ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {m === "finish" ? t.mode_finish : t.mode_check}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ue_end">{mode === "checkpoint" && !correcting ? t.count_day : t.last_day}</Label>
            <Input id="ue_end" name="end_date" type="date" min={period.startDate} max={data.asOf} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t.left}</Label>
            {period.lines.map((l) => {
              const exp = expectedFor(l.itemId);
              const typed = counts[l.itemId];
              const c = typed === "" || typed == null ? null : Number(typed);
              const diff = exp != null && c != null && Number.isFinite(c) ? exp - c : null;   // + = more used than deducted
              return (
                <div key={l.itemId} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{l.itemName}</span>
                    <Input name={`closing:${l.itemId}`} type="number" min="0" step="0.01" required className="w-28 text-right"
                      value={typed ?? ""} onChange={(e) => setCounts((s) => ({ ...s, [l.itemId]: e.target.value }))} />
                    <span className="w-12 text-xs text-muted-foreground">{l.unit}</span>
                  </div>
                  {exp != null && <p className="text-[11px] text-muted-foreground">{fill(t.expected, { qty: fmtQty(exp, l.unit) })}</p>}
                  {diff != null && (
                    <p className={cn("text-[11px] font-medium", Math.abs(diff) < 0.005 ? "text-emerald-700 dark:text-emerald-400" : diff > 0 ? "text-rose-600 dark:text-rose-400" : "text-sky-700 dark:text-sky-400")}>
                      {Math.abs(diff) < 0.005 ? t.matches : fill(diff > 0 ? t.more_used : t.less_used, { qty: fmtQty(Math.abs(diff), l.unit) })}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">{t.used_note}</p>
          </div>
          {correcting ? (
            <div className="space-y-1.5"><Label htmlFor="ue_reason">{t.reason}</Label><Input id="ue_reason" name="reason" required placeholder={t.reason_ph} /></div>
          ) : mode === "finish" && (
            <div className="space-y-1.5 rounded-lg border border-border p-2.5">
              <Label>{t.next}</Label>
              <TargetSelect data={data} name="next_target" value={next} onChange={setNext} allowEmpty lang={lang} />
              <input type="hidden" name="next_rule_type" value={next && (data.chartTargets ?? []).includes(next) ? "chart" : "weight_share"} />
              <Input name="next_start_date" type="date" max={data.asOf} defaultValue={data.asOf} />
              <p className="text-[11px] text-muted-foreground">{t.next_note}</p>
            </div>
          )}
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{correcting ? t.save_correct : mode === "checkpoint" ? t.save_check : t.save_end}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Change how a running period is fed. */
export function RuleDialog({ data, period, onClose, lang = "en" }: { data: UsageDialogData; period: Period; onClose: () => void; lang?: DialogLocale }) {
  const t = DLG[lang];
  const router = useRouter();
  const [state, action, pending] = useActionState<UsageFormState, FormData>(setFeedUsageRule, undefined);
  useEffect(() => { if (state?.success) { toast.success(t.rule_saved); onClose(); router.refresh(); } }, [state?.success, onClose, router, t.rule_saved]);
  const target = `${period.targetType}:${period.targetId ?? ""}`;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{fill(t.rule_title, { name: period.targetName })}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="period_id" value={period.id} />
          <RuleFields hasChart={(data.chartTargets ?? []).includes(target)} initial={period.ruleType} initialValue={period.ruleValue} lang={lang} />
          <p className="text-[11px] text-muted-foreground">{t.rule_note2}</p>
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
