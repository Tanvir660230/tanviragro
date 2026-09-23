"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Search, Plus, Receipt, FileText } from "lucide-react";
import type { CommerceOrder, CommerceInvoice } from "@/lib/commerce";

interface Props {
  orders: CommerceOrder[];
  invoices: CommerceInvoice[];
  onOpenNewSale: () => void;
  onOpenPayment: (inv?: CommerceInvoice) => void;
}

export function SalesInvoicesTab({ orders, invoices, onOpenNewSale, onOpenPayment }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"invoices" | "orders">("invoices");

  const saleOrders = orders.filter((o) => o.orderType === "sale");
  const filteredInvoices = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.customerOrVendorName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrders = saleOrders.filter((ord) =>
    ord.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    ord.counterpartyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border border-border/70">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Sales Orders &amp; Commercial Invoicing
          </CardTitle>
          <CardDescription className="text-xs">
            Manage customer quotations, invoices, installment plans &amp; settlements
          </CardDescription>
        </div>
        <Button size="sm" onClick={onOpenNewSale} className="text-xs h-8 gap-1.5 font-semibold">
          <Plus className="h-3.5 w-3.5" /> Create Sale Order
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by invoice#, order# or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={filterType === "invoices" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("invoices")}
              className="h-8 text-xs gap-1.5"
            >

        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          {filterType === "invoices" ? (
            filteredInvoices.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No invoices found.</div>
            ) : (
              filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold">
                      <span>{inv.invoiceNumber}</span>
                      <Badge variant="outline" className="text-[10px] py-0 border-emerald-300 text-emerald-700 bg-emerald-50/50">
                        {inv.customerOrVendorName}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 capitalize">{inv.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Issued: {inv.issueDate} • Due: {inv.dueDate}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold">৳{inv.totalAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-amber-600 font-semibold">Due: ৳{inv.balanceDue.toLocaleString()}</div>
                    </div>
                    {inv.balanceDue > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => onOpenPayment(inv)} className="h-7 text-[11px]">
                        Pay
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            filteredOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No sale orders found.</div>
            ) : (
              filteredOrders.map((so) => (
                <div key={so.id} className="p-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-bold">
                      <span>{so.orderNumber}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{so.counterpartyName}</Badge>
                      <Badge variant="outline" className="text-[10px] py-0 capitalize">{so.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Date: {so.orderDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">৳{so.netTotalAmount.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{so.paymentStatus}</div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

              <Receipt className="h-3.5 w-3.5" /> Invoices ({invoices.length})
            </Button>
            <Button
              variant={filterType === "orders" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("orders")}
              className="h-8 text-xs gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" /> Sale Orders ({saleOrders.length})
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
