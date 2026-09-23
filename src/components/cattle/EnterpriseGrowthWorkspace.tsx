"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, Layers, Target, AlertTriangle, BarChart3, Users } from "lucide-react";
import { type GrowthHerdAnalytics } from "@/lib/growth/types";
import { GrowthKpiCards } from "./growth/GrowthKpiCards";
import { GrowthHerdTab } from "./growth/GrowthHerdTab";
import { GrowthAnalyticsTab } from "./growth/GrowthAnalyticsTab";
import { GrowthAlertsTab } from "./growth/GrowthAlertsTab";
import { RecordWeightModal } from "./growth/RecordWeightModal";
import { BulkWeightModal } from "./growth/BulkWeightModal";
import { GrowthTargetModal } from "./growth/GrowthTargetModal";
import { acknowledgeGrowthAlertAction } from "@/app/dashboard/(app)/cattle/growth-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  data: GrowthHerdAnalytics;
}

export function EnterpriseGrowthWorkspace({ data }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("herd");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [selectedCattleId, setSelectedCattleId] = useState<string | null>(null);

  const handleOpenWeigh = (cattleId?: string) => {
    setSelectedCattleId(cattleId || null);
    setRecordModalOpen(true);
  };

  const handleOpenTarget = (cattleId?: string) => {
    setSelectedCattleId(cattleId || null);
    setTargetModalOpen(true);
  };

  const handleAcknowledgeAlert = async (cattleId: string, alertType: string) => {
    const res = await acknowledgeGrowthAlertAction(cattleId, alertType);
    if (res.success) {
      toast.success("Alert acknowledged");
      router.refresh();
    } else {
      toast.error(res.error || "Failed");
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Weight & Growth Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time ADG tracking, growth trajectories, target weight finish forecasting, and automated anomaly alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkModalOpen(true)}
            className="text-xs h-8 border-border/70"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" /> Batch Weigh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenWeigh()}
            className="text-xs h-8 font-semibold shadow-xs"
          >
            <Scale className="h-3.5 w-3.5 mr-1.5" /> Record Weigh-In
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <GrowthKpiCards summary={data.summary} />

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-9 bg-muted/50 p-1">
          <TabsTrigger value="herd" className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Herd Registry
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Benchmarks
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Anomaly Alerts
            {data.alerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-4 ml-1">
                {data.alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="herd" className="mt-0 outline-hidden">
          <GrowthHerdTab
            profiles={data.profiles}
            onOpenWeighModal={(id) => handleOpenWeigh(id)}
            onOpenTargetModal={(id) => handleOpenTarget(id)}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 outline-hidden">
          <GrowthAnalyticsTab
            profiles={data.profiles}
            penBenchmarks={data.penBenchmarks}
            breedBenchmarks={data.breedBenchmarks}
          />
        </TabsContent>

        <TabsContent value="alerts" className="mt-0 outline-hidden">
          <GrowthAlertsTab
            alerts={data.alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onOpenWeighModal={(id) => handleOpenWeigh(id)}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RecordWeightModal
        open={recordModalOpen}
        onOpenChange={setRecordModalOpen}
        cattleList={data.profiles}
        preselectedCattleId={selectedCattleId}
        onSuccess={handleRefresh}
      />

      <BulkWeightModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        cattleList={data.profiles}
        onSuccess={handleRefresh}
      />

      <GrowthTargetModal
        open={targetModalOpen}
        onOpenChange={setTargetModalOpen}
        cattleList={data.profiles}
        preselectedCattleId={selectedCattleId}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
