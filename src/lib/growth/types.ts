export type WeighingMethod =
  | "manual"
  | "scale"
  | "heart_girth_tape"
  | "estimated"
  | "bulk"
  | "qr"
  | "rfid"
  | "bluetooth_scale"
  | "csv_import"
  | "offline";

export type GrowthStage =
  | "calf"       // 0 - 6 months (< 150 kg)
  | "weaner"     // 6 - 12 months (150 - 250 kg)
  | "grower"     // 12 - 18 months (250 - 400 kg)
  | "finisher"   // 18+ months (> 400 kg / feedlot)
  | "mature";    // Breeding / adult herd

export type MarketType = "beef" | "dairy" | "qurbani" | "breeding" | "custom";

export type PerformanceTier =
  | "elite"            // ADG > 1.2 kg/day or Top 10%
  | "above_average"   // ADG 0.85 - 1.2 kg/day
  | "standard"        // ADG 0.60 - 0.85 kg/day
  | "underperforming" // ADG 0.30 - 0.60 kg/day
  | "critical";       // ADG < 0.30 kg/day or negative

export interface WeightRecord {
  id: string;
  cattle_id: string;
  weight_kg: number;
  recorded_at: string;
  notes?: string | null;
  girth_cm?: number | null;
  length_cm?: number | null;
  withers_height_cm?: number | null;
  bcs?: number | null; // 1.0 to 9.0 Body Condition Score
  weighing_method?: WeighingMethod;
  photo_url?: string | null;
  adg_since_last?: number | null;
  days_since_last?: number | null;
  created_at?: string;
}

export interface GrowthTarget {
  id: string;
  business_id: string;
  cattle_id: string;
  target_weight_kg: number;
  target_adg_kg?: number | null;
  target_finish_date?: string | null;
  target_market_type: MarketType;
  status: "active" | "achieved" | "missed" | "adjusted" | "cancelled";
  achieved_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GrowthAlert {
  id: string;
  cattleId: string;
  tagId: string;
  type:
    | "rapid_loss"
    | "rapid_gain"
    | "growth_plateau"
    | "poor_growth"
    | "missed_measurement"
    | "feed_inefficiency"
    | "target_slippage";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  currentWeightKg: number;
  deltaKg?: number;
  adgKg?: number;
  daysSinceLastWeighed?: number;
  recommendation: string;
  actionType: "weigh" | "adjust_ration" | "health_check" | "review_target";
  dateISO: string;
}

export interface GrowthPrediction {
  cattleId: string;
  tagId: string;
  currentWeightKg: number;
  currentAdgKg: number;
  predicted30dKg: number;
  predicted60dKg: number;
  predicted90dKg: number;
  targetWeightKg?: number;
  projectedFinishDate?: string;
  daysToTarget?: number;
  confidenceScore: number; // 0.0 - 1.0
  growthModel: "linear" | "gompertz" | "brody";
  isSlaughterReady: boolean;
  marketReadinessScore: number; // 0 - 100
}

export interface AnimalGrowthProfile {
  cattleId: string;
  tagId: string;
  name?: string | null;
  breed: string;
  gender: string;
  dob?: string | null;
  status: string;
  penName?: string;
  currentWeightKg: number;
  initialWeightKg: number;
  totalWeightGainKg: number;
  daysOnFarm: number;
  overallAdgKg: number;
  recent30dAdgKg: number;
  recent90dAdgKg: number;
  averageMonthlyGainKg: number;
  currentBcs: number;
  growthStage: GrowthStage;
  performanceTier: PerformanceTier;
  activeTarget?: GrowthTarget | null;
  targetAchievementPct: number;
  daysToTarget?: number;
  projectedFinishDate?: string;
  estimatedAnimalValueBdt: number;
  costPerKgGainBdt: number;
  fcr?: number;
  lastWeighedAt: string;
  daysSinceLastWeighed: number;
  weightHistoryCount: number;
  alerts: GrowthAlert[];
}

export interface GrowthHerdSummary {
  totalActiveAnimals: number;
  totalWeighedLast30d: number;
  complianceRatePct: number;
  herdAvgWeightKg: number;
  herdAvgAdgKg: number;
  herdAvgRecentAdgKg: number;
  herdAvgBcs: number;
  herdAvgFcr: number;
  herdAvgCostPerKgGainBdt: number;
  totalProjectedValueBdt: number;
  eliteCount: number;
  aboveAverageCount: number;
  standardCount: number;
  underperformingCount: number;
  criticalCount: number;
  totalAlertsCount: number;
  criticalAlertsCount: number;
}

export interface PenGrowthBenchmark {
  penName: string;
  animalCount: number;
  avgWeightKg: number;
  avgAdgKg: number;
  avgFcr: number;
  avgCostPerKgGainBdt: number;
  topPerformerTag: string;
}

export interface BreedGrowthBenchmark {
  breed: string;
  animalCount: number;
  avgWeightKg: number;
  avgAdgKg: number;
  targetAdgKg: number;
}

export interface GrowthHerdAnalytics {
  summary: GrowthHerdSummary;
  profiles: AnimalGrowthProfile[];
  alerts: GrowthAlert[];
  penBenchmarks: PenGrowthBenchmark[];
  breedBenchmarks: BreedGrowthBenchmark[];
}

