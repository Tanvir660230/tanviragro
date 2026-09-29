/**
 * revertSale behaviour (sales recorded before sale groups) with a scripted fake Supabase client.
 * Each awaited query is matched against `responders` by table + operation.
 */
type Call = { table: string; op: string; payload?: unknown; filters: [string, string, unknown][] };
type Responder = (c: Call) => { data?: unknown; error?: unknown; count?: number } | undefined;

let calls: Call[] = [];
let responders: Responder[] = [];

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    if (["insert", "update", "delete"].includes(name)) {
      call.op = name;
      call.payload = args[0];
    } else if (name === "select" && call.op === "select") {
      call.payload = args[1];
    } else if (["eq", "is", "gte", "lte", "in"].includes(name)) {
      call.filters.push([name, String(args[0]), args[1]]);
    }
    return b;
  };
  for (const m of ["select", "insert", "update", "delete", "eq", "is", "gte", "lte", "in", "order", "limit"]) b[m] = chain(m);
  const resolve = () => {
    calls.push(call);
    for (const r of responders) {
      const res = r(call);
      if (res) return { data: null, error: null, ...res };
    }
    return { data: null, error: null };
  };
  b.single = () => Promise.resolve(resolve());
  b.maybeSingle = () => Promise.resolve(resolve());
  b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(onF, onR);
  return b;
}

const fakeSupabase = { from: (t: string) => builder(t) };

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), revalidateTag: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase }));
jest.mock("@/lib/context/business-context", () => ({
  getBusinessContext: async () => ({ businessId: "biz-1", isOwner: true, permissions: [], role: "owner", user: { id: "u1" } }),
}));
const mockCattle = { id: "cow-1", tag_id: "T1", status: "active" as string };
jest.mock("@/lib/auth/ownership", () => ({ assertResourceOwnership: async () => ({ ...mockCattle }) }));
const mockLock = jest.fn<Promise<string | null>, unknown[]>(async () => null);
jest.mock("@/lib/utils/financialLock", () => ({ checkFinancialLock: (...a: unknown[]) => mockLock(...a) }));
jest.mock("@/lib/livestock/events", () => ({ LivestockEventBus: { publish: async () => {} } }));
jest.mock("@/lib/services/cattle.service", () => ({ CattleDomainService: { assertSaleEligibility: () => {}, validateWeightLog: () => {} } }));

import { revertSale } from "@/app/dashboard/(app)/cattle/[id]/actions";

const find = (table: string, op: string) => calls.filter((c) => c.table === table && c.op === op);

beforeEach(() => {
  calls = [];
  responders = [];
  mockCattle.status = "active";
  mockLock.mockResolvedValue(null);
});

describe("revertSale", () => {
  test("soft-deletes only the active sale and reactivates the animal", async () => {
    mockCattle.status = "sold";
    responders = [
      (c) => (c.table === "sales" && c.op === "select" ? { data: { id: "sale-9", sold_at: "2026-09-01" } } : undefined),
    ];
    await expect(revertSale("cow-1")).resolves.toEqual({ success: true });
    const upd = find("sales", "update")[0];
    expect(upd.filters).toEqual([["eq", "id", "sale-9"]]);
    expect(upd.payload).toEqual({ deleted_at: expect.any(String) });
    expect(find("sales", "delete")).toHaveLength(0);
    expect(mockLock).toHaveBeenCalledWith(fakeSupabase, "biz-1", "2026-09-01");
  });

  test("refuses inside a locked period and writes nothing", async () => {
    mockCattle.status = "sold";
    mockLock.mockResolvedValue("period locked");
    responders = [
      (c) => (c.table === "sales" && c.op === "select" ? { data: { id: "sale-9", sold_at: "2026-01-01" } } : undefined),
    ];
    const res = await revertSale("cow-1");
    expect(res.error).toBe("period locked");
    expect(calls.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  test("refuses when the animal is not sold", async () => {
    mockCattle.status = "active";
    const res = await revertSale("cow-1");
    expect(res.error).toMatch(/not marked as sold/);
    expect(calls).toHaveLength(0);
  });
});
