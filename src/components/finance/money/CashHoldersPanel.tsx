"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight, ArrowRightLeft, Check, CheckCircle2, CircleHelp, Clock, History, Loader2, Pencil, Plus, Printer, Split, Trash2, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { useTranslation } from "@/i18n/I18nProvider";
import { fmtDay } from "@/lib/format";
import { todayDhaka } from "@/lib/dates";
import { CASH_CATEGORY_LABEL } from "@/lib/accounting/cash-ledger";
import { HOLDER_KIND_LABEL, OPENING_KEY, type HolderKind, type HolderLine } from "@/lib/accounting/cash-holders";
import {
  addPartnersAsHolders, answerHandover, archiveCashHolder, assignCashRows, deleteHandover, getLoginOptions,
  recordHandover, saveCashHolder, saveHolderCount, splitCashRow,
} from "@/app/dashboard/(app)/finance/cash-holder-actions";
import { deleteCashCount } from "@/app/dashboard/(app)/finance/cash-count-actions";
import type { HolderView } from "@/lib/money/holder-view";
import { HOLDER_ICON, forgetHolderOptions } from "./CashHolderPicker";
import { signed, taka } from "./MoneyToday";

type View = Extract<HolderView, { enabled: true }>;
type Holder = View["holders"][number];

const field = "h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-60";
const primary = cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90");
const ghost = cn(btn, "border border-input bg-background hover:bg-muted");
const card = "rounded-xl border border-border bg-card shadow-card";
const money = (n: number) => (n < -0.004 ? "−" : "") + taka(n);
// one colour rule everywhere: below zero red, a gap amber, a match green
const tone = { bad: "text-red-600 dark:text-red-400", warn: "text-amber-700 dark:text-amber-400", good: "text-emerald-700 dark:text-emerald-400" };

function useLineLabel() {
  const L = useL();
  return (l: HolderLine) =>
    l.key === "carried" ? L("আগের জের", "Brought forward")
    : l.category === "Opening" ? L("শুরুর নগদ (খামার চালুর সময় যা ছিল)", "Opening cash (what there was at the start)")
    : l.category === "Handover" ? L("হাতবদল", "Handover")
    : L(CASH_CATEGORY_LABEL[l.category].bn, CASH_CATEGORY_LABEL[l.category].en);
}

/** the kinds of rows, for filtering the "not yet said" list */
const GROUPS = {
  sale: ["Cattle Sale", "Asset Sale"],
  buy: ["Cattle Purchase", "Asset Purchase"],
  cost: ["Operating Cost", "Vet Fee"],
  stock: ["Inventory", "Supplier Due"],
  partner: ["Capital In", "Capital Out", "Profit Advance", "Partner Loan"],
  loan: ["Loan Received", "Loan Repayment"],
  opening: ["Opening"],
} as const;
type Group = keyof typeof GROUPS;
const groupOf = (l: HolderLine): Group => (Object.keys(GROUPS) as Group[]).find((g) => (GROUPS[g] as readonly string[]).includes(l.category)) ?? "cost";

/**
 * The "who has the cash" tab: each holder's balance (tap one to open their statement), handovers
 * waiting for the receiver, the rows nobody has been named for yet (filter, tick and give them to
 * someone in one go, or split one), counting a holder's cash, and every change with who made it.
 * Σ holders + not yet said = the farm's cash, the same figure as everywhere else.
 */
