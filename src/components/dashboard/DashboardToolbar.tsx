"use client";

import React from "react";
import { SlidersHorizontal, Shield, RotateCcw, Check, Pin } from "lucide-react";
import { useDashboardPersonalization } from "./engine/PersonalizationContext";
import { MASTER_WIDGET_CATALOG } from "./engine/default-widgets";
import { DashboardRole } from "./engine/widget-types";
import { cn } from "@/lib/utils";

const ROLES: { id: DashboardRole; label: string; emoji: string }[] = [
  { id: "owner", label: "CEO / Owner", emoji: "👔" },
  { id: "manager", label: "Farm Manager", emoji: "🌾" },
  { id: "accountant", label: "Accountant", emoji: "📊" },
  { id: "veterinarian", label: "Veterinarian", emoji: "🩺" },
  { id: "staff", label: "Barn Staff", emoji: "🚜" },
  { id: "partner", label: "Investor", emoji: "💼" },
];

export function DashboardToolbar() {
  const {
    role,
    setRole,
    visibleWidgetIds,
    toggleWidgetVisibility,
    pinnedWidgetIds,
    togglePinWidget,
    resetToDefault,
    isCustomizing,
    setIsCustomizing,
  } = useDashboardPersonalization();

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-2xs">
      {/* Role Selection Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1 shrink-0">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>Role View:</span>
        </div>
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              role === r.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="mr-1">{r.emoji}</span>
            {r.label}
          </button>
        ))}
      </div>

      {/* Customize Widgets Button */}
      <div className="flex items-center gap-2 shrink-0 justify-end">
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
            isCustomizing
              ? "bg-primary/10 border-primary text-primary"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Customize Command Center</span>
        </button>
      </div>

      {/* Customization Drawer / Modal */}
      {isCustomizing && (
        <div className="col-span-full w-full pt-3 mt-2 border-t border-border/60 animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground font-serif">Configure Widgets for {ROLES.find(r => r.id === role)?.emoji} {ROLES.find(r => r.id === role)?.label}</span>
            <button
              onClick={resetToDefault}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {MASTER_WIDGET_CATALOG.map((widget) => {
              const isVisible = visibleWidgetIds.includes(widget.id);
              const isPinned = pinnedWidgetIds.includes(widget.id);
              return (
                <div
                  key={widget.id}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all",
                    isVisible ? "bg-card border-primary/40 shadow-2xs" : "bg-muted/30 border-border opacity-60"
                  )}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="font-semibold text-foreground truncate">{widget.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{widget.description}</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePinWidget(widget.id)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        isPinned ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"
                      )}
                      title="Pin widget"
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        isVisible ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
