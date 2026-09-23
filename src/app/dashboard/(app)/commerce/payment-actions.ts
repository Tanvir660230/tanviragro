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
  type PaymentMethod,
  type PaymentType,
} from "@/lib/commerce";
import type { CommerceActionResult } from "./order-actions";

export async function createCommerceInvoiceAction(payload: {
  orderId?: string;
  invoiceType: "purchase_invoice" | "sale_invoice" | "transport_invoice" | "tax_invoice";
  customerOrVendorName: string;
  customerOrVendorContact?: string;
  issueDate?: string;
  dueDate: string;
  subtotal: number;
  taxRate?: number;
  discountAmount?: number;
  paymentInstructions?: string;
  notes?: string;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_MANAGE);

    const sub = Number(payload.subtotal) || 0;
    const taxRate = Number(payload.taxRate) || 0;
    const discount = Number(payload.discountAmount) || 0;
    const discounted = Math.max(0, sub - discount);
    const taxAmount = Math.round(((discounted * taxRate) / 100) * 100) / 100;
    const totalAmount = Math.round((discounted + taxAmount) * 100) / 100;

    const dateStr = (payload.issueDate || new Date().toISOString().split("T")[0]).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    const { data: invoice, error } = await (supabase as any)
      .from("commerce_invoices")
      .insert({
        business_id: ctx.businessId,
        order_id: payload.orderId || null,
        invoice_number: invoiceNumber,
        invoice_type: payload.invoiceType,
        customer_or_vendor_name: payload.customerOrVendorName.trim(),
        customer_or_vendor_contact: payload.customerOrVendorContact?.trim() || null,
        issue_date: payload.issueDate || new Date().toISOString().split("T")[0],
        due_date: payload.dueDate,
        subtotal: sub,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        paid_amount: 0,
        balance_due: totalAmount,
        status: "issued",
        payment_instructions: payload.paymentInstructions || null,
        notes: payload.notes || null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !invoice) {
      return { error: error?.message || "Failed to create invoice" };
    }

    revalidatePath("/dashboard/commerce");
    revalidatePath("/dashboard/finance");
    return { success: true, invoiceId: invoice.id };
  } catch (err: any) {
    return { error: err.message || "Failed to generate invoice" };
  }
}

export async function recordCommercePaymentAction(payload: {
  invoiceId?: string;
  orderId?: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  amount: number;
  paymentDate?: string;
  counterpartyName: string;
  referenceTxnId?: string;
  accountCode?: string;
  receivedOrPaidBy?: string;
  notes?: string;
}): Promise<CommerceActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COMMERCE_MANAGE);

    if (!payload.amount || payload.amount <= 0) {
      return { error: "Valid settlement amount is required" };
    }

    const dateStr = (payload.paymentDate || new Date().toISOString().split("T")[0]).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const paymentNumber = `PAY-${dateStr}-${randomSuffix}`;

    const { data: payment, error } = await (supabase as any)
      .from("commerce_payments")
      .insert({
        business_id: ctx.businessId,
        invoice_id: payload.invoiceId || null,
        order_id: payload.orderId || null,
        payment_number: paymentNumber,
        payment_type: payload.paymentType,
        payment_method: payload.paymentMethod,
        amount: payload.amount,
        payment_date: payload.paymentDate || new Date().toISOString().split("T")[0],
        reference_txn_id: payload.referenceTxnId || null,
        account_code: payload.accountCode || "1010",
        received_or_paid_by: payload.receivedOrPaidBy || null,
        notes: payload.notes || null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();

    if (error || !payment) {
      return { error: error?.message || "Failed to record payment" };
    }

    if (payload.invoiceId) {
      const { data: inv } = await (supabase as any)
        .from("commerce_invoices")
        .select("total_amount, paid_amount, due_date")
        .eq("id", payload.invoiceId)
        .single();

      if (inv) {
        const { data: allPayments } = await (supabase as any)
          .from("commerce_payments")
          .select("amount")
          .eq("invoice_id", payload.invoiceId);

        const reconciliation = CommerceEngine.reconcileInvoice(
          { totalAmount: inv.total_amount, dueDate: inv.due_date },
          allPayments || []
        );

        await (supabase as any)
          .from("commerce_invoices")
          .update({
            paid_amount: reconciliation.totalPaid,
            balance_due: reconciliation.balanceDue,
            status: reconciliation.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.invoiceId);
      }
    }

    try {
      const journalEntry = JournalEngine.createCommercePaymentJournal({
        businessId: ctx.businessId,
        paymentId: payment.id,
        paymentNumber,
        paymentType: payload.paymentType,
        counterpartyName: payload.counterpartyName || "Counterparty",
        amount: payload.amount,
        accountCode: payload.accountCode,
        date: payload.paymentDate || new Date().toISOString().split("T")[0],
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
      "CommercePaymentReceived",
      ctx.businessId,
      payment.id,
      { paymentNumber, amount: payload.amount, method: payload.paymentMethod },
      ctx.user.id
    );

    revalidatePath("/dashboard/commerce");
    revalidatePath("/dashboard/finance");
    return { success: true, paymentId: payment.id };
  } catch (err: any) {
    return { error: err.message || "Failed to record payment" };
  }
}

