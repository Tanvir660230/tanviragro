"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { buildProtocolEvents } from "@/lib/healthProtocol";
import { todayDhaka } from "@/lib/dates";
import { getL } from "@/i18n/server-text";
import {
  splitTotal, bestBasis, splitOnBasis, basisKey, weighInDays, purchaseWeights,
  type SplitMethod, type SplitResult, type MemberEvidence, type Basis,
} from "@/lib/cattle/cost-split";
import { loadPurchaseGroupMembers } from "@/lib/cattle/groups";

/**
 * One purchase or sale of several animals at one price. The database functions
 * (migration 20260928110000) write every row in one transaction and refuse shares that do
 * not add up to the total; the shares themselves are computed here, on the server, by
 * lib/cattle/cost-split.ts — never taken from the browser, except typed ("manual") prices.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// the new functions are not in the generated types yet
const rpc = (supabase: unknown, fn: string, args: Record<string, unknown>) =>
  (supabase as SupabaseClient<any>).rpc(fn, args);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const money = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };

async function friendly(message: string | undefined): Promise<string> {
  const L = await getL();
  const m = message ?? "";
  if (/duplicate key.*tag_id|cattle_business_id_tag_id_key/i.test(m)) return L("এই ট্যাগ আগে থেকেই আছে", "One of these tags is already used");
  if (/locked/i.test(m)) return L("এই তারিখের হিসাব লক করা আছে", "That date is in a locked period") + ` (${m})`;
  if (/Not allowed|permission denied|row-level security/i.test(m)) return L("এই কাজের অনুমতি নেই", "You are not allowed to do this");
  if (/add up to/i.test(m)) return L("ভাগগুলোর যোগফল মোট দামের সমান নয়", "The shares do not add up to the total") + ` (${m})`;
  if (/future/i.test(m)) return L("ভবিষ্যতের তারিখ দেওয়া যাবে না", "The date cannot be in the future");
  if (/already has a recorded sale|Only animals on the farm/i.test(m)) return L("একটি গরু আগেই বিক্রি হয়েছে বা খামারে নেই", "An animal is already sold or no longer on the farm");
  if (/sold before it was bought/i.test(m)) return L("কেনার আগের তারিখে বিক্রি হয় না", "An animal would be sold before it was bought");
  if (/same purchase date/i.test(m)) return L("একসাথে কেনা গরুর কেনার তারিখ একই হতে হবে", "Animals bought together must have the same purchase date");
  if (/already in a purchase group/i.test(m)) return L("একটি গরু আগেই অন্য দলে আছে", "An animal is already in a purchase group");
  return m || L("সেভ করা যায়নি", "Could not save");
}

async function splitError(r: Extract<SplitResult, { ok: false }>): Promise<string> {
  const L = await getL();
  switch (r.error) {
    case "missing_weight": return L("ওজন অনুযায়ী ভাগে প্রতিটি গরুর ওজন লাগবে", "Splitting by weight needs every animal's weight");
    case "sum_mismatch": return L(`লেখা দামগুলোর যোগফল মোট দামের চেয়ে ৳${Math.abs(r.detail ?? 0)} ${Number(r.detail) > 0 ? "কম" : "বেশি"}`, `The typed prices are ৳${Math.abs(r.detail ?? 0)} ${Number(r.detail) > 0 ? "short of" : "over"} the total`);
    case "bad_amount": return L("প্রতিটি গরুর দাম লিখুন (০ বা বেশি)", "Type a price (0 or more) for every animal");
    case "no_animals": return L("অন্তত একটি গরু দিন", "Add at least one animal");
    case "duplicate": return L("একই গরু দুবার আছে", "The same animal is listed twice");
    default: return L("মোট দাম ঠিক নয়", "The total is not valid");
  }
}

function touch(ids: string[] = []) {
  for (const id of ids) revalidatePath(`/dashboard/cattle/${id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/partners");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
}

// ── buy several at one price ────────────────────────────────────────────────

export type GroupPurchaseAnimal = {
  tagId: string;
  gender: "male" | "female";
  breed?: string;
  weightKg?: number | null;
  weightType?: "measured" | "estimated";
  /** manual split only */
  price?: number | null;
  quarantine?: boolean;
};

export type GroupPurchaseInput = {
  date: string;
  total: number;
  seller?: string;
  note?: string;
  method: SplitMethod;
  /** transport + haat fee for the whole group, split like the price */
  extraCosts?: { transport?: number; haat?: number };
  animals: GroupPurchaseAnimal[];
};

