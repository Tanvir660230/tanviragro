"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { LivestockEventBus } from "@/lib/livestock/events";
import {
  OwnershipEngine,
  type OwnershipTransferReason,
  type ContractType,
} from "@/lib/commerce";
import type { CommerceActionResult } from "./order-actions";

export async function recordOwnershipTransferAction(payload: {
  cattleId: string;
  tagId?: string;
  transferReason: OwnershipTransferReason;
  previousOwnerName: string;
  previousOwnerContact?: string;
  newOwnerName: string;
  newOwnerContact?: string;
  transferDate?: string;
  transferPrice: number;
  legalDocumentRef?: string;
  witnessName?: string;
  notes?: string;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_MANAGE);

    if (!payload.cattleId) {
      return { error: "Animal selection is required" };
    }
    if (!payload.previousOwnerName?.trim() || !payload.newOwnerName?.trim()) {
      return { error: "Both previous and new owner names are required" };
    }

    const tDate = payload.transferDate || new Date().toISOString().split("T")[0];
    const signatureHash = OwnershipEngine.generateOwnershipHash({
      cattleId: payload.cattleId,
      tagId: payload.tagId,
      previousOwner: payload.previousOwnerName,
      newOwner: payload.newOwnerName,
      transferDate: tDate,
      price: payload.transferPrice || 0,
      witness: payload.witnessName,
    });

    const { data: record, error } = await (supabase as any)
      .from("animal_ownership_history")
      .insert({
        business_id: ctx.businessId,
        cattle_id: payload.cattleId,
        tag_id: payload.tagId || null,
        transfer_reason: payload.transferReason,
        previous_owner_name: payload.previousOwnerName.trim(),
        previous_owner_contact: payload.previousOwnerContact?.trim() || null,
        new_owner_name: payload.newOwnerName.trim(),
        new_owner_contact: payload.newOwnerContact?.trim() || null,
        transfer_date: tDate,
        transfer_price: Number(payload.transferPrice) || 0,
        legal_document_ref: payload.legalDocumentRef || null,
        digital_signature_hash: signatureHash,
        witness_name: payload.witnessName || null,
        approval_status: "verified",
        notes: payload.notes || null,
        recorded_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !record) {
      return { error: error?.message || "Failed to record ownership handover" };
    }

    if (payload.transferReason === "sale" || payload.transferReason === "disposal") {
      await (supabase as any)
        .from("cattle")
        .update({ status: "sold" })
        .eq("id", payload.cattleId);
    }

    await LivestockEventBus.publish(
      "OwnershipTransferred",
      ctx.businessId,
      payload.cattleId,
      {
        previousOwner: payload.previousOwnerName,
        newOwner: payload.newOwnerName,
        price: payload.transferPrice,
        hash: signatureHash,
      },
      ctx.user.id
    );

    revalidatePath(`/dashboard/cattle/${payload.cattleId}`);
    revalidatePath("/dashboard/commerce");
    revalidatePath("/dashboard/cattle");
    return { success: true, ownershipRecordId: record.id, signatureHash };
  } catch (err: any) {
    return { error: err.message || "Failed to process ownership transfer" };
  }
}

export async function createCommerceContractAction(payload: {
  contractType: ContractType;
  title: string;
  counterpartyName: string;
  counterpartyContact?: string;
  startDate: string;
  endDate?: string;
  totalContractValue: number;
  termsAndConditions?: string;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_MANAGE);

    if (!payload.title?.trim() || !payload.counterpartyName?.trim()) {
      return { error: "Contract title and counterparty name are required" };
    }

    const dateStr = payload.startDate.replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const contractNumber = `CTR-${dateStr}-${randomSuffix}`;

    const { data: contract, error } = await (supabase as any)
      .from("commerce_contracts")
      .insert({
        business_id: ctx.businessId,
        contract_number: contractNumber,
        title: payload.title.trim(),
        contract_type: payload.contractType,
        counterparty_name: payload.counterpartyName.trim(),
        counterparty_contact: payload.counterpartyContact?.trim() || null,
        start_date: payload.startDate,
        end_date: payload.endDate || null,
        total_contract_value: Number(payload.totalContractValue) || 0,
        terms_and_conditions: payload.termsAndConditions || null,
        status: "active",
        signed_at: new Date().toISOString(),
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !contract) {
      return { error: error?.message || "Failed to create commercial contract" };
    }

    revalidatePath("/dashboard/commerce");
    return { success: true, data: contract };
  } catch (err: any) {
    return { error: err.message || "Failed to create contract" };
  }
}
