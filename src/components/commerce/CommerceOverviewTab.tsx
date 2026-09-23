"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  TrendingUp,
  Truck,
  Receipt,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import type { CommerceOrder, CommerceTransfer, CommerceInvoice } from "@/lib/commerce";

interface Props {
  orders: CommerceOrder[];
  transfers: CommerceTransfer[];
  invoices: CommerceInvoice[];
  onOpenNewPO: () => void;
  onOpenNewSale: () => void;
  onOpenTransfer: () => void;
  onOpenOwnership: () => void;
  onOpenPayment: () => void;
  onSelectTab: (tab: string) => void;
}

export function CommerceOverviewTab({
  orders,
  transfers,
  invoices,
  onOpenNewPO,
  onOpenNewSale,
  onOpenTransfer,
  onOpenOwnership,
  onOpenPayment,
  onSelectTab,
}: Props) {
  const recentOrders = orders.slice(0, 5);
  const activeTransfers = transfers.filter((t) => t.transitStatus === "in_transit" || t.transitStatus === "dispatched");
  const pendingInvoices = invoices.filter((i) => i.status === "issued" || i.status === "partially_paid" || i.status === "overdue").slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ACTION BAR */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardContent className="p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Commercial Hub</h3>
              <p className="text-xs text-muted-foreground">Purchases, sales, logistics &amp; ownership</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onOpenNewPO} className="h-8 text-xs font-semibold gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> New PO
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenNewSale} className="h-8 text-xs font-semibold gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> New Sale
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenTransfer} className="h-8 text-xs font-semibold gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Dispatch Transfer
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenOwnership} className="h-8 text-xs font-semibold gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Transfer Ownership
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenPayment} className="h-8 text-xs font-semibold gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Record Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TWO COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/70">
          <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> Recent Orders
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onSelectTab("purchases")} className="text-xs h-7 gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-3.5 pt-1 space-y-2">
            {recentOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No orders recorded yet.</div>
            ) : (
              recentOrders.map((ord) => (
                <div key={ord.id} className="p-2 rounded-lg border border-border/60 bg-card flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span>{ord.orderNumber}</span>
                      <Badge variant="outline" className="text-[10px] py-0 capitalize">{ord.orderType}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{ord.counterpartyName} • {ord.orderDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">৳{ord.netTotalAmount.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{ord.paymentStatus}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-border/70">
            <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600" /> Active Dispatches
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onSelectTab("transfers")} className="text-xs h-7 gap-1">
                Logistics <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 space-y-2">
              {activeTransfers.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No in-transit dispatches.</div>
              ) : (
                activeTransfers.map((trf) => (
                  <div key={trf.id} className="p-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-500/5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold">{trf.transferNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{trf.originName} ➔ {trf.destinationName} ({trf.cattleIds.length} head)</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-800">{trf.transitStatus}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-600" /> Outstanding Invoices
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onSelectTab("sales")} className="text-xs h-7 gap-1">
                Invoices <ArrowRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 space-y-2">
              {pendingInvoices.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No unpaid invoices.</div>
              ) : (
                pendingInvoices.map((inv) => (
                  <div key={inv.id} className="p-2 rounded-lg border border-border/60 bg-card flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold">{inv.invoiceNumber}</div>
                      <div className="text-[11px] text-muted-foreground">{inv.customerOrVendorName} (Due {inv.dueDate})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-600">৳{inv.balanceDue.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">Total: ৳{inv.totalAmount.toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

