"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShoppingCart,
  TrendingUp,
  Truck,
  ShieldCheck,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";
import { CommerceKpiCards } from "./CommerceKpiCards";
import { CommerceOverviewTab } from "./CommerceOverviewTab";
import { PurchaseOrdersTab } from "./PurchaseOrdersTab";
import { SalesInvoicesTab } from "./SalesInvoicesTab";
import { TransferLogisticsTab } from "./TransferLogisticsTab";
import { OwnershipRegistryTab } from "./OwnershipRegistryTab";
import { CommercialAnalyticsTab } from "./CommercialAnalyticsTab";
import { CreatePurchaseOrderModal } from "./CreatePurchaseOrderModal";
import { CreateSaleOrderModal } from "./CreateSaleOrderModal";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { DispatchTransferModal } from "./DispatchTransferModal";
import { OwnershipTransferModal } from "./OwnershipTransferModal";
import { updateTransferTransitAction } from "@/app/dashboard/(app)/commerce/actions";
import { toast } from "sonner";
import type {
  CommerceOrder,
  CommerceTransfer,
  CommerceInvoice,
  OwnershipRecord,
  CommercialProfitLossSummary,
  TransitStatus,
} from "@/lib/commerce";

interface Props {
  initialOrders: CommerceOrder[];
  initialTransfers: CommerceTransfer[];
  initialInvoices: CommerceInvoice[];
  initialOwnershipHistory: OwnershipRecord[];
  initialAnalytics: CommercialProfitLossSummary[];
  availableCattle: { id: string; tag_id: string }[];
}

export function EnterpriseCommerceWorkspace({
  initialOrders,
  initialTransfers,
  initialInvoices,
  initialOwnershipHistory,
  initialAnalytics,
  availableCattle,
}: Props) {
  const [activeTab, setActiveTab] = useState("overview");

  const [showPOModal, setShowPOModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<CommerceInvoice | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showOwnershipModal, setShowOwnershipModal] = useState(false);

  const totalRev = initialOrders
    .filter((o) => o.orderType === "sale")
    .reduce((s, o) => s + o.netTotalAmount, 0);
  const totalPur = initialOrders
    .filter((o) => o.orderType === "purchase")
    .reduce((s, o) => s + o.netTotalAmount, 0);
  const outstanding = initialInvoices
    .filter((i) => i.status !== "paid" && i.status !== "void" && i.status !== "cancelled")
    .reduce((s, i) => s + i.balanceDue, 0);
  const activeInTransit = initialTransfers.filter(
    (t) => t.transitStatus === "in_transit" || t.transitStatus === "dispatched"
  ).length;
  const activeOrdersCount = initialOrders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;

  const totalCostBasis = initialAnalytics.reduce((s, a) => s + a.totalCostBasis, 0);
  const realizedProfit = totalRev - totalCostBasis;
  const netMargin = totalRev > 0 ? (realizedProfit / totalRev) * 100 : 0;

  const metrics = {
    totalRevenue: totalRev,
    totalPurchases: totalPur,
    outstandingReceivables: outstanding,
    activeInTransitCount: activeInTransit,
    activeOrdersCount,
    realizedNetMarginPct: netMargin,
  };

  const handleUpdateTransferStatus = async (
    transferId: string,
    status: TransitStatus,
    notes?: string
  ) => {
    try {
      const res = await updateTransferTransitAction({
        transferId,
        nextStatus: status,
        inspectionNotes: notes,
      });
      if (res.success) {
        toast.success("Transit status updated successfully");
      } else {
        toast.error(res.error || "Failed to update transit status");
      }
    } catch {
      toast.error("Failed to update transit status");
    }
  };

  return (
    <div className="space-y-4">
      <CommerceKpiCards metrics={metrics} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="bg-muted/70 p-1 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs gap-1.5 h-8">
            <LayoutDashboard className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="purchases" className="text-xs gap-1.5 h-8">
            <ShoppingCart className="h-3.5 w-3.5 text-blue-600" /> Purchases (PO)
          </TabsTrigger>
          <TabsTrigger value="sales" className="text-xs gap-1.5 h-8">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Sales &amp; Invoices
          </TabsTrigger>
          <TabsTrigger value="transfers" className="text-xs gap-1.5 h-8">
            <Truck className="h-3.5 w-3.5 text-purple-600" /> Transit &amp; Logistics
          </TabsTrigger>
          <TabsTrigger value="ownership" className="text-xs gap-1.5 h-8">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> Ownership Registry
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5 h-8">
            <BarChart3 className="h-3.5 w-3.5 text-amber-600" /> P&amp;L &amp; Valuation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CommerceOverviewTab
            orders={initialOrders}
            transfers={initialTransfers}
            invoices={initialInvoices}
            onOpenNewPO={() => setShowPOModal(true)}
            onOpenNewSale={() => setShowSaleModal(true)}
            onOpenTransfer={() => setShowTransferModal(true)}
            onOpenOwnership={() => setShowOwnershipModal(true)}
            onOpenPayment={() => {
              setSelectedInvoice(null);
              setShowPaymentModal(true);
            }}
            onSelectTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="purchases">
          <PurchaseOrdersTab orders={initialOrders} onOpenNewPO={() => setShowPOModal(true)} />
        </TabsContent>

        <TabsContent value="sales">
          <SalesInvoicesTab
            orders={initialOrders}
            invoices={initialInvoices}
            onOpenNewSale={() => setShowSaleModal(true)}
            onOpenPayment={(inv) => {
              setSelectedInvoice(inv || null);
              setShowPaymentModal(true);
            }}
          />
        </TabsContent>

        <TabsContent value="transfers">
          <TransferLogisticsTab
            transfers={initialTransfers}
            onOpenTransfer={() => setShowTransferModal(true)}
            onUpdateStatus={handleUpdateTransferStatus}
          />
        </TabsContent>

        <TabsContent value="ownership">
          <OwnershipRegistryTab
            ownershipHistory={initialOwnershipHistory}
            onOpenOwnership={() => setShowOwnershipModal(true)}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <CommercialAnalyticsTab analytics={initialAnalytics} />
        </TabsContent>
      </Tabs>

      <CreatePurchaseOrderModal open={showPOModal} onOpenChange={setShowPOModal} />
      <CreateSaleOrderModal open={showSaleModal} onOpenChange={setShowSaleModal} />
      <RecordPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        selectedInvoice={selectedInvoice}
      />
      <DispatchTransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        availableCattle={availableCattle}
      />
      <OwnershipTransferModal
        open={showOwnershipModal}
        onOpenChange={setShowOwnershipModal}
        availableCattle={availableCattle}
      />
    </div>
  );
}
