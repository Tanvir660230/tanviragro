"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Search, Plus, KeyRound, FileCheck } from "lucide-react";
import type { OwnershipRecord } from "@/lib/commerce";

interface Props {
  ownershipHistory: OwnershipRecord[];
  onOpenOwnership: () => void;
}

export function OwnershipRegistryTab({ ownershipHistory, onOpenOwnership }: Props) {
  const [search, setSearch] = useState("");

  const filtered = ownershipHistory.filter((rec) => {
    return (
      (rec.tagId && rec.tagId.toLowerCase().includes(search.toLowerCase())) ||
      rec.previousOwnerName.toLowerCase().includes(search.toLowerCase()) ||
      rec.newOwnerName.toLowerCase().includes(search.toLowerCase()) ||
      (rec.digitalSignatureHash && rec.digitalSignatureHash.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <Card className="border border-border/70">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Animal Ownership Registry &amp; Digital Provenance
          </CardTitle>
          <CardDescription className="text-xs">
            Cryptographically verifiable chain of custody, legal bills of sale, and transfer agreements
          </CardDescription>
        </div>
        <Button size="sm" onClick={onOpenOwnership} className="text-xs h-8 gap-1.5 font-semibold">
          <Plus className="h-3.5 w-3.5" /> Transfer Ownership
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by animal tag, owner name or digital signature hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />

        <div className="rounded-lg border border-border/70 overflow-hidden divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No ownership transfer history records found.
            </div>
          ) : (
            filtered.map((rec) => (
              <div key={rec.id} className="p-3.5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Tag: #{rec.tagId || "N/A"}</span>
                    <Badge variant="outline" className="text-[10px] py-0 capitalize border-indigo-300 text-indigo-700 bg-indigo-50/50">
                      {rec.transferReason}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] py-0 text-emerald-700 border-emerald-300 bg-emerald-50/50 flex items-center gap-1">
                      <KeyRound className="h-2.5 w-2.5" /> Verified Chain
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Transfer: <span className="font-semibold text-foreground">{rec.previousOwnerName}</span> ➔ <span className="font-semibold text-foreground">{rec.newOwnerName}</span> • Date: {rec.transferDate}
                    {rec.witnessName ? ` • Witness: ${rec.witnessName}` : ""}
                  </div>
                  {rec.digitalSignatureHash && (
                    <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded w-fit">
                      Hash: {rec.digitalSignatureHash}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">৳{rec.transferPrice.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{rec.approvalStatus}</div>
                </div>
              </div>
            ))
          )}
        </div>

        </div>
      </CardContent>
    </Card>
  );
}
