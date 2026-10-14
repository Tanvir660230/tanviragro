import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountingData } from "@/lib/accounting/engine";
import { loadHolderData } from "@/lib/accounting/cash-holder-data";
import { todayDhaka } from "@/lib/dates";
import {
  balanceTrend, buildHolderBook, holderBalanceOn, holderStatement, type HolderInput, type HolderKind, type HolderLine,
} from "@/lib/accounting/cash-holders";
import type { MoneyCheck } from "@/lib/money/money-model";

/** a statement longer than this starts with what was carried from before (the page stays light) */
export const STATEMENT_LINES = 300;
/** a holder with money should be counted at least this often */
export const HOLDER_COUNT_EVERY_DAYS = 14;

export type HolderCount = { id: string; date: string; amount: number; expected: number; gap: number; note: string | null };

/** What the Money page's "who has the cash" tab shows; plain data for a client component. */
export type HolderView =
  | { enabled: false }
  | {
      enabled: true;
      today: string;
      total: number;
      /** the signed-in person's own holder */
      me: string | null;
      holders: {
        id: string; name: string; kind: HolderKind; partnerId: string | null; userId: string | null; archived: boolean;
        balance: number; moneyIn: number; moneyOut: number; lastDate: string | null;
        /** newest last; may start with a carried line */
        statement: (HolderLine & { balance: number })[];
        /** older lines left out of `statement` */
        hiddenLines: number;
        trend: number[];
        counts: HolderCount[];
      }[];
      unassigned: HolderLine[];
      unassignedBalance: number;
      pending: { id: string; date: string; fromId: string; toId: string; from: string; to: string; amount: number; note: string | null; canAnswer: boolean }[];
      handovers: { id: string; date: string; from: string; to: string; amount: number; note: string | null }[];
      log: { at: string; by: string; action: string; detail: Record<string, unknown> }[];
      partners: { id: string; name: string }[];
      checks: MoneyCheck[];
    };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export async function loadHolderView(supabase: SupabaseClient<any>, businessId: string, userId: string | null): Promise<HolderView> {
  // the holder tab is an extra: if its tables cannot be read, the rest of the Money page still shows
  const data = await loadHolderData(supabase, businessId).catch((e) => {
    console.error("cash holders:", e instanceof Error ? e.message : e);
    return { enabled: false } as const;
  });
  if (!data.enabled) return { enabled: false };
  const [acc, partnersRes, countsRes, logRes] = await Promise.all([
    getAccountingData(supabase),
    supabase.from("partners").select("id, name").eq("business_id", businessId).is("deleted_at", null).order("name"),
    supabase.from("cash_counts").select("id, holder_id, counted_on, amount, note").eq("business_id", businessId)
      .not("holder_id", "is", null).is("deleted_at", null).order("counted_on", { ascending: false }).limit(200),
    supabase.from("cash_holder_log").select("at, by_user, action, detail").eq("business_id", businessId).order("at", { ascending: false }).limit(40),
  ]);
  const today = todayDhaka();
  const input: HolderInput = { rows: acc.cashLedger, openingCash: acc.openingCash, ...data };
  const book = buildHolderBook(input);
  const names = new Map(data.holders.map((h) => [h.id, h.name]));
  const userOf = new Map(data.holders.map((h) => [h.id, h.userId]));

  // counts of one holder, each against the books for its day — recomputed now, so an entry made later closes the gap
  const countRows = (countsRes.data ?? []) as { id: string; holder_id: string; counted_on: string; amount: number | string; note: string | null }[];
  const countsOf = (id: string): HolderCount[] => countRows.filter((c) => c.holder_id === id).slice(0, 10).map((c) => {
    const date = String(c.counted_on).slice(0, 10);
    const expected = holderBalanceOn(input, id, date);
    return { id: c.id, date, amount: Number(c.amount), expected, gap: Math.round((Number(c.amount) - expected) * 100) / 100, note: c.note };
  });

  // who made each logged change (names where the profile is readable)
  const logRows = (logRes.data ?? []) as { at: string; by_user: string | null; action: string; detail: Record<string, unknown> }[];
  const byIds = [...new Set(logRows.map((l) => l.by_user).filter(Boolean))] as string[];
  const profiles = byIds.length ? (await supabase.from("profiles").select("id, full_name").in("id", byIds)).data ?? [] : [];
  const personOf = new Map((profiles as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const holderByUser = new Map(data.holders.filter((h) => h.userId).map((h) => [h.userId!, h.name]));

  const holders = book.holders.map((s) => {
    const full = holderStatement(input, s.holder.id);
    const hidden = Math.max(0, full.length - STATEMENT_LINES);
    const shown = full.slice(hidden);
    const statement = hidden > 0
      ? [{ key: "carried", date: full[hidden - 1].date, description: "", category: "Opening" as const, signed: full[hidden - 1].balance, balance: full[hidden - 1].balance }, ...shown]
      : shown;
    return {
      ...s.holder, balance: s.balance, moneyIn: s.moneyIn, moneyOut: s.moneyOut, lastDate: s.lastDate,
      statement, hiddenLines: hidden, trend: balanceTrend(full, today, 30), counts: countsOf(s.holder.id),
    };
  });

  // what would make "who has how much" wrong, for the checks bar at the top of the Money page
  const checks: MoneyCheck[] = [];
  if (book.unassigned.length) checks.push({ key: "holders_unsaid", ok: false, count: book.unassigned.length, amount: book.unassignedBalance });
  for (const h of holders.filter((x) => x.balance < -0.5)) checks.push({ key: "holder_negative", ok: false, name: h.name, amount: h.balance });
  const mine = book.pending.filter((p) => userId && userOf.get(p.toId) === userId);
  if (book.pending.length) checks.push({ key: "handover_pending", ok: false, count: book.pending.length, ...(mine.length ? { name: "me" } : {}) });
  for (const h of holders.filter((x) => !x.archived && x.kind === "person" && x.balance >= 500)) {
    const last = h.counts[0];
    if (!last) checks.push({ key: "holder_count", ok: false, name: h.name });
    else if (Math.abs(last.gap) >= 1) checks.push({ key: "holder_count", ok: false, name: h.name, amount: last.gap, date: last.date });
    else if (daysBetween(last.date, today) > HOLDER_COUNT_EVERY_DAYS) checks.push({ key: "holder_count", ok: false, name: h.name, count: daysBetween(last.date, today), date: last.date });
  }

  return {
    enabled: true,
    today,
    total: book.total,
    me: data.holders.find((h) => !h.archived && userId && h.userId === userId)?.id ?? null,
    holders,
    unassigned: book.unassigned,
    unassignedBalance: book.unassignedBalance,
    pending: book.pending.map((p) => ({ ...p, from: names.get(p.fromId) ?? "?", to: names.get(p.toId) ?? "?", canAnswer: !!userId && userOf.get(p.toId) === userId })),
    handovers: data.handovers.filter((h) => h.status === "confirmed").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
      .map((h) => ({ id: h.id, date: h.date, from: names.get(h.fromId) ?? "?", to: names.get(h.toId) ?? "?", amount: h.amount, note: h.note })),
    log: logRows.map((l) => ({ at: l.at, by: (l.by_user && (personOf.get(l.by_user) || holderByUser.get(l.by_user))) || "—", action: l.action, detail: l.detail ?? {} })),
    partners: ((partnersRes.data ?? []) as { id: string; name: string }[]),
    checks,
  };
}

/** The signed-in person's own cash (home screen): null when they are not linked to a holder. */
export async function loadMyCash(supabase: SupabaseClient<any>, businessId: string, userId: string | null): Promise<{ balance: number; waiting: number } | null> {
  if (!userId) return null;
  try {
    const data = await loadHolderData(supabase, businessId);
    if (!data.enabled) return null;
    const mine = data.holders.find((h) => !h.archived && h.userId === userId);
    if (!mine) return null;
    const acc = await getAccountingData(supabase);
    const book = buildHolderBook({ rows: acc.cashLedger, openingCash: acc.openingCash, ...data });
    return {
      balance: book.holders.find((h) => h.holder.id === mine.id)?.balance ?? 0,
      waiting: book.pending.filter((p) => p.toId === mine.id).length,
    };
  } catch {
    return null;
  }
}

/** Farm cash a partner is holding (partner profile): settling with them, it is the farm's, not theirs. */
export async function loadPartnerHeldCash(supabase: SupabaseClient<any>, businessId: string, partnerId: string): Promise<{ holderId: string; balance: number } | null> {
  try {
    const data = await loadHolderData(supabase, businessId);
    if (!data.enabled) return null;
    const theirs = data.holders.find((h) => h.partnerId === partnerId);
    if (!theirs) return null;
    const acc = await getAccountingData(supabase);
    const book = buildHolderBook({ rows: acc.cashLedger, openingCash: acc.openingCash, ...data });
    const balance = book.holders.find((h) => h.holder.id === theirs.id)?.balance ?? 0;
    return Math.abs(balance) >= 0.5 ? { holderId: theirs.id, balance } : null;
  } catch {
    return null;
  }
}
