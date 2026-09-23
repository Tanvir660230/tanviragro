"use client";

import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Lock,
  Plus,
  Scale,
  PieChart,
  Layers,
  AlertCircle,
  FileText,
  Activity,
  CheckCircle2,
  Tag,
  Building2,
} from "lucide-react";
import type { AnimalFinancialLedger } from "@/lib/financial";
import {
  DirectCostModal,
  BatchAllocationModal,
  BiologicalValuationModal,
  AccountingPeriodLockModal,
  JournalReversalModal,
} from "./modals";
import {
  TransactionsTab,
  AnimalPnLTab,
  FarmPnLTab,
  CashFlowTab,
  AllocationTab,
  ValuationTab,
} from "./workspace-tabs";

export interface WorkspaceCostItem {
  id: string;
  category: string;
  amount: number;
  recordedAt: string;
  type: string;
  description: string | null;
  cattleId: string | null;
}

export interface WorkspaceProps {
  businessId: string;
  businessName: string;
  cashPosition: { balance: number; inflow: number; outflow: number };
  animalLedgers: AnimalFinancialLedger[];
  recentCosts: WorkspaceCostItem[];
  recentSales: Array<{ id: string; salePrice: number; soldAt: string; cattleId: string; buyerName?: string }>;
  periodLocks: Array<{ id: string; lockName: string; startDate: string; endDate: string; isLocked: boolean }>;
  costAllocations: Array<{ id: string; batchNumber: string; category: string; method: string; amount: number; recipientsCount: number; appliedDate: string }>;
  biologicalValuations: Array<{ id: string; valuationNumber: string; valuationDate: string; marketRatePerKg: number; totalHeadCount: number; fairValue: number; unrealizedGainLoss: number }>;
}

