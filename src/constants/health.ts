import type { HealthEventType } from "@/types/database";

export const HEALTH_EVENT_TYPES: readonly HealthEventType[] = [
  "vaccine",
  "checkup",
  "deworming",
  "treatment",
  "other",
] as const;

export interface VaccineDefinition {
  key: string;
  code: "fmd" | "hs" | "bq" | "anthrax";
  label: string;
  fullName: string;
  intervalDays: number;
  description: string;
  isMandatory: boolean;
}

/**
 * Standard Department of Livestock Services (DLS) Bangladesh Protocol
 */
export const DLS_VACCINE_SCHEDULE: readonly VaccineDefinition[] = [
  {
    key: "fmd",
    code: "fmd",
    label: "FMD",
    fullName: "Foot and Mouth Disease (খুরারোগ)",
    intervalDays: 180, // Bi-annual
    description: "Inactivated trivalent vaccine for foot and mouth disease protection.",
    isMandatory: true,
  },
  {
    key: "hs",
    code: "hs",
    label: "HS",
    fullName: "Hemorrhagic Septicemia (গলাফুলা)",
    intervalDays: 365, // Annual
    description: "Adjuvanted bacterin for hemorrhagic septicemia prophylaxis.",
    isMandatory: true,
  },
  {
    key: "bq",
    code: "bq",
    label: "BQ",
    fullName: "Black Quarter (বাদলা)",
    intervalDays: 365, // Annual
    description: "Clostridial vaccine for blackleg disease prevention.",
    isMandatory: true,
  },
  {
    key: "anthrax",
    code: "anthrax",
    label: "Anthrax",
    fullName: "Anthrax (তড়কা)",
    intervalDays: 365, // Annual
    description: "Live spore vaccine for Bacillus anthracis prevention.",
    isMandatory: true,
  },
] as const;

export const DEFAULT_DEWORMING_INTERVAL_DAYS = 90; // Quarterly deworming
export const DEFAULT_QUARANTINE_DAYS = 14; // Standard intake isolation
