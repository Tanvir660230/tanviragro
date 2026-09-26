import { PartnerEngine } from "@/lib/partners/partner-engine";
import type { Partner } from "@/types/database";

// Money figures are tested in partner-position.test.ts; this covers the input checks only.
describe("partner input checks", () => {
  const manual = { id: "m", share_mode: "manual", profit_share_pct: 60 } as unknown as Partner;

  test("a transaction needs a positive amount, a known type and a date", () => {
    expect(PartnerEngine.validateTransaction({ partnerId: "p1", type: "investment", amount: -5000, recordedAt: "2026-01-01" }).errors[0]).toContain("positive number");
    expect(PartnerEngine.validateTransaction({ partnerId: "p1", type: "gift", amount: 5, recordedAt: "2026-01-01" }).isValid).toBe(false);
    expect(PartnerEngine.validateTransaction({ partnerId: "p1", type: "withdrawal", amount: 5, recordedAt: "2026-01-01" }).isValid).toBe(true);
  });

  test("fixed shares cannot add up to more than 100%", () => {
    const r = PartnerEngine.validatePartner({ name: "X", partnerType: "labor", shareMode: "manual", profitSharePct: 50, existingPartners: [manual] });
    expect(r.isValid).toBe(false);
    expect(PartnerEngine.validatePartner({ name: "X", partnerType: "labor", shareMode: "manual", profitSharePct: 40, existingPartners: [manual] }).isValid).toBe(true);
    // editing the same partner does not count its old share twice
    expect(PartnerEngine.validatePartner({ name: "M", partnerType: "labor", shareMode: "manual", profitSharePct: 90, existingPartners: [manual], editingPartnerId: "m" }).isValid).toBe(true);
  });
});