export function EnterpriseLivestockFinancialWorkspace(props: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"transactions" | "animal_pnl" | "farm_pnl" | "cash_flow" | "allocation" | "valuation">("transactions");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showCostModal, setShowCostModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState<{ isOpen: boolean; id: string; ref: string }>({ isOpen: false, id: "", ref: "" });

  const totalBioValuation = props.animalLedgers.reduce((s, a) => s + (a.currentBiologicalValue || 0), 0);
  const totalSaleRevenue = props.animalLedgers.reduce((s, a) => s + (a.saleRevenue || 0), 0);
  const totalDirectCosts = props.animalLedgers.reduce((s, a) => s + (a.totalAccumulatedCost || 0), 0);
  const totalNetProfit = props.animalLedgers.reduce((s, a) => s + (a.netProfit || 0), 0);
  const overallMargin = totalSaleRevenue > 0 ? ((totalNetProfit / totalSaleRevenue) * 100).toFixed(1) : "0.0";
  const totalWeightGain = props.animalLedgers.reduce((s, a) => s + (a.weightGainKg || 0), 0);
  const avgCostPerKg = totalWeightGain > 0
    ? (props.animalLedgers.reduce((s, a) => s + (a.feedCost + a.medicineCost + a.vaccineCost + a.laborAllocated), 0) / totalWeightGain).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><Scale className="h-4 w-4 text-emerald-500" /> Bio Val</div>
          <div className="mt-2 text-xl font-bold text-foreground">৳{totalBioValuation.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><DollarSign className="h-4 w-4 text-blue-500" /> Cash</div>
          <div className="mt-2 text-xl font-bold text-foreground">৳{props.cashPosition.balance.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><TrendingUp className="h-4 w-4 text-primary" /> Revenue</div>
          <div className="mt-2 text-xl font-bold text-foreground">৳{totalSaleRevenue.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><TrendingDown className="h-4 w-4 text-amber-500" /> Costs</div>
          <div className="mt-2 text-xl font-bold text-foreground">৳{totalDirectCosts.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><Activity className="h-4 w-4 text-emerald-500" /> Profit</div>
          <div className={`mt-2 text-xl font-bold ${totalNetProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>৳{totalNetProfit.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><Layers className="h-4 w-4 text-indigo-500" /> Cost/kg</div>
          <div className="mt-2 text-xl font-bold text-foreground">৳{avgCostPerKg}/kg</div>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase"><ShieldCheck className="h-4 w-4 text-primary" /> Controls</div>
          <div className="mt-2 text-xl font-bold text-foreground">{props.periodLocks.filter(p => p.isLocked).length > 0 ? "Locked" : "Open"}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-2xl border border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Quick Actions:</span>
          <button onClick={() => setShowCostModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Direct Cost
          </button>
          <button onClick={() => setShowAllocModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted shadow-sm">
            <PieChart className="h-3.5 w-3.5 text-indigo-500" /> Batch Allocate
          </button>
          <button onClick={() => setShowBioModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted shadow-sm">
            <Scale className="h-3.5 w-3.5 text-emerald-500" /> IAS 41 Revaluation
          </button>
        </div>
        <button onClick={() => setShowLockModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted shadow-sm">
          <Lock className="h-3.5 w-3.5 text-amber-500" /> Period Locks
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
          feedback.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      <div className="border-b border-border/80">
        <nav className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: "transactions", label: "Transactions & Journal", icon: FileText },
            { id: "animal_pnl", label: "Animal Unit Economics", icon: Tag },
            { id: "farm_pnl", label: "Farm & Breed Profit", icon: Building2 },
            { id: "cash_flow", label: "Cash Flow & Runway", icon: DollarSign },
            { id: "allocation", label: "Cost Allocation Logs", icon: PieChart },
            { id: "valuation", label: "Biological Valuations", icon: Scale },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "transactions" && (
        <TransactionsTab
          recentCosts={props.recentCosts}
          onOpenReverseModal={(id, ref) => setShowReverseModal({ isOpen: true, id, ref })}
        />
      )}

      {activeTab === "animal_pnl" && (
        <AnimalPnLTab animalLedgers={props.animalLedgers} />
      )}

      {activeTab === "farm_pnl" && (
        <FarmPnLTab
          headCount={props.animalLedgers.length}
          totalDirectCosts={totalDirectCosts}
          totalNetProfit={totalNetProfit}
          totalBioValuation={totalBioValuation}
          overallMargin={overallMargin}
          avgCostPerKg={avgCostPerKg}
        />
      )}

      {activeTab === "cash_flow" && (
        <CashFlowTab
          cashBalance={props.cashPosition.balance}
          totalSaleRevenue={totalSaleRevenue}
        />
      )}

      {activeTab === "allocation" && (
        <AllocationTab
          costAllocations={props.costAllocations}
          onOpenAllocModal={() => setShowAllocModal(true)}
        />
      )}

      {activeTab === "valuation" && (
        <ValuationTab
          biologicalValuations={props.biologicalValuations}
          onOpenBioModal={() => setShowBioModal(true)}
        />
      )}

      {showCostModal && (
        <DirectCostModal
          onClose={() => setShowCostModal(false)}
          onSuccess={(msg) => {
            setShowCostModal(false);
            setFeedback({ type: "success", message: msg });
          }}
        />
      )}

      {showAllocModal && (
        <BatchAllocationModal
          onClose={() => setShowAllocModal(false)}
          onSuccess={(msg) => {
            setShowAllocModal(false);
            setFeedback({ type: "success", message: msg });
          }}
        />
      )}

      {showBioModal && (
        <BiologicalValuationModal
          onClose={() => setShowBioModal(false)}
          onSuccess={(msg) => {
            setShowBioModal(false);
            setFeedback({ type: "success", message: msg });
          }}
        />
      )}

      {showLockModal && (
        <AccountingPeriodLockModal
          onClose={() => setShowLockModal(false)}
          onSuccess={(msg) => {
            setShowLockModal(false);
            setFeedback({ type: "success", message: msg });
          }}
        />
      )}

      {showReverseModal.isOpen && (
        <JournalReversalModal
          journalId={showReverseModal.id}
          reference={showReverseModal.ref}
          onClose={() => setShowReverseModal({ isOpen: false, id: "", ref: "" })}
          onSuccess={(msg) => {
            setShowReverseModal({ isOpen: false, id: "", ref: "" });
            setFeedback({ type: "success", message: msg });
          }}
        />
      )}
    </div>
  );
}


 