export function CashHoldersPanel({ v }: { v: View }) {
  const L = useL();
  const active = v.holders.filter((h) => !h.archived);
  const [open, setOpen] = useState<"handover" | "holder" | null>(null);
  const [sel, setSel] = useState<string>(v.me && v.holders.some((h) => h.id === v.me) ? v.me : v.holders[0]?.id ?? "");
  const selected = v.holders.find((h) => h.id === sel) ?? v.holders[0];

  if (v.holders.length === 0) return <SetupCard partners={v.partners} />;

  return (
    <div className="space-y-4">
      <section className={card} aria-label={L("কার কাছে কত টাকা", "Who has how much")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold">{L("কার কাছে কত টাকা — আজ পর্যন্ত", "Who has how much — up to today")}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{L(`সব মিলিয়ে খামারের নগদ ${money(v.total)}`, `Farm cash in all ${money(v.total)}`)}</span>
        </div>
        <ul className="grid grid-cols-1 gap-px overflow-hidden bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
          {v.holders.map((h) => <HolderTile key={h.id} h={h} me={v.me === h.id} active={selected?.id === h.id} onPick={() => setSel(h.id)} />)}
          {v.unassigned.length > 0 ? (
            <li className="bg-amber-500/5">
              <a href="#unassigned" className="block h-full px-5 py-4 hover:bg-amber-500/10">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><CircleHelp className="h-3.5 w-3.5" aria-hidden />{L("কার কাছে — বলা হয়নি", "Not yet said whose")}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{money(v.unassignedBalance)}</p>
                <p className="mt-0.5 text-[11px] font-medium text-primary">{L(`${v.unassigned.length}টি লেনদেনে নাম নেই — ঠিক করুন ↓`, `${v.unassigned.length} entries without a holder — set them ↓`)}</p>
              </a>
            </li>
          ) : (
            <li className={cn("flex items-center gap-2 bg-card px-5 py-4 text-sm", tone.good)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />{L("সব লেনদেনে কার টাকা বলা আছে", "Every entry has a holder")}
            </li>
          )}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-3">
          <button type="button" onClick={() => setOpen(open === "handover" ? null : "handover")} disabled={active.length < 2} className={primary}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden />{L("হাতবদল লিখুন", "Record a handover")}
          </button>
          <button type="button" onClick={() => setOpen(open === "holder" ? null : "holder")} className={ghost}>
            <Plus className="h-4 w-4" aria-hidden />{L("নতুন জন / ব্যাংক", "Add a person / bank")}
          </button>
        </div>
        {open === "handover" && <HandoverForm holders={active} me={v.me} onDone={() => setOpen(null)} />}
        {open === "holder" && <HolderForm partners={v.partners} onDone={() => setOpen(null)} />}
      </section>

      {v.pending.length > 0 && <Pending list={v.pending} />}
      {selected && <HolderDetail key={selected.id} h={selected} active={active} partners={v.partners} />}
      <Unassigned lines={v.unassigned} holders={active} />
      {v.handovers.length > 0 && <Handovers list={v.handovers} />}
      {v.log.length > 0 && <ChangeLog log={v.log} holders={v.holders} />}
    </div>
  );
}

// ── the holder cards ────────────────────────────────────────────────────────

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const min = Math.min(0, ...points), max = Math.max(...points), span = max - min || 1;
  const w = 100, h = 24;
  const y = (p: number) => (h - ((p - min) / span) * h).toFixed(1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * w).toFixed(1)},${y(p)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-6 w-full", className)} aria-hidden>
      {min < 0 && <line x1="0" x2={w} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="0.6" />}
      <path d={d} fill="none" className="stroke-current" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function HolderTile({ h, me, active, onPick }: { h: Holder; me: boolean; active: boolean; onPick: () => void }) {
  const L = useL();
  const { locale } = useTranslation();
  const Icon = HOLDER_ICON[h.kind];
  const month = h.trend.length ? h.balance - h.trend[0] : 0;
  const c = h.counts[0];
  const countNote = !c ? (h.kind === "person" ? L("কখনো গোনা হয়নি", "never counted") : null)
    : Math.abs(c.gap) < 1 ? L(`${fmtDay(c.date, locale)} গুনে মিলেছে`, `counted ${fmtDay(c.date, locale)}: matches`)
    : L(`${fmtDay(c.date, locale)} গুনে ${taka(c.gap)} ${c.gap < 0 ? "কম" : "বেশি"}`, `counted ${fmtDay(c.date, locale)}: ${taka(c.gap)} ${c.gap < 0 ? "short" : "over"}`);
  return (
    <li className="bg-card">
      <button type="button" onClick={onPick} aria-pressed={active}
        className={cn("block h-full w-full px-5 py-4 text-left transition-colors hover:bg-muted/40", active && "bg-primary/5 ring-2 ring-inset ring-primary/40")}>
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden /><span className="truncate">{h.name}</span>
          {me && <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{L("আপনি", "you")}</span>}
          <span className="ml-auto shrink-0 opacity-70">{L(HOLDER_KIND_LABEL[h.kind].bn, HOLDER_KIND_LABEL[h.kind].en)}</span>
        </p>
        <div className="mt-1 flex items-end gap-3">
          <p className={cn("text-2xl font-bold tabular-nums tracking-tight", h.balance < -0.5 && tone.bad)}>{money(h.balance)}</p>
          <Sparkline points={h.trend} className={cn("mb-1 flex-1", h.balance < -0.5 ? tone.bad : "text-primary/70")} />
        </div>
        <p className={cn("mt-0.5 text-[11px] leading-snug", h.balance < -0.5 ? cn("font-medium", tone.bad) : "text-muted-foreground")}>
          {h.balance < -0.5
            ? L("মাইনাস — এঁকে দেওয়া হাতবদল বা এঁর পাওয়া টাকা লেখা বাকি", "Below zero — a handover to them or money they got is not entered")
            : L(`৩০ দিনে ${signed(month)}${h.lastDate ? ` · শেষ লেনদেন ${fmtDay(h.lastDate, locale)}` : ""}`, `30 days ${signed(month)}${h.lastDate ? ` · last ${fmtDay(h.lastDate, locale)}` : ""}`)}
        </p>
        {countNote && <p className={cn("mt-0.5 text-[11px] font-medium", !c ? "text-muted-foreground" : Math.abs(c.gap) < 1 ? tone.good : tone.warn)}>{countNote}</p>}
      </button>
    </li>
  );
}

// ── first use ───────────────────────────────────────────────────────────────

function SetupCard({ partners }: { partners: View["partners"] }) {
  const L = useL();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(partners.length === 0);
  const quick = () => start(async () => {
    const r = await addPartnersAsHolders();
    if (!r.ok) { toast.error(r.error); return; }
    forgetHolderOptions();
    toast.success(L(`${r.added} জন যোগ হলো`, `${r.added} added`));
    router.refresh();
  });
  const steps = [
    { n: "১", t: L("কে কে টাকা রাখেন — যোগ করুন", "Add who keeps the money"), s: L("তানভীর, মহিউদ্দিন, ব্যাংক, বিকাশ…", "Tanvir, Mohiuddin, the bank, bKash…") },
    { n: "২", t: L("লেনদেনে এক চাপে নাম", "One tap on every entry"), s: L("গরু বিক্রি → টাকা মহিউদ্দিনের কাছে এলো", "Cattle sold → the money came to Mohiuddin") },
    { n: "৩", t: L("কেউ কাউকে দিলে — হাতবদল", "Money passed on — a handover"), s: L("মহিউদ্দিন → তানভীর ৳৩০,০০০", "Mohiuddin → Tanvir ৳30,000") },
  ];
  return (
    <section className={cn(card, "p-5")}>
      <h3 className="flex items-center gap-1.5 text-base font-semibold"><Users className="h-4 w-4 text-muted-foreground" aria-hidden />{L("খামারের টাকা কার কাছে থাকে?", "Who keeps the farm's money?")}</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{L("তিন ধাপে চালু হবে — তারপর সবসময় দেখা যাবে কার কাছে কত আছে, আর গুনে মেলানো যাবে।", "Three steps — then you always see who holds how much, and can count to check.")}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{s.n}</span>
            <p className="mt-2 text-sm font-medium">{s.t}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.s}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {partners.length > 0 && (
          <button type="button" onClick={quick} disabled={pending} className={primary}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}{L(`অংশীদারদের (${partners.map((p) => p.name).join(", ")}) যোগ করুন`, `Add the partners (${partners.map((p) => p.name).join(", ")})`)}
          </button>
        )}
        {!form && <button type="button" onClick={() => setForm(true)} className={ghost}><Plus className="h-4 w-4" aria-hidden />{L("নিজে নাম দিন", "Add by name")}</button>}
      </div>
      {form && <div className="-mx-5 -mb-5 mt-4"><HolderForm partners={partners} onDone={() => setForm(false)} /></div>}
    </section>
  );
}

