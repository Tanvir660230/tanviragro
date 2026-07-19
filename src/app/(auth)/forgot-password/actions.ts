"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

type State = { error?: string; success?: boolean } | undefined;

export async function forgotPassword(
  _prevState: State,
  formData: FormData
): Promise<State> {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();

  const headersList = await headers();
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
