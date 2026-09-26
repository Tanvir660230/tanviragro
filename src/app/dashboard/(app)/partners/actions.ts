"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { FinancialEventBus } from "@/lib/financial/events";
import { PartnerEngine } from "@/lib/partners/partner-engine";
import { loadPartnerData, PREVIEW_CYCLE_ID } from "@/lib/partners/load-positions";
import type { Partner, PartnerTransactionType, PartnerType } from "@/types/database";
import { checkRule, termsOn, type PositionPartner } from "@/lib/partners/position";
import { todayDhaka } from "@/lib/dates";

export type PartnerFormState = { error?: string; success?: boolean } | undefined;

const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function lockedUntil(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string): Promise<string | null> {
  const { data } = await supabase.from("financial_locks").select("locked_until").eq("business_id", businessId)
    .order("locked_until", { ascending: false }).limit(1).maybeSingle();
  return data?.locked_until ? String(data.locked_until).slice(0, 10) : null;
}

/** Partners and rules as the calculation sees them (for checking a planned change). */
async function loadRuleContext(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string) {
  const [{ data: ps }, rulesRes] = await Promise.all([
    supabase.from("partners").select("*").eq("business_id", businessId).is("deleted_at", null),
    supabase.from("partner_share_rules").select("id, partner_id, effective_from, share_mode, fixed_pct, bears_loss").eq("business_id", businessId).is("deleted_at", null),
  ]);
  if (rulesRes.error) {
    if (isMissingTable(rulesRes.error)) throw new Error("ভাগের নিয়মের টেবিল এখনো তৈরি হয়নি (migration 20260927090000 চালাতে হবে)।");
    throw new Error(rulesRes.error.message);
  }
  const partners: PositionPartner[] = ((ps ?? []) as (Partner & { left_at?: string | null })[]).map((p) => ({
    id: p.id, name: p.name, partnerType: p.partner_type ?? "capital", joinedAt: String(p.joined_at).slice(0, 10),
    leftAt: p.left_at ? String(p.left_at).slice(0, 10) : null, laborValueMonthly: p.labor_value_monthly, cliffMonths: p.cliff_months ?? 0,
    shareMode: p.share_mode === "manual" ? "manual" : "auto", fixedPct: Number(p.profit_share_pct ?? 0), bearsLoss: p.bears_loss !== false,
  }));
  const rules = ((rulesRes.data ?? []) as { id: string; partner_id: string; effective_from: string; share_mode: string; fixed_pct: number; bears_loss: boolean }[])
    .map((r) => ({ id: r.id, partnerId: r.partner_id, from: String(r.effective_from).slice(0, 10), shareMode: (r.share_mode === "manual" ? "manual" : "auto") as "auto" | "manual", fixedPct: Number(r.fixed_pct), bearsLoss: !!r.bears_loss }));
  return { partners, rules };
}

/** Keep the partner row's own share fields equal to the rule in force today (older screens read them). */
async function syncPartnerRow(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string, partnerId: string) {
  const { partners, rules } = await loadRuleContext(supabase, businessId);
  const t = termsOn(partners, rules, todayDhaka())[partnerId];
  if (!t) return;
  await supabase.from("partners").update({ share_mode: t.shareMode, profit_share_pct: t.shareMode === "manual" ? t.fixedPct : 0, bears_loss: t.bearsLoss }).eq("id", partnerId);
}

/**
 * Add or change a partner's share from a date: fixed % of profit or taka × days, and whether they
 * bear loss. Applies from `effective_from` until their next rule; earlier days keep the rule that
 * was in force. Checked: not inside locked books, fixed shares never above 100% on any day.
 */
