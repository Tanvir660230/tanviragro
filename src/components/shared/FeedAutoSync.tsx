import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { syncFeedAutoUsage } from "@/lib/feed/feed-data";

/**
 * Feed in use is deducted every day: whenever the app is opened, any completed day not yet
 * posted is posted (dated on its own day). Renders nothing; a failure never breaks a page.
 */
export async function FeedAutoSync() {
  try {
    const supabase = await createClient();
    const businessId = await getCurrentBusinessId(supabase);
    if (businessId) await syncFeedAutoUsage(supabase, businessId);
  } catch (e) {
    console.warn("[feed] automatic daily posting check failed:", e instanceof Error ? e.message : e);
  }
  return null;
}
