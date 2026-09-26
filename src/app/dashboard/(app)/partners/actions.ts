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
import { loadPartnerData } from "@/lib/partners/load-positions";
import type { PartnerTransactionType, PartnerType } from "@/types/database";
import { todayDhaka } from "@/lib/dates";

export type PartnerFormState = { error?: string; success?: boolean } | undefined;

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

    const name = (formData.get("name") as string)?.trim();
    const partnerType = (formData.get("partner_type") as PartnerType) || "capital";
    const shareMode = (formData.get("share_mode") as string) === "manual" ? "manual" : "auto";
    const rawProfitShare = parseFloat(formData.get("profit_share_pct") as string);
    const profitSharePct = shareMode === "manual" && !isNaN(rawProfitShare) ? rawProfitShare : 0;
    const laborValueMonthly = parseFloat(formData.get("labor_value_monthly") as string) || null;
    const cliffMonths = parseInt(formData.get("cliff_months") as string, 10) || 0;
    const joinedAt = formData.get("joined_at") as string;
    const notes = (formData.get("notes") as string)?.trim() || null;

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
      editingPartnerId: partnerId,
    });

    if (!validation.isValid) {
      return { error: validation.errors[0] };
    }

    const { error } = await supabase.from("partners").update({
      name,
      partner_type: partnerType,
      share_mode: shareMode,
      profit_share_pct: profitSharePct,
      labor_value_monthly: laborValueMonthly,
      cliff_months: cliffMonths,
      joined_at: joinedAt,
      notes,
    }).eq("id", partnerId);

    if (error) return { error: "আপডেট ব্যর্থ হয়েছে" };

    await FinancialEventBus.publish("PartnerUpdated", ctx.businessId, {
      partnerId,
      name,
      partnerType,
      shareMode,
      profitSharePct,
    }, ctx.user.id);

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

export async function addPartnerTransaction(
  _prev: PartnerFormState,
  formData: FormData
): Promise<PartnerFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.PARTNERS_MANAGE);

    const partnerId = formData.get("partner_id") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const type = (formData.get("type") as string === "draw" ? "withdrawal" : formData.get("type")) as PartnerTransactionType;
    const recordedAt = (formData.get("recorded_at") as string) || todayDhaka();
    const notes = (formData.get("notes") as string)?.trim() || null;

    const validation = PartnerEngine.validateTransaction({
      partnerId,
      type,
      amount,
      recordedAt,
    });

    if (!validation.isValid) {
      return { error: validation.errors[0] };
    }

    await assertResourceOwnership(supabase, "partners", partnerId, ctx.businessId);
    await verifyFinancialLock(supabase, ctx.businessId, recordedAt);

    const { data: insertedTxn, error } = await supabase
      .from("partner_transactions")
      .insert({
        partner_id: partnerId,
        amount,
        type,
        recorded_at: recordedAt,
        notes,
      })
      .select("id")
      .single();

    if (error || !insertedTxn) return { error: "সংরক্ষণ ব্যর্থ হয়েছে" };

    if (type === "investment") {
      await FinancialEventBus.publish("PartnerInvestment", ctx.businessId, {
        partnerId,
        transactionId: insertedTxn.id,
        amount,
        recordedAt,
      }, ctx.user.id);
    } else if (type === "withdrawal") {
      await FinancialEventBus.publish("PartnerWithdrawal", ctx.businessId, {
        partnerId,
        transactionId: insertedTxn.id,
        amount,
        recordedAt,
      }, ctx.user.id);
    } else if (type === "profit") {
      await FinancialEventBus.publish("ProfitDistributed", ctx.businessId, {
        partnerId,
        transactionId: insertedTxn.id,
        amount,
        recordedAt,
      }, ctx.user.id);
    } else if (type === "loss_allocation") {
      await FinancialEventBus.publish("LossDistributed", ctx.businessId, {
        partnerId,
        transactionId: insertedTxn.id,
        amount,
        recordedAt,
      }, ctx.user.id);
    }

    revalidatePath("/dashboard/partners");
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
      .select("id, recorded_at, partners!inner(business_id)")
      .eq("id", id)
      .maybeSingle();

    if (!txn) return { error: "Transaction not found" };
    if ((txn as { partners: { business_id: string } }).partners.business_id !== ctx.businessId)
      return { error: "Unauthorized" };

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