// ── add / edit a holder ─────────────────────────────────────────────────────

function HolderForm({ partners, holder, onDone }: { partners: View["partners"]; holder?: Holder; onDone: () => void }) {
  const L = useL();
  const router = useRouter();
  const [name, setName] = useState(holder?.name ?? "");
  const [kind, setKind] = useState<HolderKind>(holder?.kind ?? "person");
  const [partnerId, setPartnerId] = useState(holder?.partnerId ?? "");
  const [userId, setUserId] = useState(holder?.userId ?? "");
  const [logins, setLogins] = useState<{ id: string; name: string }[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => { let live = true; getLoginOptions().then((l) => { if (live) setLogins(l); }); return () => { live = false; }; }, []);
  const save = () => start(async () => {
    const r = await saveCashHolder({ id: holder?.id, name, kind, partnerId: partnerId || null, userId: userId || null });
    if (!r.ok) { toast.error(r.error); return; }
    forgetHolderOptions();
    toast.success(L("সেভ হলো", "Saved"));
    onDone();
    router.refresh();
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-3 border-t border-border/60 bg-muted/30 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("নাম", "Name")}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder={L("যেমন তানভীর / ডাচ-বাংলা ব্যাংক / বিকাশ", "e.g. Tanvir / Dutch-Bangla Bank / bKash")} className={field} />
      </label>
      <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("কোথায়", "Kind")}
        <select value={kind} onChange={(e) => setKind(e.target.value as HolderKind)} className={field}>
          {(Object.keys(HOLDER_KIND_LABEL) as HolderKind[]).map((k) => <option key={k} value={k}>{L(HOLDER_KIND_LABEL[k].bn, HOLDER_KIND_LABEL[k].en)}</option>)}
        </select>
      </label>
      {kind === "person" && (
        <>
          <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("অংশীদার? (ঐচ্ছিক)", "A partner? (optional)")}
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={field}>
              <option value="">{L("না", "No")}</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("এঁর লগইন (ঐচ্ছিক)", "Their login (optional)")}
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
              <option value="">{L("নেই", "None")}</option>
              {logins.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        </>
      )}
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending || !name.trim()} className={primary}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{L("সেভ", "Save")}</button>
        <button type="button" onClick={onDone} className={cn(btn, "text-muted-foreground hover:text-foreground")}>{L("বাতিল", "Cancel")}</button>
      </div>
      {kind === "person" && <p className="text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-5">{L("লগইন জুড়ে দিলে: উনি কিছু লিখলে নিজে থেকেই ওঁর নাম বাছা থাকবে, আর ওঁকে দেওয়া হাতবদল উনি নিশ্চিত না করা পর্যন্ত অপেক্ষায় থাকবে।", "With a login: their own name is chosen when they record something, and money handed to them waits until they confirm it.")}</p>}
    </form>
  );
}

// ── handover ────────────────────────────────────────────────────────────────