export async function createPurchaseGroup(input: GroupPurchaseInput): Promise<Result<{ groupId: string; cattleIds: string[]; shares: Record<string, number>; warning?: string }>> {
  try {
    const L = await getL();
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_CREATE);

    const total = money(input.total);
    if (!ISO.test(input.date ?? "")) return { ok: false, error: L("কেনার তারিখ দিন", "Enter the purchase date") };
    if (input.date > todayDhaka()) return { ok: false, error: L("ভবিষ্যতের তারিখ দেওয়া যাবে না", "The date cannot be in the future") };
    if (!(total > 0)) return { ok: false, error: L("মোট দাম লিখুন", "Enter the total price") };
    const animals = (input.animals ?? []).map((a) => ({ ...a, tagId: String(a.tagId ?? "").trim() }));
    if (animals.length < 1 || animals.length > 200) return { ok: false, error: L("১ থেকে ২০০টি গরু দিন", "Add 1 to 200 animals") };
    if (animals.some((a) => !a.tagId)) return { ok: false, error: L("প্রতিটি গরুর ট্যাগ দিন", "Every animal needs a tag") };
    const tags = animals.map((a) => a.tagId.toLowerCase());
    if (new Set(tags).size !== tags.length) return { ok: false, error: L("একই ট্যাগ দুবার দেওয়া হয়েছে", "A tag is repeated") };
    if (animals.some((a) => a.gender !== "male" && a.gender !== "female")) return { ok: false, error: L("লিঙ্গ বাছাই করুন", "Choose male or female") };

    const { data: taken } = await supabase.from("cattle").select("tag_id").eq("business_id", ctx.businessId).in("tag_id", animals.map((a) => a.tagId));
    if (taken?.length) return { ok: false, error: L(`এই ট্যাগ আগে থেকেই আছে: ${taken.map((t) => t.tag_id).join(", ")}`, `Already used: ${taken.map((t) => t.tag_id).join(", ")}`) };

    const keyed = animals.map((a, i) => ({ id: String(i), weightKg: a.weightKg ?? null, amount: a.price ?? null }));
    const split = splitTotal(total, keyed, input.method);
    if (!split.ok) return { ok: false, error: await splitError(split) };

    const members: MemberEvidence[] = animals.map((a, i) => ({
      id: String(i),
      initialWeightKg: Number(a.weightKg) > 0 ? Number(a.weightKg) : null,
      initialWeightType: Number(a.weightKg) > 0 ? (a.weightType === "estimated" ? "estimated" : "measured") : "unknown",
      logs: [],
    }));
    const basis = input.method === "manual" ? "manual"
      : input.method === "equal" ? "equal"
      : purchaseWeights(members)?.estimated ? "purchase_weight_estimated" : "purchase_weight";

    const payload = animals.map((a, i) => ({
      tag_id: a.tagId,
      gender: a.gender,
      breed: a.breed?.trim() || null,
      purchase_price: split.amounts[String(i)],
      initial_weight_kg: Number(a.weightKg) > 0 ? Number(a.weightKg) : 0,
      initial_weight_type: members[i].initialWeightType,
      is_quarantined: !!a.quarantine,
    }));

    const { data, error } = await rpc(supabase, "create_cattle_purchase_group", {
      p_business_id: ctx.businessId, p_purchased_on: input.date, p_total: total,
      p_seller: input.seller ?? null, p_method: input.method, p_basis: basis, p_note: input.note ?? null, p_animals: payload,
    });
    if (error || !data) return { ok: false, error: await friendly(error?.message) };
    const created = ((data as { cattle: { id: string; tag_id: string }[] }).cattle ?? []);
    const groupId = (data as { group_id: string }).group_id;
    const idByTag = new Map(created.map((c) => [c.tag_id, c.id]));
    const shares: Record<string, number> = {};
    animals.forEach((a, i) => { const id = idByTag.get(a.tagId); if (id) shares[id] = split.amounts[String(i)]; });

    // transport / haat of the whole group, split the same way as the price (by each share)
    const problems: string[] = [];
    const extra = [
      { amount: money(input.extraCosts?.transport ?? 0), category: "transport", description: "Transport cost during acquisition (group)" },
      { amount: money(input.extraCosts?.haat ?? 0), category: "haat_hasil", description: "Market tax / Hasil fee during acquisition (group)" },
    ].filter((e) => e.amount > 0);
    if (extra.length) {
      const ids = Object.keys(shares);
      const rows = [];
      for (const e of extra) {
        const part = total > 0
          ? splitTotal(e.amount, ids.map((id) => ({ id, weightKg: shares[id] || 0.0001 })), "weight")
          : splitTotal(e.amount, ids.map((id) => ({ id })), "equal");
        if (!part.ok) continue;
        for (const id of ids) {
          if (part.amounts[id] > 0) rows.push({
            business_id: ctx.businessId, cattle_id: id, type: "variable" as const, category: e.category,
            amount: part.amounts[id], description: e.description, recorded_at: input.date,
          });
        }
      }
      if (rows.length) {
        const { error: costErr } = await supabase.from("cost_entries").insert(rows);
        if (costErr) problems.push(L("পরিবহন / হাসিল খরচ সেভ হয়নি", "Transport / haat costs were not saved"));
      }
    }

    // the usual vaccine / deworming plan for each new animal
    const events = created.flatMap((c) => buildProtocolEvents(c.id, ctx.businessId, input.date));
    if (events.length) {
      const { error: evErr } = await supabase.from("health_events").insert(events);
      if (evErr) problems.push(L("টিকার পরিকল্পনা সেভ হয়নি", "The vaccine plan was not saved"));
    }

    touch(created.map((c) => c.id));
    const warning = problems.length ? L("গরুগুলো যোগ হয়েছে, কিন্তু: ", "The animals were added, but: ") + problems.join("; ") : undefined;
    return { ok: true, groupId, cattleIds: created.map((c) => c.id), shares, warning };
  } catch (e) {
    return { ok: false, error: await friendly(e instanceof Error ? e.message : undefined) };
  }
}

