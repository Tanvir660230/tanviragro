import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountingData } from "@/lib/accounting/engine";
import { loadPartnerData } from "@/lib/partners/load-positions";
import { startOfMonth, todayDhaka } from "@/lib/dates";
import { buildMoneyModel, monthEnd, type MoneyModel } from "@/lib/money/money-model";

const shiftMonth = (month: string, n: number) => {
  const t = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/**
 * Everything the Money page shows, from the central sources (accounting engine, farm position,
 * home model). The engine reads the database once per request; each period is only a re-count.
 */
export async function loadMoneyData(supabase: SupabaseClient<any>, businessId: string, period: { from: string | null; to: string | null }): Promise<MoneyModel> {
  const today = todayDhaka();
  const month = today.slice(0, 7);
  const last6 = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const lastMonth = shiftMonth(month, -1);
  const to = period.to ?? today;

  const lastSameDaysEnd = (() => { const e = `${lastMonth}-${today.slice(8, 10)}`, me = monthEnd(lastMonth); return e < me ? e : me; })();
  const [all, inPeriod, thisMonth, prevMonth, prevSameDays, monthData, partner, priceRes, countsRes] = await Promise.all([
    getAccountingData(supabase),
    getAccountingData(supabase, period.from ?? undefined, to),
    getAccountingData(supabase, startOfMonth(today), today),
    getAccountingData(supabase, `${lastMonth}-01`, monthEnd(lastMonth)),
    getAccountingData(supabase, `${lastMonth}-01`, lastSameDaysEnd),
    Promise.all(last6.map(async (m) => ({ month: m, data: await getAccountingData(supabase, `${m}-01`, m === month ? today : monthEnd(m)) }))),
    loadPartnerData(supabase, businessId),
    supabase.from("market_prices").select("price_per_kg, date").eq("business_id", businessId).order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cash_counts").select("id, counted_on, amount, note").eq("business_id", businessId).is("deleted_at", null)
      .order("counted_on", { ascending: false }).order("created_at", { ascending: false }).limit(20),
  ]);
  // before migration 20260927120000 the table is missing: counting is simply not offered
  const e = countsRes.error as { code?: string; message?: string } | null;
  const countsMissing = !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));
  if (e && !countsMissing) throw new Error(`cash counts: ${e.message}`);
  const cashCounts = countsMissing ? null : ((countsRes.data ?? []) as { id: string; counted_on: string; amount: number | string; note: string | null }[])
    .map((c) => ({ id: c.id, date: String(c.counted_on).slice(0, 10), amount: Number(c.amount), note: c.note }));
  const price = priceRes.data as { price_per_kg: number | string; date: string } | null;

  return buildMoneyModel({
    today, period: { from: period.from, to }, all, inPeriod, thisMonth, lastMonth: prevMonth, lastMonthSameDays: prevSameDays, months: monthData,
    farm: partner.farm, home: partner.home, accountsCheck: partner.accountsCheck, cashCounts,
    marketPrice: price && Number(price.price_per_kg) > 0 ? { perKg: Number(price.price_per_kg), date: String(price.date).slice(0, 10) } : null,
  });
}