export async function saveShareRule(input: {
  partnerId: string; effectiveFrom: string; shareMode: "auto" | "manual"; fixedPct: number; bearsLoss: boolean; note?: string;
}): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    await assertResourceOwnership(supabase, "partners", input.partnerId, ctx.businessId);

    const from = String(input.effectiveFrom ?? "").slice(0, 10);
    if (!ISO.test(from)) return { error: "কবে থেকে — তারিখ দিন" };
    const shareMode: "auto" | "manual" = input.shareMode === "manual" ? "manual" : "auto";
    const fixedPct = shareMode === "manual" ? Math.round(Number(input.fixedPct) * 1000) / 1000 : 0;
    if (shareMode === "manual" && !(fixedPct >= 0 && fixedPct <= 100)) return { error: "ভাগ ০% থেকে ১০০%-এর মধ্যে দিন" };

    const lock = await lockedUntil(supabase, ctx.businessId);
    if (lock && from <= lock) return { error: `হিসাব ${lock} পর্যন্ত বন্ধ (লাভ বণ্টন বা লক) — নতুন নিয়ম ${lock}-এর পরের তারিখ থেকে দিন।` };

    const { partners, rules } = await loadRuleContext(supabase, ctx.businessId);
    const partner = partners.find((p) => p.id === input.partnerId);
    if (!partner) return { error: "অংশীদার পাওয়া যায়নি" };
    if (from < partner.joinedAt) return { error: `অংশীদার ${partner.joinedAt}-এ যোগ দিয়েছেন — এর আগের তারিখ দেওয়া যাবে না।` };
    const bearsLoss = partner.partnerType === "labor" ? false : !!input.bearsLoss;
    const problem = checkRule(partners, rules, { partnerId: input.partnerId, from, shareMode, fixedPct, bearsLoss });
    if (problem) return { error: problem.replace(/^On (\S+) the fixed shares would add up to (\S+)% \(more than 100%\)$/, "$1 তারিখে নির্দিষ্ট ভাগগুলোর যোগফল $2% হয়ে যাবে (১০০%-এর বেশি)।") };

    const same = rules.find((r) => r.partnerId === input.partnerId && r.from === from);
    const row = { share_mode: shareMode, fixed_pct: fixedPct, bears_loss: bearsLoss, note: input.note?.trim() || null };
    const { error } = same
      ? await supabase.from("partner_share_rules").update(row).eq("id", same.id)
      : await supabase.from("partner_share_rules").insert({ ...row, business_id: ctx.businessId, partner_id: input.partnerId, effective_from: from });
    if (error) return { error: isMissingTable(error) ? "ভাগের নিয়মের টেবিল এখনো তৈরি হয়নি (migration চালাতে হবে)।" : "নিয়ম সেভ হয়নি" };

    await syncPartnerRow(supabase, ctx.businessId, input.partnerId);
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${input.partnerId}`);
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "নিয়ম সেভ হয়নি" };
  }
}

/** Remove a share rule that has not become part of locked books; the first rule always stays. */
export async function deleteShareRule(ruleId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    const { data: rule } = await supabase.from("partner_share_rules").select("id, partner_id, effective_from, business_id").eq("id", ruleId).is("deleted_at", null).maybeSingle();
    if (!rule || rule.business_id !== ctx.businessId) return { error: "নিয়ম পাওয়া যায়নি" };
    const from = String(rule.effective_from).slice(0, 10);
    const lock = await lockedUntil(supabase, ctx.businessId);
    if (lock && from <= lock) return { error: `এই নিয়ম ${lock} পর্যন্ত বন্ধ হিসাবের অংশ — মোছা যাবে না।` };
    const { partners, rules } = await loadRuleContext(supabase, ctx.businessId);
    const mine = rules.filter((r) => r.partnerId === rule.partner_id).sort((a, b) => a.from.localeCompare(b.from));
    if (mine[0]?.id === rule.id) return { error: "প্রথম নিয়ম (যোগ দেওয়ার দিনের) মোছা যায় না — বদলাতে চাইলে নতুন নিয়ম দিন।" };
    // after removing, the previous rule runs on: it must still fit under 100% on every day
    const prev = mine.filter((r) => r.from < from).at(-1);
    const rest = rules.filter((r) => r.id !== rule.id);
    if (prev) {
      const problem = checkRule(partners, rest, prev);
      if (problem) return { error: "এই নিয়ম মুছলে কোনো দিন নির্দিষ্ট ভাগের যোগফল ১০০%-এর বেশি হয়ে যাবে।" };
    }
    const { error } = await supabase.from("partner_share_rules").update({ deleted_at: new Date().toISOString() }).eq("id", ruleId);
    if (error) return { error: "মোছা যায়নি" };
    await syncPartnerRow(supabase, ctx.businessId, rule.partner_id);
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${rule.partner_id}`);
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "মোছা যায়নি" };
  }
}

