/**
 * Enterprise Reproduction, Breeding & Genetics Domain Types
 */

export type EstrusIntensity =
  | "standing_heat"     // Primary sign: Cow stands still when mounted
  | "mounting_others"   // Secondary: Mounting other cows
  | "mucous_discharge"  // Clear vulva discharge
  | "restlessness"      // Bellowing, pacing
  | "silent_heat";      // Ovulation with weak behavioral signs

export type HeatStatus = "active" | "inseminated" | "missed" | "expired" | "cancelled";

export type BreedingType = "AI" | "natural" | "embryo_transfer";

export type PregnancyStatus =
  | "inseminated"         // Awaiting PD check (days 0-45)
  | "pregnancy_confirmed" // Positive PD diagnosis
  | "pregnancy_failed"    // Open / negative PD
  | "aborted"             // Miscarriage / abortion
  | "calved";             // Successfully delivered

export type PDMethod = "rectal_palpation" | "ultrasound" | "blood_test" | "milk_progesterone";
export type PDResult = "pending" | "pregnant" | "open" | "inconclusive";
export type PregnancyRiskLevel = "normal" | "elevated" | "high";
export type CalvingType = "single" | "twin" | "triplet";
export type DeliveryDifficulty = "unassisted" | "easy_assist" | "difficult_dystocia" | "caesarean";
export type BirthStatus = "alive" | "stillborn" | "died_after_birth";

export type ReproductiveReminderType =
  | "heat_due"
  | "breeding_window"
  | "pd_check_due"
  | "dry_off_due"
  | "transition_diet_due"
  | "calving_due"
  | "calving_overdue"
  | "weaning_due";

export interface SemenInventoryItem {
  id: string;
  businessId: string;
  bullCode: string;
  bullName: string;
  breed: string;
  strawCode: string;
  strawsInStock: number;
  strawsReserved: number;
  strawsUsed: number;
  costPerStrawBdt: number;
  supplier?: string | null;
  storageCanister?: string | null;
  motilityPercent?: number | null;
  geneticTraits?: Record<string, any>;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HeatRecord {
  id: string;
  businessId: string;
  cattleId: string;
  cattleTag?: string;
  detectedAt: string;
  heatType: "natural" | "induced" | "sync_protocol";
  intensity: EstrusIntensity;
  observedBy?: string | null;
  optimalBreedingStart: string;
  optimalBreedingEnd: string;
  status: HeatStatus;
  notes?: string | null;
  createdAt: string;
}

export interface BreedingAttempt {
  id: string;
  businessId: string;
  cowId: string;
  cowTag?: string;
  cowName?: string;
  cowBreed?: string;
  heatRecordId?: string | null;
  breedingType: BreedingType;
  semenInventoryId?: string | null;
  sireId?: string | null;
  sireTagOrCode: string;
  sireBreed?: string | null;
  inseminationDate: string;
  inseminationTime?: string | null;
  technicianName?: string | null;
  technicianCostBdt: number;
  strawCostBdt: number;
  totalBreedingCostBdt: number;
  attemptNumberInCycle: number;
  status: PregnancyStatus;
  pdCheckScheduledDate: string;
  pdCheckActualDate?: string | null;
  pdMethod?: PDMethod | null;
  pdResult: PDResult;
  pdExaminedBy?: string | null;
  pdGestationDays?: number | null;
  expectedCalvingDate: string;
  dryOffDate: string;
  transitionDietDate?: string | null;
  pregnancyRiskLevel: PregnancyRiskLevel;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalvingRecord {
  id: string;
  businessId: string;
  breedingAttemptId?: string | null;
  cowId: string;
  cowTag?: string;
  sireId?: string | null;
  sireNameOrCode?: string | null;
  calvingDate: string;
  calvingTime?: string | null;
  calvingType: CalvingType;
  deliveryDifficulty: DeliveryDifficulty;
  birthPresentation?: string | null;
  attendantName?: string | null;
  deliveryCostBdt: number;
  vetFeeBdt: number;
  placentaExpelledCleanly: boolean;
  damPostpartumCondition: "healthy" | "metritis" | "milk_fever" | "ketosis" | "injured" | "critical";
  notes?: string | null;
  offspring: BirthOffspring[];
  createdAt: string;
}

export interface BirthOffspring {
  id: string;
  businessId: string;
  calvingRecordId: string;
  calfCattleId: string;
  tagNumber: string;
  name?: string | null;
  gender: "bull" | "heifer";
  birthWeightKg: number;
  birthStatus: BirthStatus;
  colostrumFedWithinHours?: number | null;
  colostrumQuality?: "excellent" | "good" | "fair" | "poor" | null;
  navelDipped: boolean;
  initialValuationBdt: number;
  weaningTargetDate?: string | null;
  actualWeaningDate?: string | null;
  weaningWeightKg?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface PedigreeNode {
  id: string;
  tagNumber: string;
  name?: string | null;
  gender: "bull" | "cow" | "heifer" | "steer" | "calf";
  breed?: string | null;
  dob?: string | null;
  damId?: string | null;
  sireId?: string | null;
  damTag?: string | null;
  sireTag?: string | null;
  dam?: PedigreeNode | null;
  sire?: PedigreeNode | null;
  generation: number;
}

export interface InbreedingEvaluation {
  inbreedingCoefficient: number; // Wright's F coefficient (0.0 to 1.0)
  inbreedingPercentage: number;  // 0% to 100%
  riskLevel: "none" | "low" | "moderate" | "high" | "critical";
  isMatingRecommended: boolean;
  commonAncestors: { id: string; tagNumber: string; name?: string; relation: string }[];
  warningMessage?: string;
}

export interface FertilityMetrics {
  totalBreedingAttempts: number;
  conceptionRatePercent: number;
  firstServiceConceptionRatePercent: number;
  servicesPerConception: number;
  averageDaysOpen: number;
  averageCalvingIntervalDays: number;
  heatDetectionEfficiencyPercent: number;
  activePregnanciesCount: number;
  pendingPDChecksCount: number;
  upcomingCalvingsIn30Days: number;
  technicianSuccessLeaderboard: {
    technicianName: string;
    attempts: number;
    conceptions: number;
    successRate: number;
  }[];
  sireConceptionLeaderboard: {
    sireCode: string;
    attempts: number;
    conceptions: number;
    successRate: number;
  }[];
}
