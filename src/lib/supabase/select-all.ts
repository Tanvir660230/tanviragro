/**
 * Reads EVERY row of a query, page by page.
 *
 * The Supabase API returns at most 1000 rows per request (PostgREST max-rows). A total built
 * from one plain select silently stops at row 1000; the ledger grows by a few rows every day
 * (automatic feed deduction), so every sum over it must read all pages.
 *
 * `make` must build a fresh query each time, ordered by a unique column (e.g. "id"), so pages
 * neither skip nor repeat rows.
 */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;

export async function selectAll<T>(make: () => { range: (from: number, to: number) => Page<T> }, pageSize = PAGE_SIZE): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await make().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message ?? "Could not read all rows");
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}
