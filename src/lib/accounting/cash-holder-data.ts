import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "@/lib/supabase/select-all";
import { isHolderKind, type CashHolder, type Handover, type HandoverStatus, type TagPart } from "@/lib/accounting/cash-holders";

/**
 * Reads and writes of the cash-holder tables (migration 20261014090000). Before that migration the
 * tables are missing: reads say "not enabled" and the holder view and pickers hide; writes are skipped.
 */
type Client = SupabaseClient<any>;

export const missingTable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

export type HolderData =
  | { enabled: false }
  | { enabled: true; holders: CashHolder[]; tags: Record<string, TagPart[]>; handovers: Handover[] };

type HolderDb = { id: string; name: string; kind: string; partner_id: string | null; user_id: string | null; archived_at: string | null };

export async function loadHolderList(supabase: Client, businessId: string): Promise<CashHolder[] | null> {
  const { data, error } = await supabase.from("cash_holders").select("id, name, kind, partner_id, user_id, archived_at")
    .eq("business_id", businessId).order("sort_order").order("created_at");
  if (missingTable(error)) return null;
  if (error) throw new Error(`cash holders: ${error.message}`);
  return ((data ?? []) as HolderDb[]).map((h) => ({
    id: h.id, name: h.name, kind: isHolderKind(h.kind) ? h.kind : "person", partnerId: h.partner_id, userId: h.user_id, archived: !!h.archived_at,
  }));
}

type TagDb = { row_key: string; holder_id: string; amount: number | string | null };
const groupTags = (rows: TagDb[]): Record<string, TagPart[]> => {
  const out: Record<string, TagPart[]> = {};
  for (const t of rows) (out[t.row_key] ??= []).push({ holderId: t.holder_id, amount: t.amount == null ? null : Number(t.amount) });
  return out;
};

export async function loadHolderData(supabase: Client, businessId: string): Promise<HolderData> {
  const holders = await loadHolderList(supabase, businessId);
  if (!holders) return { enabled: false };
  const [tags, handovers] = await Promise.all([
    selectAll(() => supabase.from("cash_holder_tags").select("row_key, holder_id, amount").eq("business_id", businessId).order("id")),
    selectAll(() => supabase.from("cash_handovers").select("id, handed_on, from_holder, to_holder, amount, note, status")
      .eq("business_id", businessId).is("deleted_at", null).order("id")),
  ]);
  return {
    enabled: true,
    holders,
    tags: groupTags(tags as TagDb[]),
    handovers: (handovers as { id: string; handed_on: string; from_holder: string; to_holder: string; amount: number | string; note: string | null; status: string }[])
      .map((h) => ({ id: h.id, date: String(h.handed_on).slice(0, 10), fromId: h.from_holder, toId: h.to_holder, amount: Number(h.amount), note: h.note,
        status: (h.status === "pending" || h.status === "rejected" ? h.status : "confirmed") as HandoverStatus })),
  };
}

/** The parts already given for these rows (a corrected row keeps its holder). */
export async function tagsOf(supabase: Client, businessId: string, keys: string[]): Promise<Record<string, TagPart[]>> {
  const ids = [...new Set(keys.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase.from("cash_holder_tags").select("row_key, holder_id, amount").eq("business_id", businessId).in("row_key", ids);
  if (error) return {};
  return groupTags((data ?? []) as TagDb[]);
}

/** The holder who has a row whole (or the biggest part of it), if any. */
export const mainHolder = (parts: TagPart[] | undefined): string | null =>
  !parts?.length ? null : (parts.find((p) => p.amount == null) ?? [...parts].sort((a, b) => Number(b.amount) - Number(a.amount))[0]).holderId;

/**
 * Give these cash rows (ids as in the cash ledger) whole to one holder, replacing any earlier parts.
 * Never blocks the record it belongs to: a failure comes back as a message, and the row stays
 * "not yet said" for later.
 */
export async function tagCashRows(supabase: Client, businessId: string, keys: string[], holderId: string | null | undefined): Promise<string | null> {
  const ids = [...new Set(keys.filter(Boolean))];
  if (!holderId || !ids.length) return null;
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i += 300) {
    const part = ids.slice(i, i + 300);
    const del = await supabase.from("cash_holder_tags").delete().eq("business_id", businessId).in("row_key", part);
    if (del.error) return missingTable(del.error) ? null : del.error.message;
    const { error } = await supabase.from("cash_holder_tags")
      .insert(part.map((row_key) => ({ business_id: businessId, row_key, holder_id: holderId, amount: null, updated_at: now })));
    if (error) return missingTable(error) ? null : error.message;
  }
  return null;
}

/**
 * Add `delta` taka to one holder's part of a row (each memo bought on credit adds its due to the
 * supplier's running due row; a corrected memo moves it by the difference). A holder who has the row
 * whole keeps it whole; a part that reaches zero is removed.
 */
export async function addTagPart(supabase: Client, businessId: string, key: string, holderId: string | null | undefined, delta: number): Promise<string | null> {
  if (!holderId || !key || !Number.isFinite(delta) || Math.abs(delta) < 0.005) return null;
  const { data, error } = await supabase.from("cash_holder_tags").select("amount")
    .eq("business_id", businessId).eq("row_key", key).eq("holder_id", holderId).maybeSingle();
  if (error) return missingTable(error) ? null : error.message;
  const now = new Date().toISOString();
  if (data) {
    const cur = (data as { amount: number | string | null }).amount;
    if (cur == null) return null;
    const next = Math.round((Number(cur) + delta) * 100) / 100;
    const res = next > 0.004
      ? await supabase.from("cash_holder_tags").update({ amount: next, updated_at: now }).eq("business_id", businessId).eq("row_key", key).eq("holder_id", holderId)
      : await supabase.from("cash_holder_tags").delete().eq("business_id", businessId).eq("row_key", key).eq("holder_id", holderId);
    return res.error?.message ?? null;
  }
  if (delta <= 0) return null;
  const ins = await supabase.from("cash_holder_tags").insert({ business_id: businessId, row_key: key, holder_id: holderId, amount: Math.round(delta * 100) / 100, updated_at: now });
  return ins.error?.message ?? null;
}

/** One line in the change log (who changed whose money, and how). Best effort: never blocks. */
export async function logCash(supabase: Client, businessId: string, action: string, detail: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from("cash_holder_log").insert({ business_id: businessId, action: action.slice(0, 40), detail });
  } catch { /* the change itself is saved; only its note is missing */ }
}

/** The holder id from a form, or null ("" / "none" = not said). */
export function holderFromForm(v: FormDataEntryValue | string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

/** A user-facing note when a holder could not be saved with a record (the record itself is saved). */
export const TAG_WARNING = {
  bn: "সেভ হয়েছে, কিন্তু টাকা কার — সেটা লেখা যায়নি। টাকা-পয়সা → কার কাছে টাকা থেকে বলে দিন।",
  en: "Saved, but whose cash it was could not be saved. Set it under Money → Who has the cash.",
};