// ── re-split a purchase group ───────────────────────────────────────────────

export type ResplitChoice =
  | { kind: "best" }
  | { kind: "equal" }
  | { kind: "weigh_in"; date: string }
  | { kind: "purchase_weight" }
  | { kind: "manual"; amounts: Record<string, number> };

/** The basis a choice means for this group now (the server re-reads the weights). */
function basisFor(choice: ResplitChoice, members: MemberEvidence[], purchasedOn: string): Basis | "manual" | null {
  if (choice.kind === "manual") return "manual";
  if (choice.kind === "best") return bestBasis(members, purchasedOn);
  if (choice.kind === "equal") return { kind: "equal", method: "equal", provisional: true };
  if (choice.kind === "purchase_weight") {
    const w = purchaseWeights(members);
    return w ? { kind: "purchase_weight", method: "weight", estimated: w.estimated, weights: w.weights } : null;
  }
  const day = weighInDays(members).find((d) => d.date === choice.date);
  return day ? { kind: "weigh_in", method: "weight", date: day.date, weights: day.weights } : null;
}

export async function resplitPurchaseGroup(groupId: string, choice: ResplitChoice): Promise<Result<{ shares: Record<string, number> }>> {
  try {
    const L = await getL();
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    const group = await loadPurchaseGroupMembers(supabase, ctx.businessId, { groupId });
    if (!group) return { ok: false, error: L("দলটি পাওয়া যায়নি", "Purchase group not found") };
    const ids = group.members.map((m) => m.id);
    const basis = basisFor(choice, group.evidence, group.purchasedOn);
    if (!basis) return { ok: false, error: L("এই ভাগের জন্য সব গরুর ওজন নেই", "Not every animal has a weight for this split") };

    const split = basis === "manual"
      ? splitTotal(group.total, ids.map((id) => ({ id, amount: (choice as { amounts: Record<string, number> }).amounts?.[id] })), "manual")
      : splitOnBasis(group.total, ids, basis);
    if (!split.ok) return { ok: false, error: await splitError(split) };

    const { error } = await rpc(supabase, "allocate_cattle_purchase_group", {
      p_group_id: groupId,
      p_method: basis === "manual" ? "manual" : basis.method,
      p_basis: basis === "manual" ? "manual" : basisKey(basis),
      p_shares: split.amounts,
    });
    if (error) return { ok: false, error: await friendly(error.message) };
    touch(ids);
    return { ok: true, shares: split.amounts };
  } catch (e) {
    return { ok: false, error: await friendly(e instanceof Error ? e.message : undefined) };
  }
}

// ── animals already on record, bought together ─────────────────────────────

