import type { HealthEventType } from "@/types/database";

export interface ProtocolStep {
  dayOffset: number;
  title: string;
  eventType: HealthEventType;
  notes: string;
  /** Bangla name and note, for display only (the saved title stays English: reports match on FMD/HS/BQ) */
  titleBn?: string;
  notesBn?: string;
}

// Standard Bangladesh cattle fattening health protocol
export const DEFAULT_HEALTH_PROTOCOL: ProtocolStep[] = [
  {
    dayOffset: 0,
    title: "Initial Health Checkup",
    titleBn: "প্রথম স্বাস্থ্য পরীক্ষা",
    notesBn: "খামারে আসার পর পুরো শরীরের অবস্থা দেখা",
    eventType: "checkup",
    notes: "Full body condition assessment on arrival",
  },
  {
    dayOffset: 2,
    title: "Deworming — 1st Round",
    titleBn: "কৃমিনাশক — ১ম বার",
    notesBn: "অ্যালবেনডাজল বা আইভারমেকটিন — পেটের কৃমি দূর করে",
    eventType: "deworming",
    notes: "Albendazole or Ivermectin — removes internal parasites",
  },
  {
    dayOffset: 7,
    title: "FMD Vaccine — 1st Dose",
    titleBn: "ক্ষুরা রোগের (FMD) টিকা — ১ম ডোজ",
    notesBn: "ক্ষুরা রোগ — বাংলাদেশে জরুরি",
    eventType: "vaccine",
    notes: "Foot and Mouth Disease — mandatory in Bangladesh",
  },
  {
    dayOffset: 14,
    title: "HS Vaccine",
    titleBn: "গলাফুলা (HS) টিকা",
    notesBn: "গলাফুলা রোগ — বাংলাদেশে খুব হয়",
    eventType: "vaccine",
    notes: "Hemorrhagic Septicemia — common in Bangladesh",
  },
  {
    dayOffset: 28,
    title: "BQ Vaccine",
    titleBn: "বাদলা (BQ) টিকা",
    notesBn: "বাদলা রোগ প্রতিরোধ",
    eventType: "vaccine",
    notes: "Black Quarter — Clostridial disease prevention",
  },
  {
    dayOffset: 45,
    title: "FMD Vaccine — Booster",
    titleBn: "ক্ষুরা রোগের (FMD) টিকা — বুস্টার",
    notesBn: "পূর্ণ সুরক্ষার জন্য FMD-এর ২য় ডোজ",
    eventType: "vaccine",
    notes: "Second FMD dose for full protection",
  },
  {
    dayOffset: 60,
    title: "Mid-Pen Health Review",
    titleBn: "মাঝামাঝি স্বাস্থ্য পরীক্ষা",
    notesBn: "ওজন ও স্বাস্থ্যের অবস্থা দেখা",
    eventType: "checkup",
    notes: "Weight assessment and health status check",
  },
  {
    dayOffset: 75,
    title: "Deworming — 2nd Round",
    titleBn: "কৃমিনাশক — ২য় বার",
    notesBn: "ভালো ওজন বাড়ার জন্য ২য় বার কৃমিনাশক",
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
