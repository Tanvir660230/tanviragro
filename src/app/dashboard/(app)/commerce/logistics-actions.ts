"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { JournalEngine } from "@/lib/financial/journal";
import {
  TransferLogisticsEngine,
  type TransferType,
  type TransitStatus,
  type TransferChecklist,
} from "@/lib/commerce";
import type { CommerceActionResult } from "./order-actions";

export async function createCommerceTransferAction(payload: {
  orderId?: string;
  transferType: TransferType;
  originName: string;
  destinationName: string;
  cattleIds: string[];
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  scheduledDeparture?: string;
  transportCost?: number;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_TRANSFER);

    const validation = TransferLogisticsEngine.validateTransferDispatch({
      transferType: payload.transferType,
      originName: payload.originName,
      destinationName: payload.destinationName,
      cattleCount: payload.cattleIds.length,
      vehicleNumber: payload.vehicleNumber,
      driverName: payload.driverName,
    });

    if (!validation.isValid) {
      return { error: validation.errors[0] };
    }

    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const transferNumber = `TRF-${dateStr}-${randomSuffix}`;

    const { data: transfer, error } = await (supabase as any)
      .from("commerce_transfers")
      .insert({
        business_id: ctx.businessId,
        order_id: payload.orderId || null,
        transfer_number: transferNumber,
        transfer_type: payload.transferType,
        origin_name: payload.originName.trim(),
        destination_name: payload.destinationName.trim(),
        cattle_ids: payload.cattleIds,
        vehicle_type: payload.vehicleType || null,
        vehicle_number: payload.vehicleNumber?.trim() || null,
        driver_name: payload.driverName?.trim() || null,
        driver_phone: payload.driverPhone?.trim() || null,
        scheduled_departure: payload.scheduledDeparture || new Date().toISOString(),
        transport_cost: Number(payload.transportCost) || 0,
        transit_status: "scheduled",
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !transfer) {
      return { error: error?.message || "Failed to create transfer dispatch" };
    }

    if (Number(payload.transportCost) > 0) {
      try {
        const journal = JournalEngine.createCommerceLogisticsJournal({
          businessId: ctx.businessId,
          transferId: transfer.id,
          transferNumber,
          amount: Number(payload.transportCost),
          routeDescription: `${payload.originName} -> ${payload.destinationName}`,
          date: new Date().toISOString().split("T")[0],
          userId: ctx.user.id,
        });

        await (supabase as any).from("journal_entries").insert({
          business_id: journal.businessId,
          reference_number: journal.referenceNumber,
          source_module: journal.sourceModule,
          source_entity_id: journal.sourceEntityId,
          transaction_date: journal.transactionDate,
          description: journal.description,
          total_debit: journal.totalDebit,
          total_credit: journal.totalCredit,
          is_balanced: journal.isBalanced,
          created_by: journal.createdBy,
          created_at: journal.createdAt,
        });
      } catch {
        // Ignored
      }
    }

    revalidatePath("/dashboard/commerce");
    return { success: true, transferId: transfer.id };
  } catch (err: any) {
    return { error: err.message || "Failed to create transfer" };
  }
}

export async function updateTransferTransitAction(payload: {
  transferId: string;
  nextStatus: TransitStatus;
  inspectionChecklist?: TransferChecklist;
  inspectedBy?: string;
  inspectionNotes?: string;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_TRANSFER);

    const { data: current } = await (supabase as any)
      .from("commerce_transfers")
      .select("*")
      .eq("id", payload.transferId)
      .single();

    if (!current) {
      return { error: "Transfer record not found" };
    }

    const isValidTransition = TransferLogisticsEngine.isValidTransitStatusTransition(
      current.transit_status,
      payload.nextStatus
    );

    if (!isValidTransition) {
      return { error: `Invalid transit transition from ${current.transit_status} to ${payload.nextStatus}` };
    }

    const updatePayload: any = {
      transit_status: payload.nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (payload.nextStatus === "dispatched") {
      updatePayload.actual_departure = new Date().toISOString();
    } else if (payload.nextStatus === "arrived" || payload.nextStatus === "completed") {
      updatePayload.actual_arrival = new Date().toISOString();
    }

    if (payload.inspectionChecklist) {
      updatePayload.inspection_checklist = payload.inspectionChecklist;
      updatePayload.inspected_by = payload.inspectedBy || null;
      updatePayload.inspection_notes = payload.inspectionNotes || null;

      const inspectionVal = TransferLogisticsEngine.validateArrivalInspection(
        payload.inspectionChecklist,
        payload.inspectionNotes
      );

      if (inspectionVal.requiresQuarantine && current.cattle_ids?.length > 0) {
        await (supabase as any)
          .from("cattle")
          .update({ is_quarantined: true, quarantine_reason: "Transit Arrival Inspection" })
          .in("id", current.cattle_ids);
      }
    }

    await (supabase as any)
      .from("commerce_transfers")
      .update(updatePayload)
      .eq("id", payload.transferId);

    revalidatePath("/dashboard/commerce");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update transit status" };
  }
}

