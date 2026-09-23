import { Metadata } from "next";
import { getCachedBusinessId } from "@/lib/supabase/cached";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShoppingCart } from "lucide-react";
import { EnterpriseCommerceWorkspace } from "@/components/commerce/EnterpriseCommerceWorkspace";
import { CommercialValuationEngine } from "@/lib/commerce";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";

export const metadata: Metadata = {
  title: "Commerce, Sales & Logistics Hub | Tanvir Agro ERP",
  description: "Enterprise livestock commerce, purchasing, sales contracts, inter-farm logistics and ownership registry",
};

export default async function CommercePage() {
  await requirePagePermission(PERMISSIONS.COMMERCE_VIEW);
  const businessId = await getCachedBusinessId();
  if (!businessId) redirect("/login");

  const supabase = await createClient();

  const { data: ordersData } = await (supabase as any)
    .from("commerce_orders")
    .select("*, items:commerce_order_items(*)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const { data: invoicesData } = await (supabase as any)
    .from("commerce_invoices")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const { data: transfersData } = await (supabase as any)
    .from("commerce_transfers")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const { data: ownershipData } = await (supabase as any)
    .from("animal_ownership_history")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const { data: cattleData } = await (supabase as any)
    .from("cattle")
    .select("id, tag_id, status, purchase_price, purchase_date")
    .eq("business_id", businessId);

  const { data: salesData } = await (supabase as any)
    .from("sales")
    .select("cattle_id, sale_price_total, sold_at")
    .eq("cattle.business_id", businessId);

  const availableCattle = (cattleData || [])
    .filter((c: any) => c.status === "active")
    .map((c: any) => ({ id: c.id, tag_id: c.tag_id }));

  const analytics = (salesData || []).map((s: any) => {
    const c = (cattleData || []).find((cat: any) => cat.id === s.cattle_id);
    return CommercialValuationEngine.calculateAnimalProfitLoss({
      cattleId: s.cattle_id,
      tagId: c?.tag_id || "N/A",
      purchasePrice: Number(c?.purchase_price) || 0,
      purchaseDateISO: c?.purchase_date || new Date().toISOString(),
      soldDateISO: s.sold_at,
      salePrice: Number(s.sale_price_total) || 0,
      feedCost: 8500,
      medicalCost: 1200,
      logisticsCost: 1500,
    });
  });

  const orders = (ordersData || []).map((o: any) => ({
    id: o.id,
    businessId: o.business_id,
    orderNumber: o.order_number,
    orderType: o.order_type,
    counterpartyType: o.counterparty_type,
    counterpartyName: o.counterparty_name,
    status: o.status,
    orderDate: o.order_date,
    currency: o.currency,
    subtotalAmount: Number(o.subtotal_amount) || 0,
    taxAmount: Number(o.tax_amount) || 0,
    discountAmount: Number(o.discount_amount) || 0,
    transportCost: Number(o.transport_cost) || 0,
    commissionAmount: Number(o.commission_amount) || 0,
    netTotalAmount: Number(o.net_total_amount) || 0,
    paidAmount: Number(o.paid_amount) || 0,
    paymentStatus: o.payment_status,
    paymentTerms: o.payment_terms,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  }));

  const invoices = (invoicesData || []).map((i: any) => ({
    id: i.id,
    businessId: i.business_id,
    orderId: i.order_id,
    invoiceNumber: i.invoice_number,
    invoiceType: i.invoice_type,
    customerOrVendorName: i.customer_or_vendor_name,
    customerOrVendorContact: i.customer_or_vendor_contact,
    issueDate: i.issue_date,
    dueDate: i.due_date,
    subtotal: Number(i.subtotal) || 0,
    taxRate: Number(i.tax_rate) || 0,
    taxAmount: Number(i.tax_amount) || 0,
    discountAmount: Number(i.discount_amount) || 0,
    totalAmount: Number(i.total_amount) || 0,
    paidAmount: Number(i.paid_amount) || 0,
    balanceDue: Number(i.balance_due) || 0,
    status: i.status,
    createdAt: i.created_at,
  }));

  const transfers = (transfersData || []).map((t: any) => ({
    id: t.id,
    businessId: t.business_id,
    transferNumber: t.transfer_number,
    transferType: t.transfer_type,
    originName: t.origin_name,
    destinationName: t.destination_name,
    cattleIds: t.cattle_ids || [],
    driverName: t.driver_name,
    driverPhone: t.driver_phone,
    vehicleNumber: t.vehicle_number,
    transportCost: Number(t.transport_cost) || 0,
    transitStatus: t.transit_status,
    createdAt: t.created_at,
  }));

  const ownershipHistory = (ownershipData || []).map((h: any) => ({
    id: h.id,
    businessId: h.business_id,
    cattleId: h.cattle_id,
    tagId: h.tag_id,
    transferReason: h.transfer_reason,
    previousOwnerName: h.previous_owner_name,
    newOwnerName: h.new_owner_name,
    transferDate: h.transfer_date,
    transferPrice: Number(h.transfer_price) || 0,
    digitalSignatureHash: h.digital_signature_hash,
    witnessName: h.witness_name,
    approvalStatus: h.approval_status,
    createdAt: h.created_at,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Commerce, Sales &amp; Logistics Hub"
        subtitle="Manage livestock purchasing, customer sales contracts, inter-farm dispatches, legal ownership passports, and realized profit margins"
        icon={ShoppingCart}
      />
      <EnterpriseCommerceWorkspace
        initialOrders={orders}
        initialTransfers={transfers}
        initialInvoices={invoices}
        initialOwnershipHistory={ownershipHistory}
        initialAnalytics={analytics}
        availableCattle={availableCattle}
      />
    </div>
  );
}