export async function linkPurchaseGroup(input: {
  cattleIds: string[]; total: number; seller?: string; choice: ResplitChoice;
}): Promise<Result<{ groupId: string; shares: Record<string, number> }>> {
  try {
    const L = await getL();
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    const ids = [...new Set(input.cattleIds ?? [])];
    if (ids.length < 2) return { ok: false, error: L("অন্তত দুটি গরু বাছুন", "Choose at least two animals") };
    const total = money(input.total);
    if (!(total > 0)) return { ok: false, error: L("মোট দাম লিখুন", "Enter the total price") };

    const group = await loadPurchaseGroupMembers(supabase, ctx.businessId, { cattleIds: ids });
    if (!group || group.members.length !== ids.length) return { ok: false, error: L("একটি গরু পাওয়া যায়নি", "An animal was not found") };
    const basis = basisFor(input.choice, group.evidence, group.purchasedOn);
    if (!basis) return { ok: false, error: L("এই ভাগের জন্য সব গরুর ওজন নেই", "Not every animal has a weight for this split") };
    const split = basis === "manual"
      ? splitTotal(total, ids.map((id) => ({ id, amount: (input.choice as { amounts: Record<string, number> }).amounts?.[id] })), "manual")
      : splitOnBasis(total, ids, basis);
    if (!split.ok) return { ok: false, error: await splitError(split) };

    const { data, error } = await rpc(supabase, "link_cattle_purchase_group", {
      p_business_id: ctx.businessId, p_cattle_ids: ids, p_total: total, p_seller: input.seller ?? null,
      p_method: basis === "manual" ? "manual" : basis.method, p_basis: basis === "manual" ? "manual" : basisKey(basis),
      p_note: null, p_shares: split.amounts,
    });
    if (error || !data) return { ok: false, error: await friendly(error?.message) };
    touch(ids);
    return { ok: true, groupId: String(data), shares: split.amounts };
  } catch (e) {
    return { ok: false, error: await friendly(e instanceof Error ? e.message : undefined) };
  }
}

// ── sell several at one price ────────────────────────────────────────────────

export type GroupSaleInput = {
  date: string;
  total: number;
  buyer?: string;
  note?: string;
  method: SplitMethod;
  lines: { cattleId: string; weightKg?: number | null; price?: number | null }[];
};

export async function sellCattleGroup(input: GroupSaleInput): Promise<Result<{ groupId: string; shares: Record<string, number> }>> {
  try {
    const L = await getL();
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_SELL);

    if (!ISO.test(input.date ?? "")) return { ok: false, error: L("বিক্রির তারিখ দিন", "Enter the sale date") };
    if (input.date > todayDhaka()) return { ok: false, error: L("ভবিষ্যতের তারিখ দেওয়া যাবে না", "The date cannot be in the future") };
    const total = money(input.total);
    if (!(total > 0)) return { ok: false, error: L("মোট বিক্রির দাম লিখুন", "Enter the total sale price") };
    const lines = input.lines ?? [];
    if (lines.some((l) => l.weightKg != null && !(Number(l.weightKg) > 0))) return { ok: false, error: L("ওজন ০-এর বেশি হতে হবে", "A weight must be above 0") };

    const split = splitTotal(total, lines.map((l) => ({ id: l.cattleId, weightKg: l.weightKg ?? null, amount: l.price ?? null })), input.method);
    if (!split.ok) return { ok: false, error: await splitError(split) };

    const { data, error } = await rpc(supabase, "sell_cattle_group", {
      p_business_id: ctx.businessId, p_sold_on: input.date, p_total: total, p_buyer: input.buyer ?? null,
      p_method: input.method, p_note: input.note ?? null,
      p_lines: lines.map((l) => ({ cattle_id: l.cattleId, weight_kg: Number(l.weightKg) > 0 ? Number(l.weightKg) : null, price: split.amounts[l.cattleId] })),
    });
    if (error || !data) return { ok: false, error: await friendly(error?.message) };
    touch(lines.map((l) => l.cattleId));
    return { ok: true, groupId: String(data), shares: split.amounts };
  } catch (e) {
    return { ok: false, error: await friendly(e instanceof Error ? e.message : undefined) };
  }
}

export async function revertSaleGroup(groupId: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_SELL);
    const { data: rows } = await (supabase as SupabaseClient<any>).from("sales").select("cattle_id").eq("sale_group_id", groupId).is("deleted_at", null);
    const { error } = await rpc(supabase, "revert_cattle_sale_group", { p_group_id: groupId });
    if (error) return { ok: false, error: await friendly(error.message) };
    touch(((rows ?? []) as { cattle_id: string }[]).map((r) => r.cattle_id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: await friendly(e instanceof Error ? e.message : undefined) };
  }
}
