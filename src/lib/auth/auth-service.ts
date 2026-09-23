import { cache } from "react";
import type { SupabaseClient, User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AuthError, NotFoundError } from "@/lib/errors";
import type { Profile } from "@/types/database";

/**
 * Authoritative user authentication service.
 * Request-memoized to prevent duplicate Supabase auth calls.
 */
export const getCurrentUser = cache(async (
  providedSupabase?: SupabaseClient
): Promise<User | null> => {
  const supabase = providedSupabase || (await createClient());
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Guarantees authenticated user exists or throws standard AuthError.
 */
export async function requireAuth(providedSupabase?: SupabaseClient): Promise<User> {
  const user = await getCurrentUser(providedSupabase);
  if (!user || !user.id) {
    throw new AuthError("Authentication required to perform this action");
  }
  return user;
}

/**
 * Returns current session info if available.
 */
export const getCurrentSession = cache(async (
  providedSupabase?: SupabaseClient
): Promise<Session | null> => {
  const supabase = providedSupabase || (await createClient());
  const { data: { session } } = await supabase.auth.getSession();
  return session;
});

/**
 * Returns the profile for a given user ID.
 */
export const getUserProfile = cache(async (
  userId: string,
  providedSupabase?: SupabaseClient
): Promise<Profile | null> => {
  const supabase = providedSupabase || (await createClient());
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return (profile as Profile) || null;
});