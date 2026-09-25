import { todayDhaka } from "@/lib/dates";
export interface AnimalWizardIdentification {
  name: string;
  tagId: string;
  electronicId: string;
  species: "cattle" | "goat" | "sheep" | "buffalo";
  breed: string;
  gender: "male" | "female";
  dob: string;
  photoUrl: string | null;
}

export interface AnimalWizardFarmLocation {
  farmId: string;
  penId: string;
  caretaker: string;
  ownerPartnerId: string;
}

export interface AnimalWizardCategoryStage {
  category: "fattening" | "breeder" | "dairy" | "calf" | "qurbani" | "general";
  isQurbaniTarget: boolean;
  targetWeightKg: number | null;
  expectedDailyGainKg: number | null;
}

export interface AnimalWizardHealth {
  status: "active" | "quarantined" | "treatment" | "observation";
  isQuarantined: boolean;
  lastVaccinationDate: string | null;
  dewormingDate: string | null;
  healthNotes: string;
}

export interface AnimalWizardOrigin {
  originType: "purchase" | "birth";
  purchaseDate: string;
  purchasePrice: number;
  initialWeightKg: number;
  /** was the purchase weight put on a scale/tape, or guessed? (growth ignores guessed weights) */
  initialWeightType?: "measured" | "estimated" | "unknown";
  vendorId: string | null;
  vendorName: string;
  birthWeightKg: number | null;
  damTag: string;
  sireTag: string;
}

export interface AnimalWizardFinancial {
  initialCost: number;
  transportCost: number;
  haatHasil: number;
  insuranceProvider: string;
  insuranceAmount: number | null;
}

export interface AnimalWizardDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  sizeBytes?: number;
}

export interface AnimalWizardState {
  identification: AnimalWizardIdentification;
  farmLocation: AnimalWizardFarmLocation;
  categoryStage: AnimalWizardCategoryStage;
  health: AnimalWizardHealth;
  origin: AnimalWizardOrigin;
  financial: AnimalWizardFinancial;
  documents: AnimalWizardDocument[];
  notes: string;
}

export const DEFAULT_WIZARD_STATE: AnimalWizardState = {
  identification: {
    name: "",
    tagId: "",
    electronicId: "",
    species: "cattle",
    breed: "Indigenous (Deshi)",
    gender: "male",
    dob: "",
    photoUrl: null,
  },
  farmLocation: { farmId: "", penId: "", caretaker: "", ownerPartnerId: "" },
  categoryStage: { category: "fattening", isQurbaniTarget: false, targetWeightKg: 450, expectedDailyGainKg: 0.8 },
  health: { status: "active", isQuarantined: false, lastVaccinationDate: null, dewormingDate: null, healthNotes: "" },
  origin: {
    originType: "purchase",
    purchaseDate: todayDhaka(),
    purchasePrice: 0,
    initialWeightKg: 0,
    initialWeightType: "measured",
    vendorId: null,
    vendorName: "",
    birthWeightKg: null,
    damTag: "",
    sireTag: "",
  },
  financial: { initialCost: 0, transportCost: 0, haatHasil: 0, insuranceProvider: "", insuranceAmount: null },
  documents: [],
  notes: "",
};

export interface WizardTemplate {
  id: string;
  name: string;
  description: string;
  apply: (current: AnimalWizardState) => AnimalWizardState;
}

export const WIZARD_TEMPLATES: WizardTemplate[] = [
  {
    id: "fattening_bull",
    name: "Commercial Fattening Bull",
    description: "Beef profile with 0.85 kg/day target ADG and 480 kg harvest target.",
    apply: (current) => ({
      ...current,
      identification: { ...current.identification, gender: "male", breed: "Crossbred" },
      categoryStage: { category: "fattening", isQurbaniTarget: false, targetWeightKg: 480, expectedDailyGainKg: 0.85 },
    }),
  },
  {
    id: "qurbani_prime",
    name: "Qurbani Premium Bull",
    description: "High conformation beef profile for Eid-ul-Adha target sale.",
    apply: (current) => ({
      ...current,
      identification: { ...current.identification, gender: "male", breed: "Brahman" },
      categoryStage: { category: "qurbani", isQurbaniTarget: true, targetWeightKg: 550, expectedDailyGainKg: 0.95 },
    }),
  },
  {
    id: "dairy_heifer",
    name: "Dairy Heifer / Cow",
    description: "Female breeding/dairy yield profile.",
    apply: (current) => ({
      ...current,
      identification: { ...current.identification, gender: "female", breed: "Frieswal" },
      categoryStage: { category: "dairy", isQurbaniTarget: false, targetWeightKg: 420, expectedDailyGainKg: 0.65 },
    }),
  },
  {
    id: "farm_born_calf",
    name: "Farm-Born Calf",
    description: "Pedigree tracking and initial birth weight.",
    apply: (current) => ({
      ...current,
      categoryStage: { category: "calf", isQurbaniTarget: false, targetWeightKg: 200, expectedDailyGainKg: 0.5 },
      origin: { ...current.origin, originType: "birth", purchasePrice: 0, initialWeightKg: 28, birthWeightKg: 28 },
    }),
  },
];

export function calculateAnimalAge(dob: string | null | undefined): { months: number; years: number; display: string } {
  if (!dob) return { months: 0, years: 0, display: "Age not specified" };
  const birthTime = new Date(dob + "T00:00:00").getTime();
  if (isNaN(birthTime)) return { months: 0, years: 0, display: "Invalid date" };
  
  const diffMs = Date.now() - birthTime;
  if (diffMs < 0) return { months: 0, years: 0, display: "Future date" };

  const totalMonths = Math.floor(diffMs / (86400000 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  let display = "";
  if (years === 0) display = `${totalMonths} month${totalMonths !== 1 ? "s" : ""} old`;
  else if (remainingMonths === 0) display = `${years} year${years !== 1 ? "s" : ""} old`;
  else display = `${years}y ${remainingMonths}m old`;

  return { months: totalMonths, years, display };
}

export function validateWizardStep(step: number, state: AnimalWizardState, existingTagIds: string[] = []): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!state.identification.tagId.trim()) {
      errors.tagId = "Ear Tag / ID is required";
    } else if (state.identification.tagId.length > 30) {
      errors.tagId = "Tag ID must be under 30 characters";
    } else if (existingTagIds.includes(state.identification.tagId.trim())) {
      errors.tagId = `Tag ID "${state.identification.tagId}" is already registered`;
    }
    if (!state.identification.gender) {
      errors.gender = "Gender is required";
    }
  }

  if (step === 5) {
    if (state.origin.originType === "purchase") {
      if (!state.origin.purchaseDate) errors.purchaseDate = "Purchase date is required";
      if (state.origin.purchasePrice < 0 || isNaN(state.origin.purchasePrice)) errors.purchasePrice = "Valid purchase price is required";
      if (state.origin.initialWeightKg <= 0 || isNaN(state.origin.initialWeightKg)) errors.initialWeightKg = "Initial live weight is required and must be > 0";
    } else {
      if (state.origin.initialWeightKg <= 0 || isNaN(state.origin.initialWeightKg)) errors.initialWeightKg = "Birth / initial weight is required";
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}