/** A partner leaves on `date`: no share from that day; their history stays. `date = null` brings them back. */
export async function retirePartner(partnerId: string, date: string | null): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    await assertResourceOwnership(supabase, "partners", partnerId, ctx.businessId);
    const d = date ? String(date).slice(0, 10) : null;
    if (d && !ISO.test(d)) return { error: "তারিখ দিন" };
    const lock = await lockedUntil(supabase, ctx.businessId);
    if (lock && d && d <= lock) return { error: `হিসাব ${lock} পর্যন্ত বন্ধ — এর পরের তারিখ দিন।` };
    const { error } = await supabase.from("partners").update({ left_at: d }).eq("id", partnerId);
    if (error) return { error: isMissingTable(error) || /left_at/.test(error.message) ? "অবসরের ঘর এখনো তৈরি হয়নি (migration চালাতে হবে)।" : "সেভ হয়নি" };
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${partnerId}`);
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "সেভ হয়নি" };
  }
}

export async function createPartner(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    const name = (formData.get("name") as string)?.trim();
    const partnerType = (formData.get("partner_type") as PartnerType) || "capital";
    const shareMode = (formData.get("share_mode") as string) === "manual" ? "manual" : "auto";
    const investmentAmount = parseFloat(formData.get("investment_amount") as string) || 0;
    const rawProfitShare = parseFloat(formData.get("profit_share_pct") as string);
    const profitSharePct = shareMode === "manual" && !isNaN(rawProfitShare) ? rawProfitShare : 0;
    const laborValueMonthly = parseFloat(formData.get("labor_value_monthly") as string) || null;
    const cliffMonths = parseInt(formData.get("cliff_months") as string, 10) || 0;
    const joinedAt = (formData.get("joined_at") as string) || todayDhaka();
    const notes = (formData.get("notes") as string)?.trim() || null;
    // a labour partner never bears loss; the others as ticked (the box was never saved before)
    const bearsLoss = partnerType === "labor" ? false : formData.get("bears_loss") === "true";

    const { data: existingPartners } = await supabase
      .from("partners")
      .select("*")
      .eq("business_id", ctx.businessId)
      .is("deleted_at", null);

    const validation = PartnerEngine.validatePartner({
      name,
      partnerType,
      shareMode,
      profitSharePct,
      existingPartners: existingPartners ?? [],
    });

    if (!validation.isValid) {
      return { error: validation.errors[0] };
    }

    const { data: newPartner, error } = await supabase.from("partners").insert({
      business_id: ctx.businessId,
      name,
      partner_type: partnerType,
      investment_amount: investmentAmount,
      profit_share_pct: profitSharePct,
      share_mode: shareMode,
      labor_value_monthly: laborValueMonthly,
      cliff_months: cliffMonths,
      joined_at: joinedAt,
      bears_loss: bearsLoss,
      notes,
    }).select("id, name, partner_type").single();

    if (error || !newPartner) return { error: "সংরক্ষণ ব্যর্থ হয়েছে" };

    // the partner's first share rule, from the day they join (later changes are new rules)
    const { error: ruleErr } = await supabase.from("partner_share_rules").insert({
      business_id: ctx.businessId, partner_id: newPartner.id, effective_from: joinedAt,
      share_mode: shareMode, fixed_pct: shareMode === "manual" ? profitSharePct : 0, bears_loss: bearsLoss,
      note: "যোগ দেওয়ার সময়ের নিয়ম",
    });
    if (ruleErr && !isMissingTable(ruleErr)) return { error: "ভাগের নিয়ম সেভ হয়নি" };

    if (investmentAmount > 0) {
      await verifyFinancialLock(supabase, ctx.businessId, joinedAt);

      const { data: txn, error: txnErr } = await supabase
        .from("partner_transactions")
        .insert({
          partner_id: newPartner.id,
          amount: investmentAmount,
          type: "investment",
          recorded_at: joinedAt,
          notes: "প্রাথমিক বিনিয়োগ",
        })
        .select("id")
        .single();

      if (!txnErr && txn) {
        await FinancialEventBus.publish("PartnerInvestment", ctx.businessId, {
          partnerId: newPartner.id,
          partnerName: newPartner.name,
          transactionId: txn.id,
          amount: investmentAmount,
          recordedAt: joinedAt,
        }, ctx.user.id);
      }
    }

    await FinancialEventBus.publish("PartnerCreated", ctx.businessId, {
      partnerId: newPartner.id,
      name: newPartner.name,
      partnerType: newPartner.partner_type,
    }, ctx.user.id);

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create partner" };
  }
}


export async function updatePartner(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    const partnerId = formData.get("partner_id") as string;
    if (!partnerId) return { error: "Partner ID missing" };

    await assertResourceOwnership(supabase, "partners", partnerId, ctx.businessId);

    // The share (fixed % / taka × days) and loss bearing are dated share rules (saveShareRule);
    // this form changes the partner's details only.
    const name = (formData.get("name") as string)?.trim();
    if (!name) return { error: "নাম দিন" };
    const partnerType = (formData.get("partner_type") as PartnerType) || "capital";
    const laborValueMonthly = parseFloat(formData.get("labor_value_monthly") as string) || null;
    const cliffMonths = parseInt(formData.get("cliff_months") as string, 10) || 0;
    const joinedAt = ((formData.get("joined_at") as string) || "").slice(0, 10);
    const notes = (formData.get("notes") as string)?.trim() || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) return { error: "যোগদানের তারিখ দিন" };

    const { data: before } = await supabase.from("partners").select("joined_at").eq("id", partnerId).maybeSingle();
    const oldJoined = before?.joined_at ? String(before.joined_at).slice(0, 10) : null;

    const { error } = await supabase.from("partners").update({
      name,
      partner_type: partnerType,
      labor_value_monthly: partnerType === "capital" ? null : laborValueMonthly,
      cliff_months: cliffMonths,
      joined_at: joinedAt,
      notes,
    }).eq("id", partnerId);

    if (error) return { error: "আপডেট ব্যর্থ হয়েছে" };

    // the first share rule starts on the join date: move it with the join date
    if (oldJoined && oldJoined !== joinedAt) {
      const { error: moveErr } = await supabase.from("partner_share_rules").update({ effective_from: joinedAt })
        .eq("partner_id", partnerId).eq("effective_from", oldJoined).is("deleted_at", null);
      if (moveErr && !isMissingTable(moveErr)) return { error: "ভাগের প্রথম নিয়মের তারিখ বদলানো যায়নি" };
    }

    await FinancialEventBus.publish("PartnerUpdated", ctx.businessId, { partnerId, name, partnerType }, ctx.user.id);

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update partner" };
  }
}

export async function deletePartner(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    await assertResourceOwnership(supabase, "partners", id, ctx.businessId);

    // a partner with money history is never removed: their share of past results would move to
    // the others. They retire instead (retirePartner) and stay in the books.
    const { count } = await supabase.from("partner_transactions").select("id", { count: "exact", head: true })
      .eq("partner_id", id).is("deleted_at", null);
    if ((count ?? 0) > 0) {
      return { error: "এই অংশীদারের লেনদেন আছে — মুছলে অতীতের লাভ-ক্ষতির ভাগ বদলে যাবে। মুছবেন না, \"অবসর\" দিন।" };
    }

    const { error } = await supabase
      .from("partners")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: "মুছতে ব্যর্থ হয়েছে" };

    await FinancialEventBus.publish("PartnerArchived", ctx.businessId, {
      partnerId: id,
    }, ctx.user.id);

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete partner" };
  }
}

export type PartnerTxnState = { error?: string; success?: boolean; needsConfirm?: boolean } | undefined;

const MONEY_TYPES = ["investment", "withdrawal", "advance", "loan_in", "loan_repay"] as const;
type MoneyType = (typeof MONEY_TYPES)[number];

/**
 * One partner entry: capital in or out, a profit advance (any time, any amount — it comes off the
 * next profit), or a loan to the farm and its repayment. Profit payouts go through
 * declareDistribution only. Checked against the partner's dates, their account and the farm's cash;
 * going beyond the account or the cash needs a confirmation and a note.
 */
export async function addPartnerTransaction(
  _prev: PartnerTxnState,
  formData: FormData
): Promise<PartnerTxnState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    const partnerId = formData.get("partner_id") as string;
    const amount = Math.round(parseFloat(formData.get("amount") as string) * 100) / 100;
    const rawType = formData.get("type") as string === "draw" ? "withdrawal" : (formData.get("type") as string);
    const recordedAt = ((formData.get("recorded_at") as string) || todayDhaka()).slice(0, 10);
    const notes = (formData.get("notes") as string)?.trim() || null;
    const confirmed = formData.get("confirm") === "1";

    if (!(MONEY_TYPES as readonly string[]).includes(rawType)) {
      return { error: "এই ধরনের লেনদেন এখানে লেখা যায় না (লাভ দিতে \"লাভ বণ্টন\" ব্যবহার করুন)।" };
    }
    const type = rawType as MoneyType;
    const validation = PartnerEngine.validateTransaction({ partnerId, type: type === "advance" || type === "loan_in" || type === "loan_repay" ? "investment" : type, amount, recordedAt });
    if (!validation.isValid) return { error: validation.errors[0] };
    if (recordedAt > todayDhaka()) return { error: "ভবিষ্যতের তারিখ দেওয়া যাবে না" };

    await assertResourceOwnership(supabase, "partners", partnerId, ctx.businessId);
    await verifyFinancialLock(supabase, ctx.businessId, recordedAt);

    const data = await loadPartnerData(supabase, ctx.businessId);
    if (!data.cyclesEnabled && type !== "investment" && type !== "withdrawal") {
      return { error: "অগ্রিম ও ধার লেখা যাবে database আপডেটের পরে (migration 20260927100000)।" };
    }
    const partner = data.positionPartners.find((p) => p.id === partnerId);
    const pos = data.positions.find((p) => p.id === partnerId);
    if (!partner || !pos) return { error: "অংশীদার পাওয়া যায়নি" };

    // dates: money comes in only after joining; after leaving only money going back
    if ((type === "investment" || type === "loan_in") && recordedAt < partner.joinedAt) {
      return { error: `${partner.name} ${partner.joinedAt}-এ যোগ দিয়েছেন — এর আগের তারিখে জমা লেখা যাবে না।` };
    }
    if (partner.leftAt && recordedAt >= partner.leftAt && (type === "investment" || type === "loan_in" || type === "advance")) {
      return { error: `${partner.name} ${partner.leftAt} থেকে অবসরে — এখন শুধু টাকা ফেরত (তোলা বা ধার ফেরত) লেখা যায়।` };
    }
    if (type === "loan_repay" && amount > pos.loanBalance + 0.005) {
      return { error: `খামারের কাছে ${partner.name}-এর ধার ৳${Math.round(pos.loanBalance).toLocaleString("en-IN")} — এর বেশি ফেরত লেখা যাবে না।` };
    }

    // money going out: the partner's account and the farm's cash
    if (type === "withdrawal" || type === "advance" || type === "loan_repay") {
      const warnings: string[] = [];
      if (type === "withdrawal" && amount > pos.withdrawable + 0.5) {
        warnings.push(`${partner.name}-এর তোলার মতো পাওনা ৳${Math.round(pos.withdrawable).toLocaleString("en-IN")} (মূলধন + পাকা লাভ − আগে নেওয়া)`);
      }
      if (amount > data.cash + 0.5) warnings.push(`খামারের নগদ এখন ৳${Math.round(data.cash).toLocaleString("en-IN")}`);
      if (warnings.length && !confirmed) {
        return { needsConfirm: true, error: `${warnings.join("; ")}। তবুও লিখতে চাইলে কারণ লিখে নিশ্চিত করুন।` };
      }
      if (warnings.length && !notes) return { needsConfirm: true, error: "বেশি টাকা নেওয়ার কারণ নোটে লিখুন।" };
    }

    const { data: insertedTxn, error } = await supabase
      .from("partner_transactions")
      .insert({ partner_id: partnerId, amount, type, recorded_at: recordedAt, notes })
      .select("id")
      .single();
    if (error || !insertedTxn) {
      return { error: /invalid input value for enum/i.test(error?.message ?? "") ? "এই ধরন database-এ এখনো নেই (migration 20260927100000 চালাতে হবে)।" : "সংরক্ষণ ব্যর্থ হয়েছে" };
    }

    const event = type === "investment" ? "PartnerInvestment" : type === "withdrawal" ? "PartnerWithdrawal" : null;
    if (event) await FinancialEventBus.publish(event, ctx.businessId, { partnerId, transactionId: insertedTxn.id, amount, recordedAt }, ctx.user.id);

    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${partnerId}`);
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record transaction" };
  }
}

