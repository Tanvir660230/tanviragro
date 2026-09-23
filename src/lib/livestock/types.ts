import type { CattleGender, CattleStatus, HealthEventType, InseminationType, BreedingStatus, UserRole } from "@/types/database";

export interface CattleDossier {
  id: string;
  businessId: string;
  farmId?: string | null;
  penId?: string | null;
  tagId: string;
  electronicId?: string | null;
  breed?: string | null;
  breedId?: string | null;
  categoryId?: string | null;
  gender: CattleGender;
  dob?: string | null;
  status: CattleStatus;
  damId?: string | null;
  sireId?: string | null;
  purchaseDate: string;
  purchasePrice: number;
  initialWeightKg: number;
  targetWeightKg?: number | null;
  expectedDailyGainKg?: number | null;
  isQuarantined?: boolean;
  isQurbaniMarked?: boolean;
  withdrawalEndDate?: string | null;
  notes?: string | null;
  vendorId?: string | null;
  insuranceExpiry?: string | null;
  currentWeightKg?: number;
}

export interface WeightRecord {
  id?: string;
  cattleId: string;
  businessId?: string;
  weightKg: number;
  girthCm?: number | null;
  lengthCm?: number | null;
  weighingMethod?: "scale" | "tape_measure" | "visual_estimate";
  recordedBy?: string | null;
  recordedAt: string;
  notes?: string | null;
}

export interface GrowthMetrics {
  currentWeightKg: number;
  initialWeightKg: number;
  totalGainKg: number;
  daysOnFeed: number;
  averageDailyGainKg: number; // ADG
  feedConversionRatio?: number; // FCR (Feed intake / Weight Gain)
  projectedWeightKg: number;
  targetSlaughterWeightKg?: number;
  daysToTargetSlaughter?: number | null;
}

export interface HealthProtocolRecord {
  id?: string;
  cattleId: string;
  businessId: string;
  title: string;
  eventType: HealthEventType;
  scheduledAt: string;
  completedAt?: string | null;
  dosage?: string | null;
  administeredBy?: string | null;
  withdrawalDays?: number;
  withdrawalEndDate?: string | null;
  costBdt?: number;
  notes?: string | null;
  deletedAt?: string | null;
}

export interface BreedingRecord {
  id?: string;
  businessId: string;
  cowId: string;
  sireId?: string | null;
  sireTagOrBreed: string;
  inseminationDate: string;
  inseminationType: InseminationType;
  status?: BreedingStatus;
  technicianName?: string | null;
  pdCheckDate?: string | null; // Pregnancy Diagnosis Check
  isPregnant?: boolean | null;
  pdConfirmedAt?: string | null;
  expectedCalvingDate?: string | null;
  actualCalvingDate?: string | null;
  dryOffDate?: string | null;
  calfId?: string | null;
  calfGender?: CattleGender | null;
  notes?: string | null;
}

export interface AnimalCostSummary {
  cattleId: string;
  purchaseCost: number;
  directFeedCost: number;
  directMedicineCost: number;
  allocatedOverheadCost: number;
  totalAccumulatedCost: number;
  costPerKgLiveWeight: number;
  projectedBreakEvenSalePrice: number;
}

export type LifecycleEventType =
  | "BIRTH"
  | "PURCHASE"
  | "WEIGHT_ENTRY"
  | "VACCINATION"
  | "TREATMENT"
  | "DISEASE_DIAGNOSED"
  | "FEED_ALLOCATION"
  | "PEN_TRANSFER"
  | "BREEDING"
  | "PREGNANCY_CONFIRMED"
  | "DRY_OFF"
  | "CALVING"
  | "STATUS_CHANGE"
  | "SALE"
  | "DEATH"
  | "ARCHIVE";

