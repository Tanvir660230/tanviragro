"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requireAnyPermission, requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { validateDate } from "@/lib/validate";
import { todayDhaka } from "@/lib/dates";
import { getL } from "@/i18n/server-text";
import { getAccountingData } from "@/lib/accounting/engine";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { OPENING_KEY, buildHolderBook, holderBalanceOn, isHolderKind, type HolderKind } from "@/lib/accounting/cash-holders";
import { loadHolderData, loadHolderList, logCash, missingTable, tagsOf } from "@/lib/accounting/cash-holder-data";

/**
 * Who has the farm's cash: the holders, which holder each cash row belongs to, and money handed
 * between them (migration 20261014090000). Nothing here changes the farm's cash figure.
 *
 * Rules that keep it trustworthy between partners:
 *  - adding what is missing is always allowed (naming a row nobody was named for, a handover);
 *    CHANGING what was recorded for a day in a locked period is not (a row's holder, a handover);
 *  - money handed to someone with a login waits until they confirm it;
 *  - every change is written to cash_holder_log with who made it.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Client = SupabaseClient<any>;

async function notReady() {
  const L = await getL();
  return L("কার কাছে টাকা — এটা চালু হবে database আপডেটের পরে (migration 20261014090000)।", "Cash holders need the database update (migration 20261014090000).");
}

async function fail(e: unknown): Promise<{ ok: false; error: string }> {
  const L = await getL();
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "");
  if (missingTable(e as { message?: string })) return { ok: false, error: await notReady() };
  if (/uq_cash_holder_name/i.test(m)) return { ok: false, error: L("এই নামে আগেই একজন আছে", "That name is already used") };
  if (/uq_cash_holder_user/i.test(m)) return { ok: false, error: L("এই লগইন আগেই আরেকজনের সাথে জোড়া", "That login is already linked to another holder") };
  if (/Not allowed|permission|row-level security/i.test(m)) return { ok: false, error: L("এই কাজের অনুমতি নেই", "You are not allowed to do this") };
  return { ok: false, error: m || L("সেভ করা যায়নি", "Could not save") };
}

function touch() {
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/partners");
  revalidatePath("/dashboard");
}

async function session() {
  const supabase = (await createClient()) as Client;
  const ctx = await getBusinessContext(supabase);
  return { supabase, ctx };
}

/** The holders a form can choose from (any form that records money in or out), and "me". */
export async function getCashHolderOptions(): Promise<{ enabled: boolean; me: string | null; holders: { id: string; name: string; kind: HolderKind; partnerId: string | null }[] }> {
  try {
    const { supabase, ctx } = await session();
    requireAnyPermission(ctx, [PERMISSIONS.COST_ENTRY_CREATE, PERMISSIONS.CATTLE_SELL, PERMISSIONS.CATTLE_CREATE, PERMISSIONS.INVENTORY_PURCHASE, PERMISSIONS.PARTNERS_MANAGE]);
    const list = await loadHolderList(supabase, ctx.businessId);
    if (!list) return { enabled: false, me: null, holders: [] };
    const live = list.filter((h) => !h.archived);
    return {
      enabled: true,
      me: live.find((h) => h.userId === ctx.user.id)?.id ?? null,
      holders: live.map(({ id, name, kind, partnerId }) => ({ id, name, kind, partnerId })),
    };
  } catch {
    return { enabled: false, me: null, holders: [] };
  }
}

// ── holders ─────────────────────────────────────────────────────────────────

/** The logins of this farm (owner + team), for linking a holder to the person who uses the app. */
export async function getLoginOptions(): Promise<{ id: string; name: string }[]> {
  try {
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_EDIT);
    const { data: members } = await supabase.from("business_users").select("user_id, role").eq("business_id", ctx.businessId);
    const ids = [...new Set([ctx.business.owner_id, ...((members ?? []) as { user_id: string }[]).map((m) => m.user_id)].filter(Boolean))] as string[];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const names = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
    const role = new Map(((members ?? []) as { user_id: string; role: string }[]).map((m) => [m.user_id, m.role]));
    return ids.map((id) => ({
      id,
      name: names.get(id) || (id === ctx.user.id ? ctx.user.email : id === ctx.business.owner_id ? "Owner" : `${role.get(id) ?? "member"} · ${id.slice(0, 6)}`),
    }));
  } catch {
    return [];
  }
}

