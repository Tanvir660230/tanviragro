"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingCart,
  Truck,
  Receipt,
  FileCheck2,
  DollarSign,
} from "lucide-react";

interface Props {
  metrics: {
    totalRevenue: number;
    totalPurchases: number;
    outstandingReceivables: number;
    activeInTransitCount: number;
    activeOrdersCount: number;
    realizedNetMarginPct: number;
  };
}

export function CommerceKpiCards({ metrics }: Props) {
  const cards = [
    {
      title: "Commercial Revenue",
      value: `৳${metrics.totalRevenue.toLocaleString()}`,
      subtext: "Gross livestock & trading income",
      icon: DollarSign,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Total Purchases",
      value: `৳${metrics.totalPurchases.toLocaleString()}`,
      subtext: "Livestock & feed acquisitions",
      icon: ShoppingCart,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "Outstanding Invoices",
      value: `৳${metrics.outstandingReceivables.toLocaleString()}`,
      subtext: "Unsettled customer receivables",
      icon: Receipt,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "In-Transit Logistics",
      value: `${metrics.activeInTransitCount} Dispatches`,
      subtext: "Animals currently on transit",
      icon: Truck,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "Realized Net Margin",
      value: `${metrics.realizedNetMarginPct.toFixed(1)}%`,
      subtext: "Net profit after feed & logistics",
      icon: TrendingUp,
      color: metrics.realizedNetMarginPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Active Contracts & Orders",
      value: `${metrics.activeOrdersCount} Active`,
      subtext: "Open trade agreements",
      icon: FileCheck2,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="border border-border/70 shadow-xs hover:border-primary/40 transition-colors">
            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground line-clamp-1">{card.title}</span>
                <div className={`p-1.5 rounded-md ${card.bg} ${card.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-foreground">{card.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{card.subtext}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
