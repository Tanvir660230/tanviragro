import { GestationEngine } from "./gestation-engine";
import { PedigreeEngine, AnimalAncestorRecord } from "./pedigree-engine";
import { FertilityAnalyticsEngine } from "./fertility-analytics";
import {
  HeatRecord,
  BreedingAttempt,
  CalvingRecord,
  BirthOffspring,
  SemenInventoryItem,
  PedigreeNode,
  InbreedingEvaluation,
  FertilityMetrics,
  EstrusIntensity,
  BreedingType,
  PDMethod,
  PDResult,
  CalvingType,
  DeliveryDifficulty,
} from "./types";

export class ReproductionEngine {
  /**
   * Heat / Estrus Helper
   */
  public static initHeatRecord(params: {
    id: string;
    businessId: string;
    cattleId: string;
    cattleTag?: string;
    detectedAtISO: string;
    heatType?: "natural" | "induced" | "sync_protocol";
    intensity?: EstrusIntensity;
    observedBy?: string;
    notes?: string;
  }): HeatRecord {
    const window = GestationEngine.calculateOptimalBreedingWindow(params.detectedAtISO);
    return {
      id: params.id,
      businessId: params.businessId,
      cattleId: params.cattleId,
      cattleTag: params.cattleTag,
      detectedAt: params.detectedAtISO,
      heatType: params.heatType || "natural",
      intensity: params.intensity || "standing_heat",
      observedBy: params.observedBy || null,
      optimalBreedingStart: window.startISO,
      optimalBreedingEnd: window.endISO,
      status: "active",
      notes: params.notes || null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Breeding Attempt Helper
   */
  public static initBreedingAttempt(params: {
    id: string;
    businessId: string;
    cowId: string;
    cowTag?: string;
    cowBreed?: string;
    heatRecordId?: string;
    breedingType?: BreedingType;
    semenInventoryId?: string;
    sireId?: string;
    sireTagOrCode: string;
    sireBreed?: string;
    inseminationDate: string;
    inseminationTime?: string;
    technicianName?: string;
    technicianCostBdt?: number;
    strawCostBdt?: number;
    attemptNumberInCycle?: number;
    notes?: string;
  }): BreedingAttempt {
    const breed = params.cowBreed || params.sireBreed;
    const expectedCalving = GestationEngine.calculateExpectedCalvingDate(params.inseminationDate, breed);
    const pdDate = GestationEngine.calculatePDCheckDate(params.inseminationDate);
    const dryOff = GestationEngine.calculateDryOffDate(expectedCalving);
    const transitionDiet = GestationEngine.calculateTransitionDietDate(expectedCalving);

    const techCost = params.technicianCostBdt || 0;
    const strawCost = params.strawCostBdt || 0;
    const totalCost = techCost + strawCost;

    return {
      id: params.id,
      businessId: params.businessId,
      cowId: params.cowId,
      cowTag: params.cowTag,
      cowBreed: params.cowBreed,
      heatRecordId: params.heatRecordId || null,
      breedingType: params.breedingType || "AI",
      semenInventoryId: params.semenInventoryId || null,
      sireId: params.sireId || null,
      sireTagOrCode: params.sireTagOrCode,
      sireBreed: params.sireBreed || null,
      inseminationDate: params.inseminationDate,
      inseminationTime: params.inseminationTime || null,
      technicianName: params.technicianName || null,
      technicianCostBdt: techCost,
      strawCostBdt: strawCost,
      totalBreedingCostBdt: totalCost,
      attemptNumberInCycle: params.attemptNumberInCycle || 1,
      status: "inseminated",
      pdCheckScheduledDate: pdDate,
      pdCheckActualDate: null,
      pdMethod: null,
      pdResult: "pending",
      pdExaminedBy: null,
      pdGestationDays: null,
      expectedCalvingDate: expectedCalving,
      dryOffDate: dryOff,
      transitionDietDate: transitionDiet,
      pregnancyRiskLevel: "normal",
      notes: params.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluates Inbreeding Compatibility before mating
   */
  public static checkInbreedingRisk(
    femaleId: string,
    maleId: string,
    animalMap: Map<string, AnimalAncestorRecord>
  ): InbreedingEvaluation {
    return PedigreeEngine.evaluateMatingCompatibility(femaleId, maleId, animalMap);
  }

  /**
   * Generates 3-generation Pedigree Tree
   */
  public static getPedigreeTree(
    animalId: string,
    animalMap: Map<string, AnimalAncestorRecord>,
    maxGenerations = 3
  ): PedigreeNode | null {
    return PedigreeEngine.buildPedigreeTree(animalId, animalMap, maxGenerations);
  }

  /**
   * Calculates Herd-Wide Fertility Analytics
   */
  public static getFertilityMetrics(
    breedingAttempts: BreedingAttempt[],
    calvingRecords: CalvingRecord[],
    activePregnancies = 0
  ): FertilityMetrics {
    return FertilityAnalyticsEngine.calculateHerdFertilityMetrics(breedingAttempts, calvingRecords, activePregnancies);
  }
}
