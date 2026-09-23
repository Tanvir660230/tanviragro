import {
  calculateAnimalAge,
  validateWizardStep,
  DEFAULT_WIZARD_STATE,
  WIZARD_TEMPLATES,
  type AnimalWizardState,
} from "@/lib/validation/cattle-wizard";

describe("Enterprise Animal Wizard - Domain & Validation Engine", () => {
  describe("calculateAnimalAge", () => {
    it("should handle null or empty dob", () => {
      expect(calculateAnimalAge(null).display).toBe("Age not specified");
      expect(calculateAnimalAge("").display).toBe("Age not specified");
    });

    it("should handle future dates safely", () => {
      const futureDate = "2099-01-01";
      const res = calculateAnimalAge(futureDate);
      expect(res.display).toBe("Future date");
    });

    it("should accurately format age in months for calves under 2 years", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        .toISOString()
        .split("T")[0];
      const res = calculateAnimalAge(sixMonthsAgo);
      expect(res.months).toBeGreaterThanOrEqual(5);
      expect(res.years).toBe(0);
    });
  });

  describe("validateWizardStep", () => {
    it("should enforce required Ear Tag in Step 1", () => {
      const state: AnimalWizardState = {
        ...DEFAULT_WIZARD_STATE,
        identification: {
          ...DEFAULT_WIZARD_STATE.identification,
          tagId: "",
        },
      };

      const res = validateWizardStep(1, state, ["TA-001"]);
      expect(res.isValid).toBe(false);
      expect(res.errors.tagId).toBe("Ear Tag / ID is required");
    });

    it("should block duplicate Ear Tags", () => {
      const state: AnimalWizardState = {
        ...DEFAULT_WIZARD_STATE,
        identification: {
          ...DEFAULT_WIZARD_STATE.identification,
          tagId: "TA-001",
        },
      };

      const res = validateWizardStep(1, state, ["TA-001", "TA-002"]);
      expect(res.isValid).toBe(false);
      expect(res.errors.tagId).toContain("already registered");
    });

    it("should validate valid Step 1 data", () => {
      const state: AnimalWizardState = {
        ...DEFAULT_WIZARD_STATE,
        identification: {
          ...DEFAULT_WIZARD_STATE.identification,
          tagId: "TA-999",
          gender: "male",
        },
      };

      const res = validateWizardStep(1, state, ["TA-001"]);
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });

    it("should validate Step 5 purchase origin requirements", () => {
      const state: AnimalWizardState = {
        ...DEFAULT_WIZARD_STATE,
        origin: {
          ...DEFAULT_WIZARD_STATE.origin,
          originType: "purchase",
          purchaseDate: "",
          purchasePrice: -100,
          initialWeightKg: 0,
        },
      };

      const res = validateWizardStep(5, state);
      expect(res.isValid).toBe(false);
      expect(res.errors.purchaseDate).toBeDefined();
      expect(res.errors.purchasePrice).toBeDefined();
      expect(res.errors.initialWeightKg).toBeDefined();
    });

    it("should validate Step 5 birth origin requirements", () => {
      const state: AnimalWizardState = {
        ...DEFAULT_WIZARD_STATE,
        origin: {
          ...DEFAULT_WIZARD_STATE.origin,
          originType: "birth",
          initialWeightKg: 28,
        },
      };

      const res = validateWizardStep(5, state);
      expect(res.isValid).toBe(true);
    });
  });

  describe("WIZARD_TEMPLATES", () => {
    it("should apply fattening bull template with expected metrics", () => {
      const fatteningTmpl = WIZARD_TEMPLATES.find((t) => t.id === "fattening_bull")!;
      expect(fatteningTmpl).toBeDefined();

      const updated = fatteningTmpl.apply(DEFAULT_WIZARD_STATE);
      expect(updated.identification.gender).toBe("male");
      expect(updated.identification.breed).toBe("Crossbred");
      expect(updated.categoryStage.category).toBe("fattening");
      expect(updated.categoryStage.targetWeightKg).toBe(480);
      expect(updated.categoryStage.expectedDailyGainKg).toBe(0.85);
    });

    it("should apply Qurbani Prime template with premium flags", () => {
      const qurbaniTmpl = WIZARD_TEMPLATES.find((t) => t.id === "qurbani_prime")!;
      expect(qurbaniTmpl).toBeDefined();

      const updated = qurbaniTmpl.apply(DEFAULT_WIZARD_STATE);
      expect(updated.categoryStage.isQurbaniTarget).toBe(true);
      expect(updated.categoryStage.targetWeightKg).toBe(550);
    });

    it("should apply farm born calf template", () => {
      const calfTmpl = WIZARD_TEMPLATES.find((t) => t.id === "farm_born_calf")!;
      expect(calfTmpl).toBeDefined();

      const updated = calfTmpl.apply(DEFAULT_WIZARD_STATE);
      expect(updated.origin.originType).toBe("birth");
      expect(updated.origin.purchasePrice).toBe(0);
      expect(updated.origin.birthWeightKg).toBe(28);
    });
  });
});
