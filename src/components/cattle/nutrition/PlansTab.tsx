"use client";

import { Sparkles, Sliders } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PRESET_NUTRITION_PLANS,
  type AiNutritionRecommendation,
} from "@/lib/nutrition/nutrition-engine";

interface PlansTabProps {
  aiRecs: AiNutritionRecommendation[];
  onOpenBalancer: () => void;
}

function fmtBdt(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(1)}K`;
  return `৳${Math.round(n)}`;
}

export function PlansTab({ aiRecs, onOpenBalancer }: PlansTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRESET_NUTRITION_PLANS.map((plan) => (
          <div key={plan.id} className="p-4 rounded-xl border bg-card/70 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                  {plan.targetStage}
                </Badge>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ADG +{plan.targetAdgKg} kg/d
                </span>
              </div>
              <h4 className="font-bold text-sm text-foreground">{plan.name}</h4>
              <p className="text-xs text-muted-foreground">{plan.notes}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/60 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Target CP (Crude Protein):</span>
                <span className="font-mono font-bold text-foreground">{plan.targetCpPercentDm}% DM</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Target TDN (Energy):</span>
                <span className="font-mono font-bold text-foreground">{plan.targetTdnPercentDm}% DM</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Concentrate / Roughage:</span>
                <span className="font-mono font-bold text-foreground">
                  {(plan.defaultConcentrateRatio * 100).toFixed(0)}% / {(plan.defaultRoughageRatio * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1"
              onClick={onOpenBalancer}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Test & Balance Ration Mix</span>
            </Button>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl border border-violet-500/30 bg-violet-500/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">AI Livestock Nutritionist Recommendations</h4>
              <p className="text-xs text-muted-foreground">Automated cost-minimization & rumen buffer recommendations based on your herd stage.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {aiRecs.map((rec) => (
            <div key={rec.id} className="p-3.5 rounded-xl border bg-card/80 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                  {rec.category.replace("_", " ")}
                </Badge>
                {rec.estimatedSavingsBdtPerMonth > 0 && (
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Save {fmtBdt(rec.estimatedSavingsBdtPerMonth)}/mo
                  </span>
                )}
              </div>
              <h5 className="font-bold text-xs text-foreground">{rec.title}</h5>
              <p className="text-[11px] text-muted-foreground">{rec.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