export async function saveCashHolder(input: { id?: string; name: string; kind: string; partnerId?: string | null; userId?: string | null }): Promise<Result<{ id: string }>> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_EDIT);
    const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 60) return { ok: false, error: L("নাম লিখুন (৬০ অক্ষরের মধ্যে)", "Enter a name (up to 60 letters)") };
    if (!isHolderKind(input.kind)) return { ok: false, error: L("ধরন বাছুন", "Choose a kind") };
    let partnerId = input.kind === "person" ? input.partnerId || null : null;
    if (partnerId) {
      const { data: p } = await supabase.from("partners").select("id").eq("id", partnerId).eq("business_id", ctx.businessId).is("deleted_at", null).maybeSingle();
      if (!p) partnerId = null;
    }
    let userId = input.kind === "person" ? input.userId || null : null;
    if (userId && userId !== ctx.business.owner_id) {
      const { data: m } = await supabase.from("business_users").select("user_id").eq("business_id", ctx.businessId).eq("user_id", userId).maybeSingle();
      if (!m) userId = null;
    }
    const row = { name, kind: input.kind, partner_id: partnerId, user_id: userId };
    if (input.id) {
      const { error } = await supabase.from("cash_holders").update(row).eq("id", input.id).eq("business_id", ctx.businessId);
      if (error) return fail(error);
      await logCash(supabase, ctx.businessId, "holder_edit", { holder: input.id, ...row });
      touch();
      return { ok: true, id: input.id };
    }
    const { data, error } = await supabase.from("cash_holders").insert({ ...row, business_id: ctx.businessId }).select("id").single();
    if (error || !data) return fail(error);
    await logCash(supabase, ctx.businessId, "holder_add", { holder: data.id, ...row });
    touch();
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return fail(e);
  }
}

/** One holder for each partner who has none yet (a quick start). */
export async function addPartnersAsHolders(): Promise<Result<{ added: number }>> {
  try {
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_EDIT);
    const [list, partnersRes] = await Promise.all([
      loadHolderList(supabase, ctx.businessId),
      supabase.from("partners").select("id, name, left_at").eq("business_id", ctx.businessId).is("deleted_at", null).order("name"),
    ]);
    if (!list) return { ok: false, error: await notReady() };
    const taken = new Set(list.filter((h) => !h.archived).flatMap((h) => [h.partnerId, h.name.toLowerCase()]));
    // logins are linked afterwards (Edit) — a partner record does not say which login is theirs
    const rows = ((partnersRes.data ?? []) as { id: string; name: string; left_at: string | null }[])
      .filter((p) => !p.left_at && !taken.has(p.id) && !taken.has(p.name.trim().toLowerCase()))
      .map((p, i) => ({
        business_id: ctx.businessId, name: p.name.trim().slice(0, 60), kind: "person", partner_id: p.id, sort_order: list.length + i,
      }));
    if (rows.length) {
      const { error } = await supabase.from("cash_holders").insert(rows);
      if (error) return fail(error);
      await logCash(supabase, ctx.businessId, "holder_add", { partners: rows.map((r) => r.name) });
    }
    touch();
    return { ok: true, added: rows.length };
  } catch (e) {
    return fail(e);
  }
}