export const recordPartnerTransaction = addPartnerTransaction;

export type DeclareDistributionPayload = {
  totalAmount: number;
  date: string;
  isLoss: boolean;
  entries: { partnerId: string; amount: number }[];
  /** lock the books up to the payout day so a back-dated entry cannot change what was paid */
  lockBooks?: boolean;
};

export async function declareDistribution(
  payload: DeclareDistributionPayload
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_DIVIDEND);

    const { totalAmount, date, isLoss, entries } = payload;

    if (!date) return { error: "তারিখ দিন" };
    if (!Number.isFinite(totalAmount) || totalAmount <= 0)
      return { error: "বৈধ পরিমাণ দিন" };
    if (!entries.length) return { error: "কোনো অংশীদার নেই" };

    await verifyFinancialLock(supabase, ctx.businessId, date);

    const partnerIds = entries.map((e) => e.partnerId);
    const { data: partnerRows } = await supabase
      .from("partners")
      .select("id, business_id")
      .in("id", partnerIds)
      .is("deleted_at", null);

    const allOwned = (partnerRows ?? []).every(
      (p: { business_id: string }) => p.business_id === ctx.businessId
    );
    if ((partnerRows ?? []).length !== partnerIds.length || !allOwned)
      return { error: "Unauthorized or invalid partners" };

    if (entries.some((e) => !Number.isFinite(e.amount) || e.amount <= 0))
      return { error: "প্রতিটি অংশীদারের পরিমাণ শূন্যের বেশি হতে হবে।" };

    const entrySum = entries.reduce((s, e) => s + e.amount, 0);
    if (Math.abs(entrySum - totalAmount) > 1)
      return { error: "অংশীদারদের যোগফল মোট পরিমাণের সাথে মিলছে না।" };

    // A loss is not "distributed": each partner's share of it is live (lib/partners/position.ts).
    if (isLoss) return { error: "ক্ষতি আলাদা করে ভাগ করতে হয় না — প্রত্যেকের হিসাবে নিজে থেকেই দেখানো হয়।" };
    // Only realized profit not yet paid can go out — never the estimate on animals still on the farm.
    const { positions } = await loadPartnerData(supabase, ctx.businessId);
    for (const e of entries) {
      const due = positions.find((p) => p.id === e.partnerId)?.distributable ?? 0;
      if (e.amount > due + 0.5) {
        const name = positions.find((p) => p.id === e.partnerId)?.name ?? "";
        return { error: `${name}-এর পাকা লাভের পাওনা ৳${Math.floor(due).toLocaleString("en-IN")} — এর বেশি দেওয়া যাবে না।` };
      }
    }

    const type: PartnerTransactionType = "profit";
    const rows = entries
      .filter((e) => e.amount > 0)
      .map((e) => ({
        partner_id: e.partnerId,
        amount: Math.round(e.amount * 100) / 100,
        type,
        recorded_at: date,
        notes: isLoss ? "ক্ষতি বরাদ্দ" : "লাভ বিতরণ",
      }));

    if (!rows.length) return { error: "বিতরণযোগ্য কোনো পরিমাণ নেই" };

    const { error } = await supabase.from("partner_transactions").insert(rows);
    if (error) return { error: "বিতরণ ব্যর্থ হয়েছে" };

    if (payload.lockBooks) {
      const { data: lastLock } = await supabase.from("financial_locks").select("locked_until")
        .eq("business_id", ctx.businessId).order("locked_until", { ascending: false }).limit(1).maybeSingle();
      if (!lastLock || String(lastLock.locked_until).slice(0, 10) < date) {
        await supabase.from("financial_locks").insert({ business_id: ctx.businessId, locked_until: date, created_by: ctx.user.id });
      }
    }

    if (isLoss) {
      await FinancialEventBus.publish("LossDistributed", ctx.businessId, {
        totalAmount,
        date,
        partnerCount: rows.length,
      }, ctx.user.id);
    } else {
      await FinancialEventBus.publish("ProfitDistributed", ctx.businessId, {
        totalAmount,
        date,
        partnerCount: rows.length,
      }, ctx.user.id);
    }

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to declare distribution" };
  }
}

