"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Warehouse,
  UserCheck,
  Calendar,
  DollarSign,
  QrCode,
  FileSpreadsheet,
  ExternalLink,
  Receipt,
  HeartPulse,
} from "lucide-react";
import type { Cattle } from "@/types/database";

interface RelatedRecordsPanelProps {
  cattle: Cattle;
  onNavigateTab: (tabId: string) => void;
}

export function RelatedRecordsPanel({ cattle: c, onNavigateTab }: RelatedRecordsPanelProps) {
  return (
    <div className="rounded-2xl bg-card border border-border/80 p-5 shadow-card space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        Associated Farm & Ledger Links
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Livestock Register</span>
          <div className="font-bold text-sm">Tag #{c.tag_id}</div>
          <Link
            href="/dashboard/cattle"
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-1"
          >
            All Animals <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Health & Vaccination Hub</span>
          <div className="font-bold text-sm">Medical Records</div>
          <Link
            href="/dashboard/cattle/health"
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-1"
          >
            Health Hub <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Feed Ration & Inventory</span>
          <div className="font-bold text-sm">Feedlot Management</div>
          <Link
            href="/dashboard/cattle/feed-planning"
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-1"
          >
            Feed Planning <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Financial Accounts</span>
          <div className="font-bold text-sm">Cost Entries & P&L</div>
          <Link
            href="/dashboard/finance"
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-1"
          >
            Finance Module <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}