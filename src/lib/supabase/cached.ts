/**
 * Request-scoped cached helpers for Supabase access.
 *
 * React's `cache()` deduplicates calls within a single server-render pass.
 * Any server component calling `getServerClient()` or `getCachedBusinessId()`
 * multiple times (or via concurrent Suspense sections) will share the same
 * result — zero extra network/DB calls.
 */
import { cache } from "react";
import { createClient } from "./server";
import { getCurrentBusinessId } from "./get-business";

/** Returns a Supabase server client, created only once per request. */
export const getServerClient = cache(async () => {
  return createClient();
});

/** Returns the current user's business ID, fetched only once per request. */
export const getCachedBusinessId = cache(async () => {
  const supabase = await getServerClient();
  return getCurrentBusinessId(supabase);
});