export async function deletePartnerTransaction(
  id: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    const { data: txn } = await supabase
      .from("partner_transactions")
      .select("*, partners!inner(business_id)")
      .eq("id", id)
      .maybeSingle();

    if (!txn) return { error: "Transaction not found" };
    if ((txn as { partners: { business_id: string } }).partners.business_id !== ctx.businessId)
      return { error: "Unauthorized" };
    // the partner's credit for an expense they paid goes with that expense
    if ((txn as { cost_entry_id?: string | null }).cost_entry_id) {
      return { error: "এটা একটা খরচের টাকা (অংশীদার নিজে দিয়েছিলেন) — টাকা-পয়সা পাতায় খরচটা বদলান বা মুছুন।" };
    }

    await verifyFinancialLock(supabase, ctx.businessId, (txn as { recorded_at: string }).recorded_at);

    const { error } = await supabase
      .from("partner_transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: "মুছতে ব্যর্থ হয়েছে" };

    await FinancialEventBus.publish("CapitalAdjusted", ctx.businessId, {
      transactionId: id,
      action: "deleted",
    }, ctx.user.id);

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete transaction" };
  }
}

// ── Cycles ──────────────────────────────────────────────────────────────────

export type CyclePreview = {
  closedOn: string;
  from: string | null;
  items: number;
  net: number;
  fee: number;
  shares: { id: string; name: string; amount: number }[];
  stillOnFarm: number;
};

