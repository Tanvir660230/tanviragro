import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import {
  MarketPriceChartClient,
  type PriceRow,
} from "./MarketPriceChartClient";

export async function MarketPriceCard() {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return null;

  const { data } = await supabase
    .from("market_prices")
    .select("date, price_per_kg, notes")
    .eq("business_id", businessId)
    .order("date", { ascending: false })
    .limit(16);

  const prices = (data ?? []) as PriceRow[];

  return <MarketPriceChartClient initialPrices={prices} />;
}