/** Stop offering a holder. Only when no money is left with it (hand it over first). */
export async function archiveCashHolder(id: string): Promise<Result> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_EDIT);
    const [acc, data] = await Promise.all([getAccountingData(supabase), loadHolderData(supabase, ctx.businessId)]);
    if (!data.enabled) return { ok: false, error: await notReady() };
    const book = buildHolderBook({ rows: acc.cashLedger, openingCash: acc.openingCash, ...data });
    const h = book.holders.find((x) => x.holder.id === id);
    if (h && Math.abs(h.balance) >= 0.5)
      return { ok: false, error: L(`${h.holder.name}-এর কাছে এখনো ৳${Math.round(h.balance).toLocaleString("en-IN")} — আগে অন্য কারো কাছে হাতবদল লিখুন।`, `${h.holder.name} still holds ৳${Math.round(h.balance).toLocaleString("en-IN")} — hand it over first.`) };
    if (book.pending.some((p) => p.fromId === id || p.toId === id))
      return { ok: false, error: L("এঁর একটা হাতবদল নিশ্চিত হওয়া বাকি", "A handover with them is still waiting") };
    const { error } = await supabase.from("cash_holders").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("business_id", ctx.businessId);
    if (error) return fail(error);
    await logCash(supabase, ctx.businessId, "holder_archive", { holder: id });
    touch();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── whose money each row was ────────────────────────────────────────────────

/** A changed row in a locked period is refused; naming a row that had no holder is not a change. */
async function lockedChange(supabase: Client, businessId: string, keys: string[]): Promise<string | null> {
  const before = await tagsOf(supabase, businessId, keys);
  const changed = keys.filter((k) => before[k]?.length);
  if (!changed.length) return null;
  const acc = await getAccountingData(supabase);
  const dates = new Map(acc.cashLedger.map((r) => [r.id, r.date]));
  const days = [...new Set(changed.map((k) => (k === OPENING_KEY ? null : dates.get(k))).filter((d): d is string => !!d))].sort();
  for (const d of days) {
    const err = await verifyFinancialLock(supabase, businessId, d);
    if (err) return err;
  }
  return null;
}

/** Give these cash rows whole to one holder (null = take the name off again). */
export async function assignCashRows(keys: string[], holderId: string | null): Promise<Result<{ count: number }>> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);
    const ids = [...new Set((keys ?? []).map((k) => String(k).trim()).filter((k) => k.length > 0 && k.length <= 120))].slice(0, 2000);
    if (!ids.length) return { ok: false, error: L("কোনো লেনদেন বাছা হয়নি", "Nothing chosen") };
    const lock = await lockedChange(supabase, ctx.businessId, ids);
    if (lock) return { ok: false, error: L(`লক করা সময়ের লেনদেনের মালিক বদলানো যায় না — ${lock}`, `A locked period's entries cannot change holder — ${lock}`) };
    const before = await tagsOf(supabase, ctx.businessId, ids);
    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 300) {
      const part = ids.slice(i, i + 300);
      const del = await supabase.from("cash_holder_tags").delete().eq("business_id", ctx.businessId).in("row_key", part);
      if (del.error) return fail(del.error);
      if (holderId) {
        const { error } = await supabase.from("cash_holder_tags")
          .insert(part.map((row_key) => ({ business_id: ctx.businessId, row_key, holder_id: holderId, amount: null, updated_at: now })));
        if (error) return fail(error);
      }
    }
    const changed = ids.filter((k) => before[k]?.length);
    await logCash(supabase, ctx.businessId, holderId ? "assign" : "unassign", {
      to: holderId, count: ids.length, keys: ids.slice(0, 50),
      ...(changed.length ? { changed: Object.fromEntries(changed.slice(0, 50).map((k) => [k, before[k]])) } : {}),
    });
    touch();
    return { ok: true, count: ids.length };
  } catch (e) {
    return fail(e);
  }
}

