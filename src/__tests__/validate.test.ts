import { describe, it, expect } from "@jest/globals";
import {
  dateSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  validateDate,
  validatePositiveNumber,
  validateText,
  createCattleSchema,
} from "@/lib/validate";

describe("Input Validation Schemas", () => {
  describe("dateSchema", () => {
    it("accepts valid past/present date format YYYY-MM-DD", () => {
      expect(dateSchema.safeParse("2024-01-15").success).toBe(true);
      expect(dateSchema.safeParse("2020-12-31").success).toBe(true);
    });

    it("rejects invalid date strings and non-dates", () => {
      expect(dateSchema.safeParse("15-01-2024").success).toBe(false);
      expect(dateSchema.safeParse("not-a-date").success).toBe(false);
      expect(dateSchema.safeParse("").success).toBe(false);
    });

    it("rejects future dates", () => {
      expect(dateSchema.safeParse("2099-01-01").success).toBe(false);
    });
  });

  describe("positiveNumberSchema", () => {
    it("accepts positive numbers and coerces valid numeric strings", () => {
      expect(positiveNumberSchema.safeParse(100).success).toBe(true);
      expect(positiveNumberSchema.safeParse("50.5").success).toBe(true);
    });

    it("rejects zero and negative numbers", () => {
      expect(positiveNumberSchema.safeParse(0).success).toBe(false);
      expect(positiveNumberSchema.safeParse(-5).success).toBe(false);
      expect(positiveNumberSchema.safeParse("abc").success).toBe(false);
    });
  });

  describe("nonNegativeNumberSchema", () => {
    it("accepts zero and positive values", () => {
      expect(nonNegativeNumberSchema.safeParse(0).success).toBe(true);
      expect(nonNegativeNumberSchema.safeParse(12.5).success).toBe(true);
    });

    it("rejects negative numbers", () => {
      expect(nonNegativeNumberSchema.safeParse(-0.1).success).toBe(false);
    });
  });

  describe("createCattleSchema", () => {
    it("validates a complete cattle payload", () => {
      const validCattle = {
        tag_id: "TAG-001",
        gender: "male",
        breed: "Sahiwal",
        purchase_date: "2024-01-01",
        purchase_price: 85000,
        initial_weight_kg: 220,
        transport_cost: 2000,
        haat_hasil: 500,
        notes: "Healthy bull",
      };
      const result = createCattleSchema.safeParse(validCattle);
      expect(result.success).toBe(true);
    });

    it("rejects payload with missing tag_id or purchase_price <= 0", () => {
      const invalid = {
        tag_id: "",
        gender: "male",
        purchase_date: "2024-01-01",
        purchase_price: -100,
        initial_weight_kg: 200,
      };
      const result = createCattleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Legacy validation helpers", () => {
    it("validateDate returns null for valid date and error string for invalid", () => {
      expect(validateDate("2024-01-01", "Date")).toBeNull();
      expect(typeof validateDate("invalid", "Date")).toBe("string");
    });

    it("validatePositiveNumber checks values correctly", () => {
      expect(validatePositiveNumber(50, "Weight")).toBeNull();
      expect(typeof validatePositiveNumber(-5, "Weight")).toBe("string");
    });

    it("validateText checks maximum length correctly", () => {
      expect(validateText("Valid text", "Notes", 50)).toBeNull();
      expect(typeof validateText("a".repeat(100), "Notes", 50)).toBe("string");
    });
  });
});
