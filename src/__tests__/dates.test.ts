import { addDays, startOfMonth, toDhakaDate, todayDhaka } from "@/lib/dates";

describe("toDhakaDate", () => {
  test("early morning in Dhaka is already the next calendar day (UTC is still 'yesterday')", () => {
    // 2026-09-24 05:30 in Dhaka == 2026-09-23 23:30 UTC
    const instant = new Date("2026-09-23T23:30:00Z");
    expect(instant.toISOString().slice(0, 10)).toBe("2026-09-23");
    expect(toDhakaDate(instant)).toBe("2026-09-24");
  });

  test("day boundary is midnight Dhaka (18:00 UTC)", () => {
    expect(toDhakaDate(new Date("2026-09-23T17:59:59Z"))).toBe("2026-09-23");
    expect(toDhakaDate(new Date("2026-09-23T18:00:00Z"))).toBe("2026-09-24");
  });

  test("afternoon matches UTC date", () => {
    expect(toDhakaDate(new Date("2026-09-24T08:00:00Z"))).toBe("2026-09-24");
  });

  test("year boundary", () => {
    expect(toDhakaDate(new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });

  test("accepts epoch millis", () => {
    expect(toDhakaDate(Date.parse("2026-09-23T23:30:00Z"))).toBe("2026-09-24");
  });
});

describe("todayDhaka", () => {
  afterEach(() => jest.useRealTimers());
  test("uses the current clock", () => {
    jest.useFakeTimers({ now: new Date("2026-03-01T20:15:00Z") });
    expect(todayDhaka()).toBe("2026-03-02");
  });
});

describe("addDays / startOfMonth", () => {
  test("crosses month and leap-year boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-01-05", -7)).toBe("2025-12-29");
    expect(addDays("2026-09-24", 0)).toBe("2026-09-24");
  });
  test("startOfMonth", () => {
    expect(startOfMonth("2026-09-24")).toBe("2026-09-01");
  });
});