/** Share one row between holders by amount (a sale paid half to each, the opening cash). */
export async function splitCashRow(key: string, parts: { holderId: string; amount: number }[]): Promise<Result> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);
    const clean = (parts ?? []).map((p) => ({ holderId: String(p.holderId), amount: Math.round(Number(p.amount) * 100) / 100 })).filter((p) => p.holderId && p.amount > 0);
    if (new Set(clean.map((p) => p.holderId)).size !== clean.length) return { ok: false, error: L("একই জন দুবার আছে", "The same holder is listed twice") };
    if (!clean.length) return { ok: false, error: L("অন্তত একজনের ভাগ লিখুন", "Enter at least one share") };
    const acc = await getAccountingData(supabase);
    const row = key === OPENING_KEY ? { amount: Math.abs(acc.openingCash) } : acc.cashLedger.find((r) => r.id === key);
    if (!row) return { ok: false, error: L("লেনদেনটা পাওয়া যায়নি", "Entry not found") };
    const sum = clean.reduce((s, p) => s + p.amount, 0);
    if (sum > row.amount + 0.5) return { ok: false, error: L(`ভাগের যোগফল (৳${sum.toLocaleString("en-IN")}) লেনদেনের চেয়ে বেশি (৳${row.amount.toLocaleString("en-IN")})`, `The shares (৳${sum.toLocaleString("en-IN")}) exceed the entry (৳${row.amount.toLocaleString("en-IN")})`) };
    const lock = await lockedChange(supabase, ctx.businessId, [key]);
    if (lock) return { ok: false, error: L(`লক করা সময়ের লেনদেনের মালিক বদলানো যায় না — ${lock}`, `A locked period's entries cannot change holder — ${lock}`) };
    const before = await tagsOf(supabase, ctx.businessId, [key]);
    const del = await supabase.from("cash_holder_tags").delete().eq("business_id", ctx.businessId).eq("row_key", key);
    if (del.error) return fail(del.error);
    const now = new Date().toISOString();
    const { error } = await supabase.from("cash_holder_tags")
      .insert(clean.map((p) => ({ business_id: ctx.businessId, row_key: key, holder_id: p.holderId, amount: p.amount, updated_at: now })));
    if (error) return fail(error);
    await logCash(supabase, ctx.businessId, "split", { key, parts: clean, ...(before[key] ? { before: before[key] } : {}) });
    touch();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── handovers ───────────────────────────────────────────────────────────────

export async function recordHandover(input: { date: string; fromId: string; toId: string; amount: number; note?: string }): Promise<Result<{ pending: boolean }>> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);
    const dateErr = validateDate(input.date, "Date");
    if (dateErr) return { ok: false, error: dateErr };
    if (input.date > todayDhaka()) return { ok: false, error: L("ভবিষ্যতের তারিখ দেওয়া যাবে না", "The date cannot be in the future") };
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!(amount > 0)) return { ok: false, error: L("টাকার অঙ্ক লিখুন", "Enter the amount") };
    if (!input.fromId || !input.toId) return { ok: false, error: L("কার কাছ থেকে আর কার কাছে — দুটোই বাছুন", "Choose who gave and who got it") };
    if (input.fromId === input.toId) return { ok: false, error: L("একই জনের কাছে হাতবদল হয় না", "Giver and receiver must differ") };
    const list = (await loadHolderList(supabase, ctx.businessId)) ?? [];
    const from = list.find((h) => h.id === input.fromId && !h.archived);
    const to = list.find((h) => h.id === input.toId && !h.archived);
    if (!from || !to) return { ok: false, error: L("একজনকে তালিকায় পাওয়া যায়নি", "A holder was not found") };
    // handed to someone with a login, by someone else: they confirm it first
    const pending = !!to.userId && to.userId !== ctx.user.id;
    const note = String(input.note ?? "").trim().slice(0, 300) || null;
    const { data, error } = await supabase.from("cash_handovers").insert({
      business_id: ctx.businessId, handed_on: input.date, from_holder: from.id, to_holder: to.id, amount, note,
      status: pending ? "pending" : "confirmed", ...(pending ? {} : { confirmed_at: new Date().toISOString(), confirmed_by: ctx.user.id }),
    }).select("id").single();
    if (error || !data) return fail(error);
    await logCash(supabase, ctx.businessId, "handover", { id: data.id, from: from.name, to: to.name, amount, date: input.date, pending });
    touch();
    return { ok: true, pending };
  } catch (e) {
    return fail(e);
  }
}

