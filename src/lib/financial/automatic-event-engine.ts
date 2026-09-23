import type { JournalEntry, JournalPostingLine } from "./types";
import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";
import { JournalEngine } from "./journal";

export class AutomaticLivestockFinancialEventEngine {
  /**
   * Generates journal entry for feed consumption / daily ration feeding.
   */
  public static createFeedConsumptionJournal(params: {
    businessId: string;
    feedingSessionId: string;
    feedCost: number;
    date: string;
    description?: string;
    penId?: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "5030",
        accountName: CHART_OF_ACCOUNTS["5030"].name, // Feed & Nutrition Expense
        debit: params.feedCost,
        credit: 0,
        notes: params.description || `Feed ration consumption (Session ${params.feedingSessionId})`,
      },
      {
        accountCode: "1300",
        accountName: CHART_OF_ACCOUNTS["1300"].name, // Feed & Supplies Inventory
        debit: 0,
        credit: params.feedCost,
        notes: `Inventory reduction for feed consumed`,
      },
    ];

    return JournalEngine.validateJournalEntry({
      id: `je-feed-${params.feedingSessionId}`,
      businessId: params.businessId,
      referenceNumber: `FEED-${params.feedingSessionId.slice(0, 8)}`,
      sourceModule: "feed_consumption",
      sourceEntityId: params.feedingSessionId,
      transactionDate: params.date,
      description: `Feed consumed in Pen ${params.penId || "Main"}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Generates journal entry for medical treatment / drugs administered.
   */
  public static createMedicalTreatmentJournal(params: {
    businessId: string;
    treatmentId: string;
    cattleId: string;
    tagId?: string;
    cost: number;
    date: string;
    drugName?: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "6100",
        accountName: CHART_OF_ACCOUNTS["6100"].name, // Veterinary & Health Expenses
        debit: params.cost,
        credit: 0,
        notes: `Medical treatment: ${params.drugName || "Medication"} for Tag ${params.tagId || params.cattleId}`,
      },
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: 0,
        credit: params.cost,
        notes: `Disbursement for medical treatment`,
      },
    ];

    return JournalEngine.validateJournalEntry({
      id: `je-med-${params.treatmentId}`,
      businessId: params.businessId,
      referenceNumber: `MED-${params.treatmentId.slice(0, 8)}`,
      sourceModule: "cost_entry",
      sourceEntityId: params.treatmentId,
      transactionDate: params.date,
      description: `Veterinary treatment for cattle #${params.tagId || params.cattleId}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Generates journal entry for vaccination campaign completed.
   */
  public static createVaccinationJournal(params: {
    businessId: string;
    vaccinationId: string;
    vaccineName: string;
    cost: number;
    headCount: number;
    date: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "6160",
        accountName: CHART_OF_ACCOUNTS["6160"].name, // Vaccination & Immunization
        debit: params.cost,
        credit: 0,
        notes: `Vaccination: ${params.vaccineName} (${params.headCount} head)`,
      },
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: 0,
        credit: params.cost,
        notes: `Disbursement for vaccination program`,
      },
    ];

    return JournalEngine.validateJournalEntry({
      id: `je-vax-${params.vaccinationId}`,
      businessId: params.businessId,
      referenceNumber: `VAX-${params.vaccinationId.slice(0, 8)}`,
      sourceModule: "cost_entry",
      sourceEntityId: params.vaccinationId,
      transactionDate: params.date,
      description: `Vaccination campaign: ${params.vaccineName}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Generates journal entry for calf birth registration (IAS 41 initial recognition).
   */
  public static createBirthRecognitionJournal(params: {
    businessId: string;
    calfId: string;
    tagId?: string;
    initialBiologicalValue: number;
    date: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "1200",
        accountName: CHART_OF_ACCOUNTS["1200"].name, // Livestock Inventory
        debit: params.initialBiologicalValue,
        credit: 0,
        notes: `Initial biological recognition for newborn calf #${params.tagId || params.calfId}`,
      },
      {
        accountCode: "4040",
        accountName: CHART_OF_ACCOUNTS["4040"].name, // Biological Asset Fair Value Gain
        debit: 0,
        credit: params.initialBiologicalValue,
        notes: `Biological asset gain on calf birth`,
      },
    ];

    return JournalEngine.validateJournalEntry({
      id: `je-birth-${params.calfId}`,
      businessId: params.businessId,
      referenceNumber: `BIRTH-${params.calfId.slice(0, 8)}`,
      sourceModule: "cattle_purchase",
      sourceEntityId: params.calfId,
      transactionDate: params.date,
      description: `Calf birth biological recognition #${params.tagId || params.calfId}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Generates journal entry for livestock mortality / casualty write-off.
   */
  public static createMortalityWriteOffJournal(params: {
    businessId: string;
    cattleId: string;
    tagId?: string;
    bookValueLoss: number;
    causeOfDeath: string;
    date: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "8010",
        accountName: CHART_OF_ACCOUNTS["8010"].name, // Livestock Mortality Loss
        debit: params.bookValueLoss,
        credit: 0,
        notes: `Mortality write-off: Tag #${params.tagId || params.cattleId} (Cause: ${params.causeOfDeath})`,
      },
      {
        accountCode: "1200",
        accountName: CHART_OF_ACCOUNTS["1200"].name, // Livestock Inventory
        debit: 0,
        credit: params.bookValueLoss,
        notes: `Derecognition of deceased animal basis from livestock inventory`,
      },
    ];

    return JournalEngine.validateJournalEntry({
      id: `je-mort-${params.cattleId}`,
      businessId: params.businessId,
      referenceNumber: `MORT-${params.cattleId.slice(0, 8)}`,
      sourceModule: "livestock_mortality",
      sourceEntityId: params.cattleId,
      transactionDate: params.date,
      description: `Mortality casualty write-off for Tag #${params.tagId || params.cattleId}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }
}

