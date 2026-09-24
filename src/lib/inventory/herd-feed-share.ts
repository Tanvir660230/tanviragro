import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFeedData } from "@/lib/feed/feed-data";

/**
 * ACTUAL feed cost of each animal that is NOT already counted from its own cattle-linked
 * rows (callers add those through get_cattle_consumptions). Comes from the one feed engine
 * (lib/feed/usage-engine.ts): closed usage periods and recorded herd feeding, split per day
 * by live weight and presence. Running (estimated) usage is never included here.
 */
export async function getHerdFeedShareByCattle(
  supabase: SupabaseClient<any>,
  businessId: string | null
): Promise<Record<string, number>> {
  if (!businessId) return {};
  const { snapshot, directByAnimal } = await loadFeedData(supabase, businessId);
  const out: Record<string, number> = {};
  for (const [id, f] of Object.entries(snapshot.perAnimal)) out[id] = f.actual - (directByAnimal[id] ?? 0);
  return out;
}
