import type { HealthEventType } from "@/types/database";

export interface ProtocolStep {
  dayOffset: number;
  title: string;
  eventType: HealthEventType;
  notes: string;
}

// Standard Bangladesh cattle fattening health protocol
export const DEFAULT_HEALTH_PROTOCOL: ProtocolStep[] = [
  {
    dayOffset: 0,
    title: "Initial Health Checkup",
    eventType: "checkup",
    notes: "Full body condition assessment on arrival",
  },
  {
    dayOffset: 2,
    title: "Deworming — 1st Round",
    eventType: "deworming",
    notes: "Albendazole or Ivermectin — removes internal parasites",
  },
  {
    dayOffset: 7,
    title: "FMD Vaccine — 1st Dose",
    eventType: "vaccine",
    notes: "Foot and Mouth Disease — mandatory in Bangladesh",
  },
  {
    dayOffset: 14,
    title: "HS Vaccine",
    eventType: "vaccine",
    notes: "Hemorrhagic Septicemia — common in Bangladesh",
  },
  {
    dayOffset: 28,
    title: "BQ Vaccine",
    eventType: "vaccine",
    notes: "Black Quarter — Clostridial disease prevention",
  },
  {
    dayOffset: 45,
    title: "FMD Vaccine — Booster",
    eventType: "vaccine",
    notes: "Second FMD dose for full protection",
  },
  {
    dayOffset: 60,
    title: "Mid-Pen Health Review",
    eventType: "checkup",
    notes: "Weight assessment and health status check",
  },
  {
    dayOffset: 75,
    title: "Deworming — 2nd Round",
    eventType: "deworming",
    notes: "Second deworming cycle for optimal weight gain",
  },
];

export interface HealthEventRow {
  cattle_id: string;
  business_id: string;
  title: string;
  event_type: HealthEventType;
  scheduled_at: string;
  notes: string | null;
}

export function buildProtocolEvents(
  cattleId: string,
  businessId: string,
  purchaseDate: string,
  protocol: ProtocolStep[] = DEFAULT_HEALTH_PROTOCOL
): HealthEventRow[] {
  const base = new Date(purchaseDate);
  return protocol.map((step) => {
    const d = new Date(base);
    d.setDate(base.getDate() + step.dayOffset);
    return {
      cattle_id: cattleId,
      business_id: businessId,
      title: step.title,
      event_type: step.eventType,
      scheduled_at: d.toISOString().slice(0, 10),
      notes: step.notes,
    };
  });
}
