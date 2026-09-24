/**
 * Enterprise Feed & Nutrition Platform Types & Contracts
 */

export type FeedCategory =
  | "energy_concentrate"
  | "protein_concentrate"
  | "dry_roughage"
  | "green_roughage"
  | "mineral_supplement"
  | "premix_additive";

export interface FeedNutrientProfile {
  id: string;
  name: string;
  category: FeedCategory;
  dmPercent: number;        // Dry Matter fraction e.g. 0.90
  cpPercentDm: number;      // Crude Protein % on DM basis e.g. 18.5
  tdnPercentDm: number;     // Total Digestible Nutrients % on DM basis e.g. 78.0
  meMcalKgDm?: number;      // Metabolizable energy Mcal/kg DM
  caPercentDm?: number;     // Calcium %
  pPercentDm?: number;      // Phosphorus %
  /** weighted-average BDT per kg as fed; null = no known price (shown as "No data", never guessed) */
  costPerKgAsFed: number | null;
  /** signed stock on hand in kg (negative = stock-in missing) */
  currentStockKg: number;
  /** null = no alert threshold set */
  lowStockThresholdKg: number | null;
  /** "reference" = typical values for the category, not measured for this feed */
  nutrientSource?: "reference" | "measured";
  batchNumber?: string;
  expiryDate?: string | null;
  supplierName?: string;
  warehouseLocation?: string;
}

export interface RationIngredientInput {
  ingredient: FeedNutrientProfile;
  asFedKg: number;
}

export type NutritionPlanType =
  | "age_based"
  | "weight_based"
  | "species_based"
  | "breed_based"
  | "pregnancy_based"
  | "health_based"
  | "custom";

export type FeedingSlot = "morning" | "noon" | "evening" | "night";

export interface NutritionPlan {
  id: string;
  businessId: string;
  name: string;
  planType: NutritionPlanType;
  targetStage: "calf" | "grower" | "fattener" | "finishing" | "pregnant" | "lactating" | "maintenance";
  targetAdgKg: number;
  dmiPercentBw: number;
  targetCpPercentDm: number;
  targetTdnPercentDm: number;
  defaultConcentrateRatio: number;
  defaultRoughageRatio: number;
  slots: {
    slot: FeedingSlot;
    timeOfDay: string;
    sharePercent: number;
  }[];
  active: boolean;
  notes?: string;
}

export type SessionStatus = "planned" | "in_progress" | "completed" | "missed" | "partial";

export interface FeedConsumptionRecord {
  id: string;
  sessionId: string;
  cattleId?: string;
  tagId?: string;
  groupId?: string;
  penId?: string;
  itemId: string;
  itemName: string;
  targetAsFedKg: number;
  actualDispensedKg: number;
  wasteKg: number;
  netConsumedKg: number;
  unitCostBdt: number;
  totalCostBdt: number;
  wasteCostBdt: number;
  operatorName: string;
  recordedAt: string;
  notes?: string;
  imageUrl?: string;
}

export interface FeedSession {
  id: string;
  businessId: string;
  planId?: string;
  dateISO: string;
  slot: FeedingSlot;
  scheduledTime: string;
  targetGroupOrPen: string;
  cattleCount: number;
  status: SessionStatus;
  targetTotalKg: number;
  actualTotalKg: number;
  totalWasteKg: number;
  totalCostBdt: number;
  wasteCostBdt: number;
  feederOperator?: string;
  startedAt?: string;
  completedAt?: string;
  records: FeedConsumptionRecord[];
  notes?: string;
}

export interface CattleNutritionState {
  id: string;
  tagId: string;
  breed: string | null;
  gender: string;
  currentWeightKg: number;
  initialWeightKg: number;
  targetWeightKg: number;
  expectedDailyGainKg: number;
  daysOnFarm: number;
  isQuarantined?: boolean;
  isPregnant?: boolean;
  roughageOverrideKg?: number | null;
  manualFeedOverrideKg?: number | null;
}

export interface CalculatedAnimalRequirement {
  cattleId: string;
  tagId: string;
  projectedWeightKg: number;
  dailyDmiKg: number;
  targetConcentrateKg: number;
  targetRoughageKg: number;
  targetRoughageDmKg: number;
  targetTotalAsFedKg: number;
  acclimatizationFactor: number;
  targetCpPercentDm: number;
  targetTdnPercentDm: number;
  estimatedDailyCostBdt: number;
  isAcclimatizing: boolean;
}

export interface RationComplianceResult {
  totalAsFedKg: number;
  totalDryMatterKg: number;
  crudeProteinPercentDm: number;
  tdnPercentDm: number;
  totalDailyCostBdt: number;
  costPerKgDryMatter: number;
  costPerKgLiveGainExpected: number;
  nutritionScore: number;
  isNutritionallyAdequate: boolean;
  complianceChecks: {
    nutrient: string;
    target: number;
    actual: number;
    unit: string;
    passed: boolean;
    deviationPercent: number;
  }[];
}

export interface HerdNutritionSummary {
  totalActiveCattle: number;
  totalDailyDmiKg: number;
  totalDailyConcentrateKg: number;
  totalDailyRoughageKg: number;
  totalDailyAsFedKg: number;
  totalEstimatedDailyCostBdt: number;
  averageCostPerHeadBdt: number;
  averageFcr: number;
  acclimatizingCount: number;
  quarantinedCount: number;
  feedEfficiencyRatio: number;
}

export type NutritionAlertType =
  | "low_feed_stock"
  | "missed_feeding"
  | "over_feeding"
  | "under_feeding"
  | "expired_feed"
  | "high_feed_waste"
  | "abnormal_consumption";

export interface NutritionAlert {
  id: string;
  type: NutritionAlertType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  entityId?: string;
  entityType?: "item" | "cattle" | "session" | "group";
  timestamp: string;
  recommendedAction: string;
  actionHref?: string;
}

export interface AiNutritionRecommendation {
  id: string;
  cattleId?: string;
  rationId?: string;
  title: string;
  category: "cost_saving" | "growth_acceleration" | "health_buffer" | "waste_reduction";
  impactSummary: string;
  estimatedSavingsBdtPerMonth: number;
  projectedAdgGainKg: number;
  details: string;
  applied: boolean;
}
