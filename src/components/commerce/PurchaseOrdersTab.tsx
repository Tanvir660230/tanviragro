"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Plus, Filter, FileText } from "lucide-react";
import type { CommerceOrder } from "@/lib/commerce";

interface Props {
  orders: CommerceOrder[];
  onOpenNewPO: () => void;
}

export function PurchaseOrdersTab({ orders, onOpenNewPO }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const purchaseOrders = orders.filter((o) => o.orderType === "purchase");

  const filtered = purchaseOrders.filter((ord) => {
    const matchesSearch =
      ord.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      ord.counterpartyName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || ord.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="border border-border/70">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            Purchase Orders (PO) &amp; Acquisitions
          </CardTitle>
          <CardDescription className="text-xs">
            Manage incoming cattle purchases, supplier quotations, line item weights, and arrival logistics
          </CardDescription>
        </div>
        <Button size="sm" onClick={onOpenNewPO} className="text-xs h-8 gap-1.5 font-semibold">
          <Plus className="h-3.5 w-3.5" /> Create Purchase Order
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by PO# or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {["all", "draft", "approved", "delivered", "completed"].map((st) => (
              <Button
                key={st}
                variant={filterStatus === st ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(st)}
                className="h-8 text-xs capitalize"
              >
                {st}
              </Button>
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No purchase orders found matching your criteria.
            </div>
          ) : (
            filtered.map((po) => (
              <div key={po.id} className="p-3 bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{po.orderNumber}</span>
                    <Badge variant="outline" className="text-[10px] py-0 border-blue-300 text-blue-700 bg-blue-50/50">
                      Supplier: {po.counterpartyName}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] py-0 capitalize">
                      {po.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Order Date: {po.orderDate} {po.expectedDeliveryDate ? `• Expected Delivery: ${po.expectedDeliveryDate}` : ""}
                    {po.paymentTerms ? ` • Terms: ${po.paymentTerms}` : ""}
                  </div>
                </div>
                <div className="flex items-center sm:text-right justify-between sm:justify-end gap-4">
                  <div>
                    <div className="font-bold text-foreground">৳{po.netTotalAmount.toLocaleString()}</div>
                    <div className={`text-[10px] font-medium capitalize ${po.paymentStatus === "paid" ? "text-emerald-600" : po.paymentStatus === "partially_paid" ? "text-amber-600" : "text-muted-foreground"}`}>
                      Paid: ৳{po.paidAmount.toLocaleString()} ({po.paymentStatus.replace("_", " ")})
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