/** The receiver says yes (the money moves) or no (it never arrived). */
export async function answerHandover(id: string, accept: boolean): Promise<Result> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    const { data: h } = await supabase.from("cash_handovers").select("id, to_holder, status, amount, handed_on")
      .eq("id", id).eq("business_id", ctx.businessId).is("deleted_at", null).maybeSingle();
    if (!h) return { ok: false, error: L("হাতবদলটা পাওয়া যায়নি", "Handover not found") };
    const row = h as { id: string; to_holder: string; status: string; amount: number; handed_on: string };
    if (row.status !== "pending") return { ok: false, error: L("এটা আগেই ঠিক করা হয়েছে", "Already answered") };
    const list = (await loadHolderList(supabase, ctx.businessId)) ?? [];
    const to = list.find((x) => x.id === row.to_holder);
    if (!to?.userId || to.userId !== ctx.user.id) return { ok: false, error: L("যিনি টাকা পেয়েছেন শুধু তিনিই নিশ্চিত করতে পারেন", "Only the receiver can confirm") };
    const { error } = await supabase.from("cash_handovers").update({
      status: accept ? "confirmed" : "rejected", confirmed_at: new Date().toISOString(), confirmed_by: ctx.user.id,
    }).eq("id", id).eq("business_id", ctx.businessId);
    if (error) return fail(error);
    await logCash(supabase, ctx.businessId, accept ? "handover_ok" : "handover_no", { id, to: to.name, amount: Number(row.amount), date: row.handed_on });
    touch();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteHandover(id: string): Promise<Result> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_DELETE);
    const { data: h } = await supabase.from("cash_handovers").select("id, handed_on, amount, status")
      .eq("id", id).eq("business_id", ctx.businessId).is("deleted_at", null).maybeSingle();
    if (!h) return { ok: false, error: L("হাতবদলটা পাওয়া যায়নি", "Handover not found") };
    const row = h as { handed_on: string; amount: number; status: string };
    if (row.status === "confirmed") {
      const lock = await verifyFinancialLock(supabase, ctx.businessId, String(row.handed_on).slice(0, 10));
      if (lock) return { ok: false, error: L(`লক করা সময়ের হাতবদল মোছা যায় না — ${lock}`, `A locked period's handover cannot be deleted — ${lock}`) };
    }
    const { error } = await supabase.from("cash_handovers").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("business_id", ctx.businessId);
    if (error) return fail(error);
    await logCash(supabase, ctx.businessId, "handover_delete", { id, amount: Number(row.amount), date: row.handed_on });
    touch();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── counting one holder's cash ──────────────────────────────────────────────

/** Write down a count of one holder's cash; the books' figure for that day is kept with it. */
export async function saveHolderCount(input: { holderId: string; date: string; amount: number; note?: string }): Promise<Result<{ gap: number }>> {
  try {
    const L = await getL();
    const { supabase, ctx } = await session();
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);
    const dateErr = validateDate(input.date, "Date");
    if (dateErr) return { ok: false, error: dateErr };
    if (input.date > todayDhaka()) return { ok: false, error: L("ভবিষ্যতের তারিখ দেওয়া যাবে না", "The date cannot be in the future") };
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: L("গোনা টাকার অঙ্ক শূন্য বা তার বেশি দিন", "Enter the counted amount (0 or more)") };
    const [acc, data] = await Promise.all([getAccountingData(supabase), loadHolderData(supabase, ctx.businessId)]);
    if (!data.enabled) return { ok: false, error: await notReady() };
    if (!data.holders.some((h) => h.id === input.holderId)) return { ok: false, error: L("একজনকে তালিকায় পাওয়া যায়নি", "A holder was not found") };
    const expected = holderBalanceOn({ rows: acc.cashLedger, openingCash: acc.openingCash, ...data }, input.holderId, input.date);
    const note = String(input.note ?? "").trim().slice(0, 300) || null;
    const { error } = await supabase.from("cash_counts").insert({ business_id: ctx.businessId, holder_id: input.holderId, counted_on: input.date, amount, expected, note });
    if (error) return fail(error);
    touch();
    return { ok: true, gap: Math.round((amount - expected) * 100) / 100 };
  } catch (e) {
    return fail(e);
  }
}
