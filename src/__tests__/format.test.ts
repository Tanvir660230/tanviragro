import { fmtBDT, fmtBDTFull, fmtDate, fmtPct } from "@/lib/format";

describe("fmtBDT", () => {
  it("formats crore amounts", () => {
    expect(fmtBDT(10_000_000)).toBe("৳1.00 Cr");
    expect(fmtBDT(25_500_000)).toBe("৳2.55 Cr");
  });

  it("formats lakh amounts", () => {
    expect(fmtBDT(100_000)).toBe("৳1.00 L");
    expect(fmtBDT(250_000)).toBe("৳2.50 L");
  });

  it("formats thousands", () => {
    expect(fmtBDT(5_000)).toBe("৳5.0K");
    expect(fmtBDT(1_500)).toBe("৳1.5K");
  });

  it("formats small amounts", () => {
    expect(fmtBDT(500)).toBe("৳500");
    expect(fmtBDT(0)).toBe("৳0");
  });

  it("handles negative amounts", () => {
    expect(fmtBDT(-50_000)).toBe("-৳50.0K");
    expect(fmtBDT(-200_000)).toBe("-৳2.00 L");
  });
});

describe("fmtBDTFull", () => {
  it("formats without abbreviation", () => {
    expect(fmtBDTFull(150_000)).toBe("৳1,50,000");
  });

  it("omits decimal zeros", () => {
    expect(fmtBDTFull(1000)).toBe("৳1,000");
  });

  it("uses absolute value for negatives", () => {
    expect(fmtBDTFull(-5000)).toBe("৳5,000");
  });
});

describe("fmtDate", () => {
  it("formats a date string (YYYY-MM-DD)", () => {
    const result = fmtDate("2024-06-15");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("handles ISO datetime strings", () => {
    const result = fmtDate("2024-01-01T10:00:00");
    expect(result).toContain("Jan");
    expect(result).toContain("2024");
  });

  it("accepts custom format options", () => {
    const result = fmtDate("2024-03-05", { month: "long", year: "numeric" });
    expect(result).toContain("March");
    expect(result).toContain("2024");
  });
});

describe("fmtPct", () => {
  it("formats with 1 decimal by default", () => {
    expect(fmtPct(42.567)).toBe("42.6%");
  });

  it("formats with custom decimals", () => {
    expect(fmtPct(12.3456, 2)).toBe("12.35%");
    expect(fmtPct(100, 0)).toBe("100%");
  });

  it("handles zero and negative", () => {
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(-5.5)).toBe("-5.5%");
  });
});
