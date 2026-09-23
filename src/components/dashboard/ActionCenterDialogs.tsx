"use client";

import React, { useState, useEffect } from "react";
import { ModalForm } from "@/components/enterprise-ui/ModalForm";
import { FormField } from "@/components/enterprise-ui/FormField";
import { CurrencyInput } from "@/components/enterprise-ui/CurrencyInput";
import { getGlobalFormData } from "@/app/dashboard/(app)/global-actions";

export interface ActionCenterDialogsProps {
  activeModal: "expense" | "sale" | "feed" | "weight" | "vaccine" | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ActionCenterDialogs({ activeModal, onClose, onSuccess }: ActionCenterDialogsProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [cattleList, setCattleList] = useState<Array<{ 
    id: string; 
    tag_id: string; 
    breed?: string | null; 
    estimated_weight_kg?: number; 
    suggested_market_price_bdt?: number; 
    market_price_per_kg?: number; 
    purchase_price?: number;
    feed_cost?: number;
    medical_cost?: number;
    other_cost?: number;
    days_on_farm?: number;
    total_cost_basis?: number;
    estimated_profit_bdt?: number;
    estimated_roi_pct?: number;
  }>>([]);

  useEffect(() => {
    if (activeModal) {
      getGlobalFormData().then((res) => {
        if (res.success && res.cattle) {
          setCattleList(res.cattle);
          if (res.cattle.length > 0 && (!selectedTag || !res.cattle.some(c => c.tag_id === selectedTag))) {
            const first = res.cattle[0];
            setSelectedTag(first.tag_id);
            if (activeModal === "sale" && first.suggested_market_price_bdt) {
              setAmount(first.suggested_market_price_bdt);
            }
          }
        }
      });
    }
  }, [activeModal]);

  const currentCattle = cattleList.find(c => c.tag_id === selectedTag) || cattleList[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
      onSuccess?.();
    }, 400);
  };

  return (
    <>
      {/* Quick Expense Modal */}
      <ModalForm
        open={activeModal === "expense"}
        onOpenChange={(open) => !open && onClose()}
        title="Quick Record Farm Expense"
        description="Add operational, medicine, or utility expense into ledger"
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Post Expense"
      >
        <FormField label="Expense Category" required>
          <select className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs">
            <option value="feed">Feed & Fodder Purchase</option>
            <option value="medical">Veterinary & Medicine</option>
            <option value="labor">Barn Labor & Wages</option>
            <option value="utilities">Electricity & Water</option>
            <option value="maintenance">Shed Maintenance</option>
          </select>
        </FormField>
        <FormField label="Link Specific Cattle (Optional)">
          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          >
            <option value="">General Farm Expense (No specific animal)</option>
            {cattleList.map(c => (
              <option key={c.id} value={c.tag_id}>{c.tag_id} {c.breed ? `— ${c.breed}` : ""}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Amount (BDT ৳)" required>
          <CurrencyInput value={amount} onChange={(val) => setAmount(val ?? 0)} placeholder="0.00" />
        </FormField>
        <FormField label="Reference Note / Payee">
          <input
            type="text"
            placeholder="e.g. Purchased 10 bags wheat bran from Green Feed Co"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs"
          />
        </FormField>
      </ModalForm>

      {/* Quick Feed Log Modal */}
      <ModalForm
        open={activeModal === "feed"}
        onOpenChange={(open) => !open && onClose()}
        title="Log Barn Daily Feeding"
        description="Record feed consumption across active pens and deduct from inventory stock"
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Record Feed"
      >
        <FormField label="Target Pen / Barn" required>
          <select className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs">
            <option value="all">All Active Pens (Main Barn) - Stock: 4,200 kg</option>
            <option value="pen-a">Pen A (Fattening Bulls) - Stock: 1,800 kg</option>
            <option value="pen-b">Pen B (Growth Calves) - Stock: 1,400 kg</option>
            <option value="quarantine">Quarantine Shed - Stock: 600 kg</option>
          </select>
        </FormField>
        <FormField label="Feed Item" required>
          <select className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs">
            <option value="silage">Corn Silage (Available: 2,100 kg)</option>
            <option value="wheat_bran">Wheat Bran (Available: 950 kg)</option>
            <option value="concentrate">High Protein Concentrate (Available: 480 kg)</option>
            <option value="straw">Dry Rice Straw (Available: 3,000 kg)</option>
          </select>
        </FormField>
        <FormField label="Total Quantity Dispensed (kg)" required>
          <input
            type="number"
            placeholder="e.g. 150"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          />
        </FormField>
      </ModalForm>

      {/* Quick Weight Record Modal */}
      <ModalForm
        open={activeModal === "weight"}
        onOpenChange={(open) => !open && onClose()}
        title="Record Livestock Weight Check"
        description="Select cattle to log scale weight and automatically calculate ADG & FCR"
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Save Weight Check"
      >
        <FormField label="Select Cattle Tag" required>
          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          >
            {cattleList.length === 0 ? (
              <option value="">No active cattle found in farm</option>
            ) : (
              cattleList.map(c => (
                <option key={c.id} value={c.tag_id}>{c.tag_id} {c.breed ? `— ${c.breed}` : ""}</option>
              ))
            )}
          </select>
        </FormField>
        
        {/* Live Weight Info Badge */}
        {currentCattle && (
          <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-1 border border-border">
            <div className="flex justify-between font-medium text-foreground">
              <span>Selected Animal:</span>
              <span className="font-mono text-primary font-semibold">{currentCattle.tag_id}</span>
            </div>
            {currentCattle.breed && (
              <div className="flex justify-between text-muted-foreground">
                <span>Breed:</span>
                <span>{currentCattle.breed}</span>
              </div>
            )}
          </div>
        )}

        <FormField label="New Scale Weight (kg)" required>
          <input
            type="number"
            step="0.5"
            placeholder="e.g. 552.5"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          />
        </FormField>
        <FormField label="Measurement Method">
          <select className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs">
            <option value="digital_scale">Digital Platform Scale (High Precision)</option>
            <option value="weigh_bridge">Farm Weigh Bridge</option>
            <option value="heart_girth_tape">Heart Girth Estimation Tape</option>
          </select>
        </FormField>
      </ModalForm>

      {/* Quick Record Sale Modal */}
      <ModalForm
        open={activeModal === "sale"}
        onOpenChange={(open) => !open && onClose()}
        title="Record Animal Sale & Invoice"
        description="Select specific livestock for sale, record buyer info, and calculate net profit"
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Post Sale Invoice"
      >
        <FormField label="Select Cattle Tag to Sell" required>
          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-mono"
          >
            {cattleList.length === 0 ? (
              <option value="">No active cattle found in farm</option>
            ) : (
              cattleList.map(c => (
                <option key={c.id} value={c.tag_id}>{c.tag_id} {c.breed ? `— ${c.breed}` : ""}</option>
              ))
            )}
          </select>
        </FormField>

        {/* Live Valuation Summary & Financial P&L Breakdown */}
        {currentCattle && (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-xs space-y-2 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
            <div className="flex justify-between font-semibold">
              <span>Selected Animal Tag:</span>
              <span className="font-mono">{currentCattle.tag_id} {currentCattle.breed ? `(${currentCattle.breed})` : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Expected Weight:</span>
                <span className="font-mono font-bold text-foreground">{currentCattle.estimated_weight_kg ?? 350} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Days on Farm:</span>
                <span className="font-mono font-bold text-foreground">{currentCattle.days_on_farm ?? 0} days</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Purchase Cost:</span>
                <span className="font-mono font-medium">৳ {(currentCattle.purchase_price ?? 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Feed Cost (খাদ্য):</span>
                <span className="font-mono font-medium">৳ {(currentCattle.feed_cost ?? 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Medical Cost (চিকিৎসা):</span>
                <span className="font-mono font-medium">৳ {(currentCattle.medical_cost ?? 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Total Cost Basis:</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-300">৳ {(currentCattle.total_cost_basis ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20">
              <div>
                <span className="text-muted-foreground block text-[10px]">Suggested Price (৳ {currentCattle.market_price_per_kg ?? 450}/kg):</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  ৳ {(currentCattle.suggested_market_price_bdt ?? 0).toLocaleString()}
                </span>
                <span className={`block text-[10px] font-semibold ${(currentCattle.estimated_profit_bdt ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  Est. Profit: ৳ {(currentCattle.estimated_profit_bdt ?? 0).toLocaleString()} (ROI: {currentCattle.estimated_roi_pct ?? 0}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAmount(currentCattle.suggested_market_price_bdt ?? 0)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors text-[11px] shadow-sm"
              >
                Use Suggested Price
              </button>
            </div>
          </div>
        )}

        <FormField label="Final Agreed Sale Price (BDT ৳)" required>
          <CurrencyInput value={amount} onChange={(val) => setAmount(val ?? 0)} placeholder="0.00" />
        </FormField>
        <FormField label="Buyer Name & Mobile Number" required>
          <input
            type="text"
            placeholder="e.g. Md. Rahim (01711-XXXXXX)"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs"
          />
        </FormField>
      </ModalForm>
    </>
  );
}