export interface LifecycleTimelineItem {
  id: string;
  type: LifecycleEventType;
  date: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export type LifecyclePhase =
  | "planned"
  | "purchased"
  | "born"
  | "quarantined"
  | "active"
  | "breeding_eligible"
  | "pregnant"
  | "under_treatment"
  | "recovering"
  | "ready_for_sale"
  | "sold"
  | "dead"
  | "stolen"
  | "culled"
  | "archived";

export interface LifecycleTransitionRule {
  from: CattleStatus | LifecyclePhase;
  to: CattleStatus | LifecyclePhase;
  allowedRoles: UserRole[];
  labelEn: string;
  labelBn: string;
  description: string;
  requiresReason?: boolean;
  requiresConfirmation?: boolean;
  requiresDrugWithdrawalClearance?: boolean;
  requiresBreedingAgeClearance?: boolean;
  financialLockCheck?: boolean;
}

export interface LifecycleTransitionRequest {
  cattleId: string;
  targetStatus: CattleStatus;
  reason?: string;
  notes?: string;
  effectiveDate?: string;
  actorRole: UserRole;
  actorId: string;
  // Specialized payload if transitioning to dead
  deathDetails?: {
    causeOfDeath: string;
    postMortemNotes?: string;
    disposalMethod?: "burial" | "incineration" | "rendering" | "other";
    certifiedByVetId?: string;
    estimatedCasualtyLossBdt?: number;
  };
  // Specialized payload if transitioning to sold
  saleDetails?: {
    salePriceTotal: number;
    soldAt: string;
    buyerName?: string;
    weightAtSaleKg?: number;
    paymentStatus?: "paid" | "partial" | "due";
  };
}

export interface LifecycleTransitionResult {
  success: boolean;
  previousStatus: CattleStatus;
  newStatus: CattleStatus;
  cattleId: string;
  transitionTimestamp: string;
  automatedActionsExecuted: string[];
  auditLogId?: string;
  error?: string;
}

export type TimelineEventCategory = "all" | "lifecycle" | "growth" | "health" | "breeding" | "financial" | "movement";

export interface UnifiedTimelineEvent {
  id: string;
  cattleId: string;
  category: TimelineEventCategory;
  eventType: LifecycleEventType | string;
  title: string;
  description: string;
  timestamp: string; // ISO date / datetime
  actor?: {
    id?: string;
    name?: string;
    role?: string;
  };
  badgeColor?: string;
  metadata?: Record<string, unknown>;
}

export interface LivestockPermissionRules {
  canCreateAnimal: boolean;
  canEditAnimal: boolean;
  canRecordWeight: boolean;
  canAdministerHealth: boolean;
  canManageBreeding: boolean;
  canRecordSale: boolean;
  canRecordDeath: boolean;
  canViewFinancials: boolean;
  canSoftDelete: boolean;
  canHardDelete: boolean;
  canManageFarmsAndPens: boolean;
  canChangeLifecycleStatus: boolean;
  canArchiveAnimal: boolean;
  canUnarchiveAnimal: boolean;
}

export type LifecyclePermissionRules = LivestockPermissionRules;

// ═══════════════════════════════════════════════════════════════════
// Health & Medical Domain Types
// ═══════════════════════════════════════════════════════════════════

export type HealthSeverityLevel = "mild" | "moderate" | "severe" | "critical";

export type AdministrationRoute =
  | "IM"
  | "SC"
  | "IV"
  | "oral"
  | "topical"
  | "intramammary"
  | "intrauterine";

export interface VitalSigns {
  temperatureCelsius?: number | null;
  heartRateBpm?: number | null;
  respirationRateBpm?: number | null;
  bodyConditionScore?: number | null; // BCS 1.0 - 5.0 scale
  rumenMotilityPer2Min?: number | null; // Normal 2-3 per 2 mins
  mucousMembraneColor?: "pink_normal" | "pale_anemic" | "congested_red" | "icteric_yellow" | "cyanotic_blue";
  recordedAt: string;
  recordedBy?: string | null;
}

export interface PrescriptionItem {
  medicineItemId: string;
  medicineName: string;
  dose: number;
  doseUnit: string;
  frequency: string;
  durationDays: number;
  route: AdministrationRoute;
  withdrawalDays: number;
  unitCostBdt?: number;
  notes?: string;
}

export interface ClinicalVisitRecord {
  id?: string;
  cattleId: string;
  businessId: string;
  visitType: "routine_check" | "emergency" | "follow_up" | "admission" | "discharge";
  visitDate: string;
  veterinarianName: string;
  veterinarianContact?: string | null;
  veterinarianLicenseNo?: string | null;
  vitals: VitalSigns;
  symptoms: string[];
  primaryDiagnosis: string;
  differentialDiagnosis?: string | null;
  severity: HealthSeverityLevel;
  prescriptions: PrescriptionItem[];
  vetFeeBdt: number;
  labTestFeeBdt?: number;
  additionalCostBdt: number;
  totalMedicalCostBdt: number;
  recommendations?: string | null;
  requiresQuarantine: boolean;
  targetPenId?: string | null;
  nextFollowUpDate?: string | null;
  withdrawalPeriodEndDate?: string | null;
  attachments?: string[];
  createdAt?: string;
}

export interface LabTestRecord {
  id?: string;
  cattleId: string;
  businessId: string;
  testName: string;
  sampleType: "blood" | "milk" | "feces" | "nasal_swab" | "skin_scraping" | "tissue" | "other";
  sampleDate: string;
  resultDate?: string | null;
  status: "pending" | "completed" | "inconclusive";
  findings: string;
  interpretation?: string | null;
  referenceRange?: string | null;
  laboratoryName?: string | null;
  costBdt: number;
}

export interface HealthAlert {
  id: string;
  cattleId: string;
  tagId: string;
  type: "overdue_vaccine" | "missed_follow_up" | "active_withdrawal" | "vital_anomaly" | "quarantine_alert" | "repeated_condition";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  actionRequired: string;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCertificateSummary {
  certificateId: string;
  cattleId: string;
  tagId: string;
  breed: string | null;
  gender: string;
  ageMonths: number;
  currentWeightKg: number;
  overallStatus: string;
  isVaccinatedUpToDate: boolean;
  activeWithdrawalPeriod: boolean;
  withdrawalEndDate?: string | null;
  completedVaccinations: { title: string; completedAt: string }[];
  recentTreatments: { diagnosis: string; treatedAt: string; vetName?: string }[];
  isFitForSaleOrSlaughter: boolean;
  certifiedAt: string;
  certifiedBy: string;
}