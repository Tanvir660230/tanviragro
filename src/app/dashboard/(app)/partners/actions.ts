"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { PartnerTransactionType, PartnerType } from "@/types/database";

export type PartnerFormState = { error?: string; success?: boolean } | undefined;

type TypedClient = Awaited<ReturnType<typeof createClient>>;



async function verifyPartnerOwnership(
  supabase: TypedClient,
  businessId: string,
  partnerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("partners")
    .select("business_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (!data) return "Partner not found";
  if (data.business_id !== businessId) return "Unauthorized";
  return null;
}

export async function createPartner(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const partnerType = (formData.get("partner_type") as PartnerType) || "capital";
  const shareMode = (formData.get("share_mode") as string) === "manual" ? "manual" : "auto";
  const investmentAmount = parseFloat(formData.get("investment_amount") as string) || 0;
  const rawProfitShare = parseFloat(formData.get("profit_share_pct") as string);
  const profitSharePct = shareMode === "manual" && !isNaN(rawProfitShare) ? rawProfitShare : 0;
  const laborValueMonthly = parseFloat(formData.get("labor_value_monthly") as string) || null;
  const cliffMonths = parseInt(formData.get("cliff_months") as string, 10) || 0;
  const joinedAt = (formData.get("joined_at") as string) || new Date().toISOString().slice(0, 10);
  const notes = (formData.get("notes") as string)?.trim() || null;
  const rawEntryNetpl     = formData.get("entry_netpl");
  const rawEntryValuation = formData.get("entry_valuation");
  const entryNetpl     = rawEntryNetpl     ? parseFloat(rawEntryNetpl as string)     : null;
  const entryValuation = rawEntryValuation ? parseFloat(rawEntryValuation as string) : null;

  if (!name) return { error: "নাম দিন" };
  if (!["capital", "labor", "hybrid"].includes(partnerType))
    return { error: "বৈধ অংশীদার ধরন নির্বাচন করুন" };
  if (shareMode === "manual" && (isNaN(profitSharePct) || profitSharePct < 0 || profitSharePct > 100))
    return { error: "লাভের অংশ ০–১০০% এর মধ্যে হতে হবে" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "No active business found" };

  // For manual-mode partners, check total share won't exceed 100%
  if (shareMode === "manual") {
    const { data: existingPartners } = await supabase
      .from("partners")
      .select("profit_share_pct, share_mode")
      .eq("business_id", businessId)
      .is("deleted_at", null);
    const currentTotal = (existingPartners ?? [])
      .filter((p: { share_mode: string }) => p.share_mode === "manual")
      .reduce((s, p: { profit_share_pct: number }) => s + p.profit_share_pct, 0);
    if (currentTotal + profitSharePct > 100)
      return { error: `মোট লাভের অংশ ১০০% ছাড়িয়ে গেছে (বর্তমানে ${currentTotal.toFixed(1)}% বরাদ্দ)` };
  }

  const { data: newPartner, error } = await supabase.from("partners").insert({
    business_id: businessId,
    name,
    partner_type: partnerType,
    investment_amount: investmentAmount,
    profit_share_pct: profitSharePct,
    labor_value_monthly: partnerType === "capital" ? null : laborValueMonthly,
    cliff_months: partnerType === "capital" ? 0 : cliffMonths,
    share_mode: shareMode,
    bears_loss: partnerType === "labor" ? false : formData.get("bears_loss") === "true",
    joined_at: joinedAt,
    notes,
    entry_netpl:     isFinite(entryNetpl ?? NaN)     ? entryNetpl     : null,
    entry_valuation: isFinite(entryValuation ?? NaN) ? entryValuation : null,
  }).select("id").single();

  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে" };

  // Auto-create the initial investment transaction so Cash Balance can track it
  if (investmentAmount > 0 && newPartner) {
    const { error: txnErr } = await supabase.from("partner_transactions").insert({
      partner_id: newPartner.id,
      amount: investmentAmount,
      type: "investment",
      recorded_at: joinedAt,
      notes: "Initial Capital Investment",
    });
    if (txnErr) {
      // Roll back the partner row — the capital transaction is required for correct balance
      await supabase.from("partners").update({ deleted_at: new Date().toISOString() }).eq("id", newPartner.id);
      return { error: "সংরক্ষণ ব্যর্থ হয়েছে। Please try again." };
    }
  }

  revalidatePath("/dashboard/partners");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function addPartnerTransaction(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const partnerId = formData.get("partner_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const type = formData.get("type") as PartnerTransactionType;
  const recordedAt = formData.get("recorded_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!partnerId) return { error: "অংশীদার নির্বাচন করুন" };
  if (isNaN(amount) || amount <= 0) return { error: "বৈধ পরিমাণ দিন" };
  if (!recordedAt) return { error: "তারিখ দিন" };

  // Ownership check — partner must belong to the authenticated user's business
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const ownershipErr = await verifyPartnerOwnership(supabase, businessId, partnerId);
  if (ownershipErr) return { error: ownershipErr };

  const { error } = await supabase.from("partner_transactions").insert({
    partner_id: partnerId,
    amount,
    type: type || "investment",
    recorded_at: recordedAt,
    notes,
  });

  if (error) return { error: "লেনদেন সংরক্ষণ ব্যর্থ হয়েছে" };
  revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function updatePartner(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = (formData.get("partner_id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const partnerType = (formData.get("partner_type") as PartnerType) || "capital";
  const shareMode = (formData.get("share_mode") as string) === "manual" ? "manual" : "auto";
  const investmentAmount = parseFloat(formData.get("investment_amount") as string) || 0;
  const rawProfitShare = parseFloat(formData.get("profit_share_pct") as string);
  const profitSharePct = shareMode === "manual" && !isNaN(rawProfitShare) ? rawProfitShare : 0;
  const rawLabor = parseFloat(formData.get("labor_value_monthly") as string);
  const laborValueMonthly = !isNaN(rawLabor) && rawLabor > 0 ? rawLabor : null;
  const cliffMonths = parseInt(formData.get("cliff_months") as string, 10) || 0;
  const joinedAt = (formData.get("joined_at") as string) || new Date().toISOString().slice(0, 10);
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!id) return { error: "অংশীদার আইডি পাওয়া যায়নি" };
  if (!name) return { error: "নাম দিন" };
  if (!["capital", "labor", "hybrid"].includes(partnerType))
    return { error: "বৈধ অংশীদার ধরন নির্বাচন করুন" };
  if (shareMode === "manual" && (isNaN(profitSharePct) || profitSharePct < 0 || profitSharePct > 100))
    return { error: "লাভের অংশ ০–১০০% এর মধ্যে হতে হবে" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const ownershipErr = await verifyPartnerOwnership(supabase, businessId, id);
  if (ownershipErr) return { error: ownershipErr };

  // For manual-mode, validate total share won't exceed 100% (exclude this partner)
  if (shareMode === "manual") {
    const { data: otherPartners } = await supabase
      .from("partners")
      .select("profit_share_pct, share_mode")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("id", id);
    const otherTotal = (otherPartners ?? [])
      .filter((p: { share_mode: string }) => p.share_mode === "manual")
      .reduce((s, p: { profit_share_pct: number }) => s + p.profit_share_pct, 0);
    if (otherTotal + profitSharePct > 100)
      return {
        error: `মোট লাভের অংশ ১০০% ছাড়িয়ে গেছে (অন্যরা ${otherTotal.toFixed(1)}% ব্যবহার করছে)`,
      };
  }

  const { error } = await supabase
    .from("partners")
    .update({
      name,
      partner_type: partnerType,
      investment_amount: investmentAmount,
      profit_share_pct: profitSharePct,
      labor_value_monthly: partnerType === "capital" ? null : laborValueMonthly,
      cliff_months: partnerType === "capital" ? 0 : cliffMonths,
      share_mode: shareMode,
      bears_loss: partnerType === "labor" ? false : formData.get("bears_loss") === "true",
      joined_at: joinedAt,
      notes,
    })
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) return { error: "আপডেট ব্যর্থ হয়েছে" };

  // Keep the "Initial Capital Investment" DB transaction in sync with investment_amount.
  // This transaction is used for cash-flow tracking (Cash Balance widget).
  const { data: initTxn } = await supabase
    .from("partner_transactions")
    .select("id")
    .eq("partner_id", id)
    .eq("notes", "Initial Capital Investment")
    .maybeSingle();

  if (initTxn) {
    if (investmentAmount > 0) {
      await supabase
        .from("partner_transactions")
        .update({ amount: investmentAmount, recorded_at: joinedAt })
        .eq("id", initTxn.id);
    } else {
      // Soft-delete instead of hard-delete — preserves capital ledger history
      await supabase
        .from("partner_transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", initTxn.id);
    }
  } else if (investmentAmount > 0) {
    // Only create Initial Capital Investment if NO investment transactions exist yet.
    // If Capital Ledger entries already exist they already track the cash — don't duplicate.
    const { count } = await supabase
      .from("partner_transactions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", id)
      .eq("type", "investment")
      .is("deleted_at", null);
    if ((count ?? 0) === 0) {
      await supabase.from("partner_transactions").insert({
        partner_id: id,
        amount: investmentAmount,
        type: "investment",
        recorded_at: joinedAt,
        notes: "Initial Capital Investment",
      });
    }
  }

  revalidatePath("/dashboard/partners");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

// Soft-delete: sets deleted_at so history is preserved in partner_transactions.
export async function deletePartner(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const ownershipErr = await verifyPartnerOwnership(supabase, businessId, id);
  if (ownershipErr) return { error: ownershipErr };

  const { error } = await supabase
    .from("partners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "মুছতে ব্যর্থ হয়েছে" };
  revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export type DeclareDistributionPayload = {
  totalAmount: number;
  date: string;
  isLoss: boolean;
  entries: { partnerId: string; amount: number }[];
};

export async function declareDistribution(
  payload: DeclareDistributionPayload
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { totalAmount, date, isLoss, entries } = payload;

  if (!date) return { error: "তারিখ দিন" };
  if (!Number.isFinite(totalAmount) || totalAmount <= 0)
    return { error: "বৈধ পরিমাণ দিন" };
  if (!entries.length) return { error: "কোনো অংশীদার নেই" };

  // Ownership check — every partner ID must belong to this user's business
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const partnerIds = entries.map((e) => e.partnerId);
  const { data: partnerRows } = await supabase
    .from("partners")
    .select("id, business_id")
    .in("id", partnerIds)
    .is("deleted_at", null);

  const allOwned = (partnerRows ?? []).every(
    (p: { business_id: string }) => p.business_id === businessId
  );
  if ((partnerRows ?? []).length !== partnerIds.length || !allOwned)
    return { error: "Unauthorized" };

  // Guard: each entry amount must be positive.
  if (entries.some((e) => !Number.isFinite(e.amount) || e.amount <= 0))
    return { error: "প্রতিটি অংশীদারের পরিমাণ শূন্যের বেশি হতে হবে।" };

  // Guard: sum of entry amounts must match the declared totalAmount (prevents client inflating shares).
  const entrySum = entries.reduce((s, e) => s + e.amount, 0);
  if (Math.abs(entrySum - totalAmount) > 1)
    return { error: "অংশীদারদের যোগফল মোট পরিমাণের সাথে মিলছে না।" };

  const type: PartnerTransactionType = isLoss ? "loss_allocation" : "profit";
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

  revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function deletePartnerTransaction(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  // Verify ownership via partner → business
  const { data: txn } = await supabase
    .from("partner_transactions")
    .select("id, partners!inner(business_id)")
    .eq("id", id)
    .maybeSingle();

  if (!txn) return { error: "Transaction not found" };
  if ((txn as { partners: { business_id: string } }).partners.business_id !== businessId)
    return { error: "Unauthorized" };

  const { error } = await supabase
    .from("partner_transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "মুছতে ব্যর্থ হয়েছে" };

  revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
