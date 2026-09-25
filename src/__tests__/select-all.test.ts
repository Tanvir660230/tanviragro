import { selectAll } from "@/lib/supabase/select-all";

/** fake query: `total` rows, pages served by range(from, to) like PostgREST */
const fake = (total: number, calls: [number, number][]) => () => ({
  range: (from: number, to: number) => {
    calls.push([from, to]);
    const data = Array.from({ length: Math.max(0, Math.min(total, to + 1) - from) }, (_, i) => ({ n: from + i }));
    return Promise.resolve({ data, error: null });
  },
});

describe("selectAll reads past the 1000-row API limit", () => {
  test("2,345 rows → three pages, every row once, in order", async () => {
    const calls: [number, number][] = [];
    const rows = await selectAll(fake(2345, calls));
    expect(rows).toHaveLength(2345);
    expect(rows[2344]).toEqual({ n: 2344 });
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  test("exactly one full page asks once more, then stops", async () => {
    const calls: [number, number][] = [];
    expect(await selectAll(fake(1000, calls))).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });
  test("an error is raised, never a silently short list", async () => {
    await expect(selectAll(() => ({ range: () => Promise.resolve({ data: null, error: { message: "boom" } }) }))).rejects.toThrow("boom");
  });
});