function HandoverForm({ holders, me, onDone }: { holders: Holder[]; me: string | null; onDone: () => void }) {
  const L = useL();
  const router = useRouter();
  const today = todayDhaka();
  const [from, setFrom] = useState(me && holders.some((h) => h.id === me) ? me : holders[0]?.id ?? "");
  const [to, setTo] = useState(holders.find((h) => h.id !== from)?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const giver = holders.find((h) => h.id === from);
  const taker = holders.find((h) => h.id === to);
  const n = Number(amount) || 0;
  const waits = !!taker?.userId && taker.id !== me;
  const save = () => start(async () => {
    const r = await recordHandover({ date, fromId: from, toId: to, amount: n, note });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.pending ? L(`লেখা হলো — ${taker?.name} নিশ্চিত করলে হিসাবে যাবে`, `Recorded — it counts once ${taker?.name} confirms`) : L("হাতবদল লেখা হলো", "Handover recorded"));
    onDone();
    router.refresh();
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3 border-t border-border/60 bg-muted/30 px-5 py-4">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("কে দিলেন", "From")}
          <select value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(holders.find((h) => h.id !== e.target.value)?.id ?? ""); }} className={field}>
            {holders.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-muted-foreground sm:mb-2.5 sm:block" aria-hidden />
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("কাকে দিলেন / কোথায় রাখলেন", "To")}
          <select value={to} onChange={(e) => setTo(e.target.value)} className={field}>
            {holders.filter((h) => h.id !== from).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr]">
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("টাকা (৳)", "Amount (৳)")}
          <input type="number" inputMode="decimal" min={1} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required className={cn(field, "text-base font-semibold tabular-nums")} />
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("তারিখ", "Date")}
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required className={field} />
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{L("নোট (ঐচ্ছিক)", "Note (optional)")}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={L("যেমন ব্যাংকে জমা, খাবার কেনার জন্য দিলাম", "e.g. deposited in the bank, for buying feed")} className={field} />
        </label>
      </div>

      {/* what it does, before saving */}
      {giver && taker && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <Preview name={giver.name} before={giver.balance} after={giver.balance - n} />
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Preview name={taker.name} before={taker.balance} after={taker.balance + n} />
        </div>
      )}
      {giver && n > 0 && n > giver.balance + 0.5 && (
        <p className={cn("text-xs", tone.warn)}>
          {L(`হিসাবে ${giver.name}-এর কাছে ${money(giver.balance)} — বেশি দিলে তাঁর ঘর মাইনাস হবে। আগে "কার টাকা বলা হয়নি" ঠিক করুন, নয়তো কোনো আয় লেখা বাকি।`,
             `The books show ${money(giver.balance)} with ${giver.name} — giving more puts them below zero. Set the "not yet said" entries first, or some money in was not entered.`)}
        </p>
      )}
      {waits && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden />{L(`${taker?.name} নিজের লগইন থেকে "পেয়েছি" চাপলে তবেই হিসাবে যাবে।`, `It counts once ${taker?.name} taps "received" from their own login.`)}</p>}
      <button type="submit" disabled={pending || !from || !to || from === to || !(n > 0)} className={primary}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}{L("হাতবদল লিখুন", "Record the handover")}
      </button>
    </form>
  );
}

function Preview({ name, before, after }: { name: string; before: number; after: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{name}</p>
      <p className="tabular-nums"><span className="text-muted-foreground">{money(before)}</span> → <b className={cn(after < -0.5 && tone.bad)}>{money(after)}</b></p>
    </div>
  );
}

// ── waiting handovers ───────────────────────────────────────────────────────

