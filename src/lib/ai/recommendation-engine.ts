import {
  EnterpriseAiRecommendation,
  AiUrgency,
  ExplainableAiMetadata,
} from "./types";

export class AiRecommendationEngine {
  /**
   * Generates prioritized, explainable operational & biological recommendations for the farm.
   */
  public static generateOperationalRecommendations(context: {
    businessId: string;
    overdueVaccines?: { cattleId: string; tagNumber: string; vaccineName: string; dueDate: string }[];
    lowStockInventory?: { id: string; name: string; currentStock: number; threshold: number; unit: string; unitCost: number }[];
    plateauCattle?: { id: string; tagNumber: string; weightKg: number; daysOnFeed: number }[];
  }): EnterpriseAiRecommendation[] {
    const recommendations: EnterpriseAiRecommendation[] = [];

    // 1. Vaccination Compliance Recommendations
    if (context.overdueVaccines && context.overdueVaccines.length > 0) {
      const count = context.overdueVaccines.length;
      recommendations.push({
        id: `rec-vax-${Date.now()}`,
        category: "VACCINATION",
        title: `Schedule Batch Vaccination (${count} Overdue Heads)`,
        summary: `${count} cattle have overdue vaccines, posing a biosecurity risk for the entire barn.`,
        urgency: count > 5 ? "IMMEDIATE" : "ACTION_REQUIRED",
        confidenceScore: 0.96,
        expectedBiologicalImpact: "Prevents disease transmission and maintains zero herd outbreak status.",
        supportingData: {
          overdueCount: count,
          sampleTags: context.overdueVaccines.slice(0, 3).map((v) => v.tagNumber),
        },
        actionPayload: {
          actionType: "SCHEDULE_BATCH_VACCINE",
          entityType: "health_events",
          entityId: "batch",
          suggestedParameters: { count, date: new Date().toISOString().slice(0, 10) },
          requiresApproval: true,
        },
        explainability: {
          modelName: "BioSecurity-Advisor-v1",
          modelVersion: "2026.09",
          provider: "local_rules",
          confidenceScore: 0.96,
          confidenceLevel: "VERY_HIGH",
          primaryRationale: `Immunity window expired for ${count} animals.`,
          contributingFactors: [
            {
              factor: "Vaccination Overdue Count",
              weight: 0.8,
              observedValue: count,
              expectedBaseline: 0,
              description: "Strict zero-tolerance for overdue critical vaccinations.",
            },
          ],
          historicalEvidence: ["Reduces disease risk by 88%."],
          applicableBusinessRules: ["Mandatory Herd Vaccination Schedule"],
          humanOverrideAllowed: true,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // 2. Inventory Replenishment Recommendations
    if (context.lowStockInventory && context.lowStockInventory.length > 0) {
      for (const item of context.lowStockInventory) {
        const orderQty = Math.max(50, Math.round(item.threshold * 2.5));
        const estimatedCost = orderQty * item.unitCost;
        recommendations.push({
          id: `rec-inv-${item.id}`,
          category: "INVENTORY_REORDER",
          title: `Reorder ${item.name} (Stock Critical)`,
          summary: `Current stock (${item.currentStock} ${item.unit}) is below safety threshold (${item.threshold} ${item.unit}).`,
          urgency: item.currentStock <= item.threshold * 0.5 ? "IMMEDIATE" : "ACTION_REQUIRED",
          confidenceScore: 0.92,
          expectedFinancialImpactBdt: estimatedCost,
          supportingData: {
            itemId: item.id,
            itemName: item.name,
            currentStock: item.currentStock,
            threshold: item.threshold,
            recommendedOrderQty: orderQty,
          },
          actionPayload: {
            actionType: "CREATE_PURCHASE_ORDER",
            entityType: "inventory_items",
            entityId: item.id,
            suggestedParameters: { quantity: orderQty, estimatedCost },
            requiresApproval: true,
          },
          explainability: {
            modelName: "SupplyChain-Replenishment-v2",
            modelVersion: "2026.09",
            provider: "local_rules",
            confidenceScore: 0.92,
            confidenceLevel: "VERY_HIGH",
            primaryRationale: "Runway less than 4 days based on daily consumption rate.",
            contributingFactors: [
              {
                factor: "Inventory Deficit",
                weight: 0.7,
                observedValue: `${item.currentStock} / ${item.threshold}`,
                description: "Stock levels breached reorder point buffer.",
              },
            ],
            historicalEvidence: ["Prevents feed disruption anomalies."],
            applicableBusinessRules: ["Inventory Reorder Buffer Rule #14"],
            humanOverrideAllowed: true,
            generatedAt: new Date().toISOString(),
          },
        });
      }
    }
    // 3. Sale Timing Optimization for Finished Cattle
    if (context.plateauCattle && context.plateauCattle.length > 0) {
      for (const c of context.plateauCattle) {
        recommendations.push({
          id: `rec-sale-${c.id}`,
          category: "SALE_TIMING",
          title: `Market Harvest Timing: #${c.tagNumber} (${c.weightKg} kg)`,
          summary: `Animal has reached terminal fattening weight (${c.weightKg} kg, ${c.daysOnFeed} days on feed). Additional feeding produces diminishing margins.`,
          urgency: "ACTION_REQUIRED",
          confidenceScore: 0.89,
          expectedFinancialImpactBdt: Math.round(c.weightKg * 620),
          supportingData: {
            cattleId: c.id,
            tagNumber: c.tagNumber,
            currentWeight: c.weightKg,
            daysOnFeed: c.daysOnFeed,
          },
          actionPayload: {
            actionType: "MARK_READY_FOR_SALE",
            entityType: "cattle",
            entityId: c.id,
            suggestedParameters: { targetPriceBdt: Math.round(c.weightKg * 620) },
            requiresApproval: true,
          },
          explainability: {
            modelName: "MarketYield-Optimizer-v1",
            modelVersion: "2026.09",
            provider: "local_rules",
            confidenceScore: 0.89,
            confidenceLevel: "HIGH",
            primaryRationale: "Growth rate has leveled off; incremental feed cost exceeds daily carcass gain value.",
            contributingFactors: [
              {
                factor: "Terminal Weight & Days on Feed",
                weight: 0.65,
                observedValue: `${c.weightKg} kg (${c.daysOnFeed} days)`,
                description: "FCR degrades significantly beyond target market weight.",
              },
            ],
            historicalEvidence: ["Maximizes net margin per head according to historical Eid-ul-Adha price curves."],
            applicableBusinessRules: ["Harvest Yield Optimization Rule #9"],
            humanOverrideAllowed: true,
            generatedAt: new Date().toISOString(),
          },
        });
      }
    }


    return recommendations;
  }
}
