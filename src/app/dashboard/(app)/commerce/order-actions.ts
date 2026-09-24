"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { LivestockEventBus } from "@/lib/livestock/events";
import { JournalEngine } from "@/lib/financial/journal";
import {
  CommerceEngine,
  type CommerceOrderType,
  type CounterpartyType,
  type CommerceOrderItem,
} from "@/lib/commerce";
import { todayDhaka } from "@/lib/dates";

export interface CommerceActionResult {
  success?: boolean;
  error?: string;
  orderId?: string;
  invoiceId?: string;
  paymentId?: string;
  transferId?: string;
  ownershipRecordId?: string;
  signatureHash?: string;
  data?: any;
}

export async function createCommerceOrderAction(payload: {
  orderType: CommerceOrderType;
  counterpartyType: CounterpartyType;
  counterpartyId?: string;
  counterpartyName: string;
  counterpartyContact?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  taxRatePercent?: number;
  discountAmount?: number;
  transportCost?: number;
  commissionAmount?: number;
  paymentTerms?: string;
  notes?: string;
  items: CommerceOrderItem[];
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_MANAGE);

    if (!payload.counterpartyName?.trim()) {
      return { error: "Party name is required" };
    }
    if (!payload.items || payload.items.length === 0) {
      return { error: "At least one item is required" };
    }

    const calculated = CommerceEngine.calculateOrderTotals(payload.items, {
      taxRatePercent: payload.taxRatePercent,
      discountAmount: payload.discountAmount,
      transportCost: payload.transportCost,
      commissionAmount: payload.commissionAmount,
    });

    const prefix = payload.orderType === "purchase" ? "PO" : payload.orderType === "sale" ? "SO" : "ORD";
    const dateStr = (payload.orderDate || todayDhaka()).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `${prefix}-${dateStr}-${randomSuffix}`;

    const { data: order, error: orderErr } = await (supabase as any)
      .from("commerce_orders")
      .insert({
        business_id: ctx.businessId,
        order_number: orderNumber,
        order_type: payload.orderType,
        counterparty_type: payload.counterpartyType,
        counterparty_id: payload.counterpartyId || null,
        counterparty_name: payload.counterpartyName.trim(),
        counterparty_contact: payload.counterpartyContact?.trim() || null,
        status: "approved",
        order_date: payload.orderDate || todayDhaka(),
        expected_delivery_date: payload.expectedDeliveryDate || null,
        subtotal_amount: calculated.subtotalAmount,
        tax_amount: calculated.taxAmount,
        discount_amount: calculated.discountAmount,
        transport_cost: calculated.transportCost,
        commission_amount: calculated.commissionAmount,
        net_total_amount: calculated.netTotalAmount,
        paid_amount: 0,
        payment_status: "unpaid",
        payment_terms: payload.paymentTerms || null,
        notes: payload.notes || null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return { error: orderErr?.message || "Failed to create order" };
    }

    const itemRows = payload.items.map((item) => ({
      order_id: order.id,
      business_id: ctx.businessId,
      cattle_id: item.cattleId || null,
      item_type: item.itemType || "livestock",
      tag_id: item.tagId || null,
      description: item.description,
      quantity: item.quantity || 1,
      unit_price: item.unitPrice || 0,
      initial_weight_kg: item.initialWeightKg || null,
      final_weight_kg: item.finalWeightKg || null,
      rate_per_kg: item.ratePerKg || null,
      total_price: item.totalPrice || item.unitPrice * (item.quantity || 1),
      status: "pending",
      metadata: item.metadata || {},
    }));

    await (supabase as any).from("commerce_order_items").insert(itemRows);

    try {
      const journalEntry = JournalEngine.createCommerceOrderJournal({
        businessId: ctx.businessId,
        orderId: order.id,
        orderNumber,
        orderType: payload.orderType === "purchase" ? "purchase" : "sale",
        counterpartyName: payload.counterpartyName,
        totalAmount: calculated.netTotalAmount,
        date: payload.orderDate || todayDhaka(),
        userId: ctx.user.id,
      });

      await (supabase as any).from("journal_entries").insert({
        business_id: journalEntry.businessId,
        reference_number: journalEntry.referenceNumber,
        source_module: journalEntry.sourceModule,
        source_entity_id: journalEntry.sourceEntityId,
        transaction_date: journalEntry.transactionDate,
        description: journalEntry.description,
        total_debit: journalEntry.totalDebit,
        total_credit: journalEntry.totalCredit,
        is_balanced: journalEntry.isBalanced,
        created_by: journalEntry.createdBy,
        created_at: journalEntry.createdAt,
      });
    } catch {
      // Ignored
    }

    await LivestockEventBus.publish(
      "CommerceOrderCreated",
      ctx.businessId,
      order.id,
      { orderNumber, total: calculated.netTotalAmount },
      ctx.user.id
    );

    revalidatePath("/dashboard/commerce");
    revalidatePath("/dashboard/finance");
    return { success: true, orderId: order.id };
  } catch (err: any) {
    return { error: err.message || "Failed to process order" };
  }
}