function Pending({ list }: { list: View["pending"] }) {
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    const r = await fn();
    if (!r.ok) { toast.error(r.error ?? ""); return; }
    toast.success(ok);
    router.refresh();
  });
  return (
    <section id="pending" className={cn(card, "scroll-mt-20 border-amber-500/40")}>
      <h3 className="flex items-center gap-1.5 border-b border-border/60 px-5 py-3 text-sm font-semibold"><Clock className="h-4 w-4 text-amber-600" aria-hidden />{L("নিশ্চিত হওয়ার অপেক্ষায়", "Waiting to be confirmed")}</h3>
      <ul className="divide-y divide-border/60 text-sm">
        {list.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
            <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDay(p.date, locale)}</span>
            <span className="min-w-0 flex-1">{p.from} → {p.to} <b className="tabular-nums">{taka(p.amount)}</b>{p.note && <span className="text-muted-foreground"> · {p.note}</span>}</span>
            {p.canAnswer ? (
              <span className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => act(() => answerHandover(p.id, true), L("নিশ্চিত হলো", "Confirmed"))} className={cn(primary, "h-9")}><Check className="h-4 w-4" aria-hidden />{L("পেয়েছি", "Received")}</button>
                <button type="button" disabled={busy} onClick={() => act(() => answerHandover(p.id, false), L("জানানো হলো — পাননি", "Marked as not received"))} className={cn(ghost, "h-9")}><X className="h-4 w-4" aria-hidden />{L("পাইনি", "Not received")}</button>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {L(`${p.to}-এর নিশ্চিত করা বাকি`, `waiting for ${p.to}`)}
                <button type="button" disabled={busy} onClick={() => act(() => deleteHandover(p.id), L("বাতিল হলো", "Cancelled"))} className="font-medium text-destructive hover:underline">{L("বাতিল", "Cancel")}</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── one holder: count, statement, edit ──────────────────────────────────────

const STATEMENT_PAGE = 50;

function HolderDetail({ h, active, partners }: { h: Holder; active: Holder[]; partners: View["partners"] }) {
  const L = useL();
  const { locale } = useTranslation();
  const label = useLineLabel();
  const router = useRouter();
  const today = todayDhaka();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(STATEMENT_PAGE);
  const [splitKey, setSplitKey] = useState<string | null>(null);
  const [counted, setCounted] = useState("");
  const [countDate, setCountDate] = useState(today);
  const [countNote, setCountNote] = useState("");
  const [pending, start] = useTransition();
  const lines = useMemo(() => [...h.statement].reverse(), [h.statement]);   // newest first
  const c = counted === "" ? null : Number(counted);
  const liveGap = c == null || !Number.isFinite(c) || countDate !== today ? null : c - h.balance;
  const Icon = HOLDER_ICON[h.kind];

  const move = (key: string, to: string) => start(async () => {
    const r = await assignCashRows([key], to || null);
    if (!r.ok) { toast.error(r.error); return; }
    router.refresh();
  });
  const archive = () => {
    if (!confirm(L(`${h.name}-কে তালিকা থেকে সরাবেন? আগের হিসাব থেকে যাবে।`, `Remove ${h.name} from the list? Their past entries stay.`))) return;
    start(async () => {
      const r = await archiveCashHolder(h.id);
      if (!r.ok) { toast.error(r.error); return; }
      forgetHolderOptions();
      router.refresh();
    });
  };
  const saveCount = () => start(async () => {
    const r = await saveHolderCount({ holderId: h.id, date: countDate, amount: Number(counted), note: countNote });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(Math.abs(r.gap) < 1 ? L("গোনা লেখা হলো — মিলেছে", "Count saved — it matches") : L(`গোনা লেখা হলো — ${taka(r.gap)} ${r.gap < 0 ? "কম" : "বেশি"}`, `Count saved — ${taka(r.gap)} ${r.gap < 0 ? "short" : "over"}`));
    setCounted(""); setCountNote("");
    router.refresh();
  });
  const removeCount = (id: string) => start(async () => {
    const r = await deleteCashCount(id);
    if (r?.error) toast.error(r.error); else router.refresh();
  });

  return (
    <section className={card} aria-label={L(`${h.name}-এর হিসাব`, `${h.name}'s statement`)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Icon className="h-4 w-4" aria-hidden /></span>
        <div className="mr-auto min-w-0">
          <h3 className="truncate text-sm font-semibold">{L(`${h.name}-এর হিসাব`, `${h.name}'s statement`)}</h3>
          <p className={cn("text-lg font-bold tabular-nums leading-tight", h.balance < -0.5 && tone.bad)}>{money(h.balance)}</p>
        </div>
        <Link href={`/dashboard/finance/holders/${h.id}`} className={cn(ghost, "h-9")}><Printer className="h-4 w-4" aria-hidden />{L("প্রিন্ট / PDF", "Print / PDF")}</Link>
        <button type="button" onClick={() => setEditing((e) => !e)} className={cn(ghost, "h-9")}><Pencil className="h-4 w-4" aria-hidden />{L("বদলান", "Edit")}</button>
        {!h.archived && <button type="button" onClick={archive} disabled={pending} className={cn(btn, "h-9 text-muted-foreground hover:bg-muted hover:text-destructive")}><Trash2 className="h-4 w-4" aria-hidden />{L("সরান", "Remove")}</button>}
      </div>
      {editing && <HolderForm partners={partners} holder={h} onDone={() => setEditing(false)} />}

      {/* count and compare; saved, so there is a record that it matched */}
      <form onSubmit={(e) => { e.preventDefault(); saveCount(); }} className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-muted/20 px-5 py-3">
        <label className="grid gap-1 text-xs text-muted-foreground">{L(`${h.name} গুনে পেলেন (৳)`, `${h.name} counted (৳)`)}
          <input type="number" inputMode="decimal" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} required className={cn(field, "w-36 tabular-nums")} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">{L("তারিখ", "Date")}
          <input type="date" value={countDate} max={today} onChange={(e) => setCountDate(e.target.value)} className={field} />
        </label>
        <label className="grid min-w-36 flex-1 gap-1 text-xs text-muted-foreground">{L("নোট (ঐচ্ছিক)", "Note (optional)")}
          <input value={countNote} onChange={(e) => setCountNote(e.target.value)} maxLength={300} className={field} />
        </label>
        <button type="submit" disabled={pending || counted === ""} className={primary}>{L("গোনা লিখুন", "Save count")}</button>
        {liveGap != null && (
          <p className={cn("basis-full text-sm font-semibold", Math.abs(liveGap) < 1 ? tone.good : tone.warn)}>
            {Math.abs(liveGap) < 1 ? L("মিলেছে ✓", "Matches ✓")
              : liveGap < 0 ? L(`${taka(liveGap)} কম — কোনো খরচ বা হাতবদল লেখা বাকি`, `${taka(liveGap)} short — a cost or handover not entered`)
              : L(`${taka(liveGap)} বেশি — কোনো আয় বা হাতবদল লেখা বাকি`, `${taka(liveGap)} over — money in or a handover not entered`)}
          </p>
        )}
        {h.counts.length > 0 && (
          <ul className="basis-full space-y-0.5 text-xs">
            {h.counts.slice(0, 5).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 tabular-nums">
                <span className="w-20 text-muted-foreground">{fmtDay(x.date, locale)}</span>
                <span>{L(`গোনা ${taka(x.amount)} · হিসাবে ${money(x.expected)}`, `counted ${taka(x.amount)} · books ${money(x.expected)}`)}</span>
                <b className={Math.abs(x.gap) < 1 ? tone.good : tone.warn}>{Math.abs(x.gap) < 1 ? L("মিলেছে", "matches") : `${x.gap < 0 ? "−" : "+"}${taka(x.gap)}`}</b>
                {x.note && <span className="text-muted-foreground">· {x.note}</span>}
                <button type="button" onClick={() => removeCount(x.id)} disabled={pending} aria-label={L("মুছুন", "Delete")} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {lines.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{L("এখনো কোনো লেনদেন এঁর নামে নেই", "No entries with them yet")}</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {lines.slice(0, shown).map((l) => (
            <li key={l.key}>
              <div className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{l.key === OPENING_KEY ? L("শুরুতে", "Start") : l.key === "carried" ? "" : fmtDay(l.date, locale)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{l.category === "Handover" ? `${label(l)} ${l.description}` : label(l)}</span>
                  {l.category !== "Handover" && l.key !== OPENING_KEY && l.key !== "carried" && <span className="block truncate text-xs text-muted-foreground">{l.description}</span>}
                  {l.whole != null && <span className="block text-[11px] text-muted-foreground">{L(`পুরো ${money(l.whole)} এর মধ্যে এঁর ভাগ`, `their part of ${money(l.whole)}`)}</span>}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {l.key !== "carried" && <span className={cn("block font-semibold", l.signed >= 0 ? tone.good : "text-foreground")}>{signed(l.signed)}</span>}
                  <span className="block text-[11px] text-muted-foreground">{L("পরে", "after")} {money(l.balance)}</span>
                </span>
                {l.category !== "Handover" && l.key !== "carried" && (
                  <span className="flex shrink-0 items-center gap-1">
                    <select aria-label={L("কার ঘরে", "Whose")} value={h.id} disabled={pending} onChange={(e) => move(l.key, e.target.value)}
                      className="h-8 w-24 rounded-md border border-input bg-background px-1.5 text-xs text-muted-foreground">
                      {active.some((x) => x.id === h.id) ? null : <option value={h.id}>{h.name}</option>}
                      {active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      <option value="">{L("বলা হয়নি", "Not said")}</option>
                    </select>
                    <button type="button" onClick={() => setSplitKey(splitKey === l.key ? null : l.key)} aria-label={L("ভাগ করুন", "Split")} title={L("ভাগ করুন", "Split")}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Split className="h-3.5 w-3.5" /></button>
                  </span>
                )}
              </div>
              {splitKey === l.key && <SplitEditor rowKey={l.key} whole={l.whole ?? l.signed} holders={active} onDone={() => setSplitKey(null)} />}
            </li>
          ))}
        </ul>
      )}
      {(lines.length > shown || h.hiddenLines > 0) && (
        <div className="border-t border-border/60 px-5 py-2.5 text-center text-sm">
          {lines.length > shown
            ? <button type="button" onClick={() => setShown((s) => s + STATEMENT_PAGE)} className="font-medium text-primary hover:underline">{L(`আরও ${Math.min(STATEMENT_PAGE, lines.length - shown)}টি দেখুন`, `Show ${Math.min(STATEMENT_PAGE, lines.length - shown)} more`)}</button>
            : <Link href={`/dashboard/finance/holders/${h.id}`} className="font-medium text-primary hover:underline">{L(`আরও ${h.hiddenLines}টি পুরনো লেনদেন — পুরো হিসাব দেখুন`, `${h.hiddenLines} older entries — open the full statement`)}</Link>}
        </div>
      )}
    </section>
  );
}

// ── share one row between holders ───────────────────────────────────────────

function SplitEditor({ rowKey, whole, holders, onDone }: { rowKey: string; whole: number; holders: Holder[]; onDone: () => void }) {
  const L = useL();
  const router = useRouter();
  const total = Math.abs(whole);
  const [parts, setParts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const sum = holders.reduce((s, h) => s + (Number(parts[h.id]) || 0), 0);
  const left = Math.round((total - sum) * 100) / 100;
  const save = () => start(async () => {
    const r = await splitCashRow(rowKey, holders.map((h) => ({ holderId: h.id, amount: Number(parts[h.id]) || 0 })).filter((p) => p.amount > 0));
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(L("ভাগ লেখা হলো", "Split saved"));
    onDone();
    router.refresh();
  });
  return (
    <div className="mx-5 mb-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs text-muted-foreground">{L(`মোট ${taka(total)} — কার কাছে কত গেল/এলো লিখুন। বাকি থাকলে সেটা "বলা হয়নি"-তে থাকবে।`, `Total ${taka(total)} — enter each one's part. Anything left stays "not yet said".`)}</p>
      <div className="flex flex-wrap gap-2">
        {holders.map((h) => (
          <label key={h.id} className="grid gap-1 text-xs text-muted-foreground">{h.name}
            <input type="number" inputMode="decimal" min={0} value={parts[h.id] ?? ""} onChange={(e) => setParts((p) => ({ ...p, [h.id]: e.target.value }))} className={cn(field, "h-9 w-28 tabular-nums")} />
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn("text-xs font-medium tabular-nums", left < -0.5 ? tone.bad : Math.abs(left) < 0.5 ? tone.good : tone.warn)}>
          {left < -0.5 ? L(`${taka(left)} বেশি হয়ে গেছে`, `${taka(left)} too much`) : Math.abs(left) < 0.5 ? L("পুরোটা ভাগ হয়েছে ✓", "All of it shared ✓") : L(`বাকি ${taka(left)}`, `${taka(left)} left`)}
        </span>
        <button type="button" onClick={save} disabled={pending || sum <= 0 || left < -0.5} className={cn(primary, "ml-auto h-9")}>{L("ভাগ সেভ", "Save split")}</button>
        <button type="button" onClick={onDone} className={cn(btn, "h-9 text-muted-foreground")}>{L("বাতিল", "Cancel")}</button>
      </div>
    </div>
  );
}

// ── rows nobody has been named for ──────────────────────────────────────────

const PAGE = 40;
const GROUP_LABEL: Record<Group, [string, string]> = {
  sale: ["বিক্রি", "Sales"], buy: ["গরু/সম্পদ কেনা", "Cattle & assets bought"], cost: ["খরচ", "Costs"], stock: ["খাবার/দোকান", "Feed & shop"],
  partner: ["অংশীদার", "Partners"], loan: ["ঋণ", "Loans"], opening: ["শুরুর নগদ", "Opening cash"],
};

function Unassigned({ lines, holders }: { lines: HolderLine[]; holders: Holder[] }) {
  const L = useL();
  const { locale } = useTranslation();
  const label = useLineLabel();
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [group, setGroup] = useState<Group | "all">("all");
  const [month, setMonth] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [splitKey, setSplitKey] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<Group, number>();
    for (const l of lines) m.set(groupOf(l), (m.get(groupOf(l)) ?? 0) + 1);
    return m;
  }, [lines]);
  const months = useMemo(() => [...new Set(lines.filter((l) => l.date).map((l) => l.date.slice(0, 7)))].sort().reverse(), [lines]);
  const filtered = useMemo(() => lines.filter((l) => (group === "all" || groupOf(l) === group) && (month === "all" || l.date.startsWith(month))), [lines, group, month]);
  const visible = filtered.slice(0, shown);
  const pickedSum = useMemo(() => lines.filter((l) => picked.has(l.key)).reduce((s, l) => s + l.signed, 0), [lines, picked]);

  if (!lines.length) return null;
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allFiltered = filtered.length > 0 && filtered.every((l) => picked.has(l.key));
  const give = (holderId: string) => start(async () => {
    const r = await assignCashRows([...picked], holderId);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(L(`${r.count}টি লেনদেন ${holders.find((h) => h.id === holderId)?.name ?? ""}-এর ঘরে গেল`, `${r.count} entries given to ${holders.find((h) => h.id === holderId)?.name ?? ""}`));
    setPicked(new Set());
    router.refresh();
  });
  const monthName = (m: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  const chip = (on: boolean) => cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:text-foreground");

  return (
    <section id="unassigned" className={cn(card, "scroll-mt-20 border-amber-500/40")}>
      <div className="border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-semibold">{L("কার টাকা — বলা হয়নি", "Whose money — not yet said")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {L("ধরন বা মাস বেছে \"সব\" টিক দিয়ে একবারে কারো ঘরে দিন — যেমন সেপ্টেম্বরের সব খরচ → মহিউদ্দিন। দুজনের মধ্যে ভাগ হলে ⑂ চাপুন। মনে না থাকলে আন্দাজে দেবেন না — গুনে মিলিয়ে পরে দিন।",
             "Pick a kind or month, tick all, and give them to someone at once — e.g. all September costs → Mohiuddin. Shared between two? Tap ⑂. Don't guess — count and settle later.")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => { setGroup("all"); setShown(PAGE); }} className={chip(group === "all")}>{L("সব", "All")} <span className="opacity-70">{lines.length}</span></button>
          {(Object.keys(GROUP_LABEL) as Group[]).filter((g) => groups.get(g)).map((g) => (
            <button key={g} type="button" onClick={() => { setGroup(g); setShown(PAGE); }} className={chip(group === g)}>{L(...GROUP_LABEL[g])} <span className="opacity-70">{groups.get(g)}</span></button>
          ))}
          {months.length > 1 && (
            <select value={month} onChange={(e) => { setMonth(e.target.value); setShown(PAGE); }} aria-label={L("মাস", "Month")} className="h-8 rounded-full border border-input bg-background px-3 text-xs">
              <option value="all">{L("সব মাস", "All months")}</option>
              {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/95 px-5 py-2.5 backdrop-blur">
        <label className="mr-1 flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={allFiltered} onChange={() => setPicked((p) => {
            const n = new Set(p);
            for (const l of filtered) { if (allFiltered) n.delete(l.key); else n.add(l.key); }
            return n;
          })} className="h-4 w-4" />
          {L(`এই তালিকার সব (${filtered.length})`, `All in this list (${filtered.length})`)}
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">{picked.size > 0 ? L(`${picked.size}টি বাছা · ${signed(pickedSum)}`, `${picked.size} ticked · ${signed(pickedSum)}`) : ""}</span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {holders.map((h) => {
            const Icon = HOLDER_ICON[h.kind];
            return (
              <button key={h.id} type="button" disabled={pending || picked.size === 0} onClick={() => give(h.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" aria-hidden />}→ {h.name}
              </button>
            );
          })}
        </span>
      </div>

      <ul className="divide-y divide-border/60 text-sm">
        {visible.map((l) => (
          <li key={l.key}>
            <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40">
              <input type="checkbox" checked={picked.has(l.key)} onChange={() => toggle(l.key)} aria-label={label(l)} className="h-4 w-4 shrink-0" />
              <button type="button" onClick={() => toggle(l.key)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{l.key === OPENING_KEY ? L("শুরুতে", "Start") : fmtDay(l.date, locale)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label(l)}</span>
                  {l.key !== OPENING_KEY && <span className="block truncate text-xs text-muted-foreground">{l.description}</span>}
                  {l.whole != null && <span className="block text-[11px] text-muted-foreground">{L(`পুরো ${money(l.whole)} এর বাকি অংশ`, `the rest of ${money(l.whole)}`)}</span>}
                </span>
                <span className={cn("shrink-0 font-semibold tabular-nums", l.signed >= 0 ? tone.good : "text-foreground")}>{signed(l.signed)}</span>
              </button>
              <button type="button" onClick={() => setSplitKey(splitKey === l.key ? null : l.key)} aria-label={L("ভাগ করুন", "Split")} title={L("ভাগ করুন", "Split")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Split className="h-3.5 w-3.5" /></button>
            </div>
            {splitKey === l.key && <SplitEditor rowKey={l.key} whole={l.whole ?? l.signed} holders={holders} onDone={() => setSplitKey(null)} />}
          </li>
        ))}
      </ul>
      {filtered.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + PAGE)} className="w-full border-t border-border/60 px-5 py-2.5 text-sm font-medium text-primary hover:bg-muted/40">
          {L(`আরও ${Math.min(PAGE, filtered.length - shown)}টি দেখুন (বাকি ${filtered.length - shown})`, `Show ${Math.min(PAGE, filtered.length - shown)} more (${filtered.length - shown} left)`)}
        </button>
      )}
    </section>
  );
}

// ── handovers ───────────────────────────────────────────────────────────────

function Handovers({ list }: { list: View["handovers"] }) {
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = (id: string) => {
    if (!confirm(L("এই হাতবদল মুছবেন?", "Delete this handover?"))) return;
    start(async () => {
      const r = await deleteHandover(id);
      if (!r.ok) toast.error(r.error); else router.refresh();
    });
  };
  return (
    <section className={card}>
      <h3 className="flex items-center gap-1.5 border-b border-border/60 px-5 py-3 text-sm font-semibold"><ArrowRightLeft className="h-4 w-4 text-muted-foreground" aria-hidden />{L("সাম্প্রতিক হাতবদল", "Recent handovers")}</h3>
      <ul className="divide-y divide-border/60 text-sm">
        {list.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDay(x.date, locale)}</span>
            <span className="min-w-0 flex-1 truncate">{x.from} → {x.to}{x.note ? <span className="text-muted-foreground"> · {x.note}</span> : null}</span>
            <span className="shrink-0 font-semibold tabular-nums">{taka(x.amount)}</span>
            <button type="button" onClick={() => remove(x.id)} disabled={pending} aria-label={L("মুছুন", "Delete")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── who changed what ────────────────────────────────────────────────────────

function ChangeLog({ log, holders }: { log: View["log"]; holders: Holder[] }) {
  const L = useL();
  const { locale } = useTranslation();
  const name = (id: unknown) => holders.find((h) => h.id === id)?.name ?? "?";
  const n = (x: unknown) => taka(Number(x) || 0);
  const what = (a: string, d: Record<string, unknown>): string => {
    const added = String(d.name ?? (Array.isArray(d.partners) ? d.partners.join(", ") : ""));
    switch (a) {
      case "assign": return d.changed ? L(`${d.count}টি লেনদেন ${name(d.to)}-এর ঘরে দিলেন (আগে অন্য কারো নামে ছিল)`, `gave ${d.count} entries to ${name(d.to)} (they had another holder)`) : L(`${d.count}টি লেনদেন ${name(d.to)}-এর ঘরে দিলেন`, `gave ${d.count} entries to ${name(d.to)}`);
      case "unassign": return L(`${d.count}টি লেনদেন থেকে নাম সরালেন`, `took the holder off ${d.count} entries`);
      case "split": return L("একটি লেনদেন ভাগ করলেন", "split an entry");
      case "handover": return L(`হাতবদল: ${d.from} → ${d.to} ${n(d.amount)}${d.pending ? " (অপেক্ষায়)" : ""}`, `handover: ${d.from} → ${d.to} ${n(d.amount)}${d.pending ? " (waiting)" : ""}`);
      case "handover_ok": return L(`হাতবদল ${n(d.amount)} পেয়েছেন বলে নিশ্চিত করলেন`, `confirmed receiving a handover of ${n(d.amount)}`);
      case "handover_no": return L(`বললেন হাতবদল ${n(d.amount)} পাননি`, `said a handover of ${n(d.amount)} was not received`);
      case "handover_delete": return L(`একটি হাতবদল (${n(d.amount)}) মুছলেন`, `deleted a handover (${n(d.amount)})`);
      case "holder_add": return L(`নতুন যোগ: ${added}`, `added: ${added}`);
      case "holder_edit": return L(`${d.name}-এর তথ্য বদলালেন`, `edited ${d.name}`);
      case "holder_archive": return L(`${name(d.holder)}-কে তালিকা থেকে সরালেন`, `removed ${name(d.holder)}`);
      default: return a;
    }
  };
  return (
    <details className={cn(card, "group")}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />{L("কে কী বদলেছেন", "Who changed what")}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{L(`শেষ ${log.length}টি`, `last ${log.length}`)}</span>
      </summary>
      <ul className="divide-y divide-border/60 border-t border-border/60 text-sm">
        {log.map((x, i) => (
          <li key={i} className="flex flex-wrap gap-x-3 px-5 py-2">
            <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">{fmtDay(x.at.slice(0, 10), locale)} {new Date(x.at).toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" })}</span>
            <span className="min-w-0 flex-1"><b className="font-medium">{x.by}</b> {what(x.action, x.detail)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** One line under the money tiles: who holds how much, with a link to the tab (the chosen period kept). */
export function CashHoldersStrip({ v }: { v: View }) {
  const L = useL();
  const params = useSearchParams();
  if (!v.holders.length) return null;
  const q = new URLSearchParams(params.toString());
  q.set("tab", "holders");
  return (
    <Link href={`?${q.toString()}`} scroll={false} className={cn(card, "flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm hover:bg-muted/40")}>
      <span className="text-xs font-medium text-muted-foreground">{L("কার কাছে:", "Who has it:")}</span>
      {v.holders.map((h) => {
        const Icon = HOLDER_ICON[h.kind];
        return (
          <span key={h.id} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{h.name}
            <b className={cn("tabular-nums", h.balance < -0.5 && tone.bad)}>{money(h.balance)}</b>
          </span>
        );
      })}
      {v.unassigned.length > 0 && (
        <span className={cn("inline-flex items-center gap-1.5", tone.warn)}>
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />{L("বলা হয়নি", "Not said")} <b className="tabular-nums">{money(v.unassignedBalance)}</b>
        </span>
      )}
      {v.pending.length > 0 && (
        <span className={cn("inline-flex items-center gap-1.5", tone.warn)}><Clock className="h-3.5 w-3.5" aria-hidden />{L(`${v.pending.length}টি হাতবদল অপেক্ষায়`, `${v.pending.length} handover(s) waiting`)}</span>
      )}
    </Link>
  );
}
