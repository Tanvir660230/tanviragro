import { isDateLocked, validateFinancialLockDate } from "@/lib/financial/financial-lock";

describe("Phase 1: Foundation, Data Governance & Financial Lockout Suite", () => {
  describe("Financial Lockout Enforcer", () => {
    it("correctly identifies whether a date is locked", () => {
      const lockDate = "2026-06-30";

      // On or before lock date -> locked
      expect(isDateLocked("2026-06-30", lockDate)).toBe(true);
      expect(isDateLocked("2026-06-15", lockDate)).toBe(true);
      expect(isDateLocked("2026-01-01", lockDate)).toBe(true);

      // After lock date -> open
      expect(isDateLocked("2026-07-01", lockDate)).toBe(false);
      expect(isDateLocked("2026-12-31", lockDate)).toBe(false);

      // Null lock date -> open
      expect(isDateLocked("2026-05-01", null)).toBe(false);
    });

    it("validates financial lock date and returns descriptive error response", () => {
      const lockDate = "2026-06-30";

      const lockedValidation = validateFinancialLockDate("2026-05-20", lockDate, "cattle sale");
      expect(lockedValidation.isLocked).toBe(true);
      expect(lockedValidation.lockDate).toBe("2026-06-30");
      expect(lockedValidation.errorMessage).toContain("Cannot modify cattle sale dated 2026-05-20");

      const allowedValidation = validateFinancialLockDate("2026-07-15", lockDate, "cattle sale");
      expect(allowedValidation.isLocked).toBe(false);
      expect(allowedValidation.errorMessage).toBeUndefined();
    });
  });
});