async function checkCloseDate(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string, date: string): Promise<string | null> {
  if (!ISO.test(date)) return "তারিখ দিন";
  if (date > todayDhaka()) return "ভবিষ্যতের তারিখে চক্র বন্ধ করা যায় না";
  const { data: last } = await supabase.from("partner_cycles").select("closed_on").eq("business_id", businessId).is("deleted_at", null)
    .order("closed_on", { ascending: false }).limit(1).maybeSingle();
  if (last && String(last.closed_on).slice(0, 10) >= date) return `আগের চক্র ${String(last.closed_on).slice(0, 10)}-এ বন্ধ — এর পরের তারিখ দিন।`;
  return null;
}

/** What closing a cycle on `date` would settle (nothing is saved). */
export async function previewCycleClose(date: string): Promise<{ error?: string; preview?: CyclePreview }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    const d = String(date ?? "").slice(0, 10);
    const bad = await checkCloseDate(supabase, ctx.businessId, d);
    if (bad) return { error: bad };
    const data = await loadPartnerData(supabase, ctx.businessId, d);
    const c = data.farm.cycles.find((x) => x.id === PREVIEW_CYCLE_ID);
    if (!c) return { error: "হিসাব করা যায়নি" };
    return {
      preview: {
        closedOn: c.closedOn, from: c.from, items: c.items, net: c.net, fee: c.fee,
        shares: data.positions.map((p) => ({ id: p.id, name: p.name, amount: c.shares[p.id] ?? 0 })).filter((x) => Math.abs(x.amount) >= 0.01),
        stillOnFarm: data.farm.animals.filter((a) => a.status === "active" || (a.endDate ?? "") > d).length,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "হিসাব করা যায়নি" };
  }
}

