"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";

type State = { error?: string; success?: boolean } | undefined;

export async function forgotPassword(
  _prevState: State,
  formData: FormData
): Promise<State> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Rate limit: 3 password reset requests per 10 minutes per IP/email
  const allowed = rateLimit(`forgot-pass:${ip}:${email}`, 3, 600_000);
  if (!allowed) {
    // Return success to avoid enumeration while quietly ignoring rate limit exhaustion
    return { success: true };
  }

  const supabase = await createClient();

  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const siteUrl = `${protocol}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("Reset password error:", error.message);
  }

  // Always return success to prevent email enumeration attacks
  return { success: true };
}
