"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Search, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import type { CommerceTransfer, TransitStatus } from "@/lib/commerce";

interface Props {
  transfers: CommerceTransfer[];
  onOpenTransfer: () => void;
  onUpdateStatus: (transferId: string, nextStatus: TransitStatus) => void;
}

export function TransferLogisticsTab({ transfers, onOpenTransfer, onUpdateStatus }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = transfers.filter((trf) => {
    const matchesSearch =
      trf.transferNumber.toLowerCase().includes(search.toLowerCase()) ||
      trf.originName.toLowerCase().includes(search.toLowerCase()) ||
      trf.destinationName.toLowerCase().includes(search.toLowerCase()) ||
      (trf.driverName && trf.driverName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === "all" || trf.transitStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="border border-border/70">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-purple-600" />
            Transfer Logistics &amp; Transport Manifests
          </CardTitle>
          <CardDescription className="text-xs">
            Manage cattle inter-farm transfers, driver dispatches, vehicle manifests, and arrival inspection checklists
          </CardDescription>
        </div>
        <Button size="sm" onClick={onOpenTransfer} className="text-xs h-8 gap-1.5 font-semibold">
          <Plus className="h-3.5 w-3.5" /> Dispatch Transfer
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by transfer#, origin, destination, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {["all", "scheduled", "dispatched", "in_transit", "arrived", "completed"].map((st) => (
              <Button
                key={st}
                variant={filterStatus === st ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(st)}
                className="h-8 text-xs capitalize"
              >
                {st.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No transfer manifests found.
            </div>
          ) : (
            filtered.map((trf) => (
              <div key={trf.id} className="p-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{trf.transferNumber}</span>
                    <Badge variant="outline" className="text-[10px] py-0 capitalize border-purple-300 text-purple-700 bg-purple-50/50">
                      {trf.transferType.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] py-0 capitalize">
                      {trf.transitStatus.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Route: <span className="font-medium text-foreground">{trf.originName}</span> ➔ <span className="font-medium text-foreground">{trf.destinationName}</span> • Animals: {trf.cattleIds.length} head
                    {trf.driverName ? ` • Driver: ${trf.driverName} (${trf.driverPhone || "No phone"})` : ""}
                    {trf.vehicleNumber ? ` • Vehicle: ${trf.vehicleNumber}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {trf.transitStatus === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(trf.id, "dispatched")} className="h-7 text-[11px] gap-1">
                      Dispatch <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                  {trf.transitStatus === "dispatched" && (
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(trf.id, "arrived")} className="h-7 text-[11px] gap-1">
                      Mark Arrived
                    </Button>
                  )}
                  {trf.transitStatus === "arrived" && (
                    <Button size="sm" variant="secondary" onClick={() => onUpdateStatus(trf.id, "completed")} className="h-7 text-[11px] gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Complete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

