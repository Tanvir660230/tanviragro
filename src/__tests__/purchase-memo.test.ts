import { buildPurchaseContext, findSameMemo, memoSupplier, type PurchaseRow } from "@/lib/inventory/purchase-memo";

const row = (id: string, item: string, date: string, qty: number, cost: number | null, supplier: string | null, created = date): PurchaseRow => ({
  id, item_id: item, qty, unit_cost: cost, recorded_at: date, created_at: `${created}T10:00:00Z`,
  notes: supplier ? `Invoice Memo. Supplier: ${supplier}. | Transport: 0 | Mode: loose` : null,
});

describe("purchase memo context", () => {
  test("supplier is read from the memo notes (same rule as Purchase history)", () => {
    expect(memoSupplier("Invoice Memo. Supplier: MS Fayaz Khaddo Ghor Nowapara.")).toBe("MS Fayaz Khaddo Ghor Nowapara");
    expect(memoSupplier("Invoice Memo. Supplier: Bashundia Mor. | Transport: 300")).toBe("Bashundia Mor");
    expect(memoSupplier("Rahad Mama theke kinse")).toBeNull();
    expect(memoSupplier(null)).toBeNull();
  });

  const rows = [
    row("1", "corn", "2026-08-12", 100, 36, "Bashundia Mor", "2026-08-23"),
    row("2", "bran", "2026-08-12", 35, 54, "Bashundia Mor", "2026-08-23"),
    row("3", "corn", "2026-09-03", 100, 38, "bashundia mor ", "2026-09-07"),
    row("4", "salt", "2026-09-03", 5, 0, "bashundia mor ", "2026-09-07"),
    row("5", "straw", "2026-08-27", 240, 25, null),
    row("6", "corn", "2026-06-17", 200, 37.73, "MS Fayaz"),
  ];
  const ctx = buildPurchaseContext({ rows, dues: [{ lender: "Bashundia Mor", outstanding: 1200 }, { lender: "Old Shop", outstanding: 50 }] });

  test("last price per item is the latest purchase with a price (a free item keeps its older price)", () => {
    expect(ctx.lastBuy.corn).toMatchObject({ unitCost: 38, date: "2026-09-03" });
    expect(ctx.lastBuy.salt).toBeUndefined();
    expect(ctx.lastBuy.straw).toMatchObject({ unitCost: 25, supplier: null });
  });
  test("shops: one entry per shop (name case/space ignored), latest first, with the open due", () => {
    expect(ctx.suppliers.map((s) => s.name)).toEqual(["bashundia mor", "MS Fayaz", "Old Shop"]);
    expect(ctx.suppliers[0]).toMatchObject({ memoCount: 2, due: 1200, lastDate: "2026-09-03" });
    expect(ctx.suppliers[2]).toMatchObject({ memoCount: 0, due: 50 });
  });
  test("the shop's last memo can refill a new one", () => {
    expect(ctx.lastMemoBySupplier["bashundia mor"]).toEqual({ date: "2026-09-03", lines: [{ itemId: "corn", qty: 100, unitCost: 38 }, { itemId: "salt", qty: 5, unitCost: 0 }] });
  });
  test("recent memos newest first, and the same shop + date is found as a possible duplicate", () => {
    expect(ctx.recentMemos[0]).toMatchObject({ date: "2026-09-03", itemCount: 2, total: 3800, enteredOn: "2026-09-07" });
    expect(findSameMemo(ctx.recentMemos, "2026-08-12", "BASHUNDIA MOR")?.total).toBe(100 * 36 + 35 * 54);
    expect(findSameMemo(ctx.recentMemos, "2026-08-13", "Bashundia Mor")).toBeNull();
    expect(findSameMemo(ctx.recentMemos, "2026-08-12", "  ")).toBeNull();
  });
  test("items bought most often come first", () => {
    expect(ctx.frequentItemIds[0]).toBe("corn");
  });
});