/**
 * Close a cycle on the owner's date: every animal that left up to that day is settled on its net and
 * never changes again. The books are locked to that day. Animals still on the farm roll over.
 */
export async function closeCycle(date: string, note?: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    const d = String(date ?? "").slice(0, 10);
    const bad = await checkCloseDate(supabase, ctx.businessId, d);
    if (bad) return { error: bad };
    const res = await previewCycleClose(d);
    if (res.error || !res.preview) return { error: res.error ?? "হিসাব করা যায়নি" };

    const { error } = await supabase.from("partner_cycles").insert({
      business_id: ctx.businessId, closed_on: d, note: note?.trim() || null,
      snapshot: { net: res.preview.net, fee: res.preview.fee, items: res.preview.items, from: res.preview.from, shares: res.preview.shares },
    });
    if (error) return { error: isMissingTable(error) ? "চক্রের টেবিল এখনো তৈরি হয়নি (migration 20260927100000 চালাতে হবে)।" : "চক্র বন্ধ করা যায়নি" };

    // the settled cycle may not move: lock the books to its last day
    const lock = await lockedUntil(supabase, ctx.businessId);
    if (!lock || lock < d) await supabase.from("financial_locks").insert({ business_id: ctx.businessId, locked_until: d, created_by: ctx.user.id });

    revalidatePath("/dashboard/partners");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "চক্র বন্ধ করা যায়নি" };
  }
}

/** Open the last closed cycle again (its animals go back into the open cycle). The book lock stays. */
export async function reopenLastCycle(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);
    const { data: last } = await supabase.from("partner_cycles").select("id, closed_on").eq("business_id", ctx.businessId).is("deleted_at", null)
      .order("closed_on", { ascending: false }).limit(1).maybeSingle();
    if (!last) return { error: "কোনো বন্ধ চক্র নেই" };
    const { count } = await supabase.from("partner_transactions").select("id, partners!inner(business_id)", { count: "exact", head: true })
      .eq("partners.business_id", ctx.businessId).eq("type", "profit").is("deleted_at", null).gt("recorded_at", String(last.closed_on).slice(0, 10));
    if ((count ?? 0) > 0) return { error: "এই চক্রের পরে লাভ বণ্টন হয়েছে — খোলা যাবে না।" };
    const { error } = await supabase.from("partner_cycles").update({ deleted_at: new Date().toISOString() }).eq("id", last.id);
    if (error) return { error: "খোলা যায়নি" };
    revalidatePath("/dashboard/partners");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "খোলা যায়নি" };
  }
}
