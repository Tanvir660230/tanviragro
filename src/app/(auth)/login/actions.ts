"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { safeRedirectPath } from "@/lib/app-url";

type LoginState = { error?: string; magicLinkSent?: boolean } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();

  // Rate limit: 5 password attempts per 60 seconds per IP/email
  const allowed = rateLimit(`login:${ip}:${email}`, 5, 60_000);
  if (!allowed) {
    return { error: "Too many login attempts. Please wait 1 minute before trying again." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: "Invalid email or password. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("redirectTo") as string | null));
}

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();

  if (!email) {
    return { error: "Email is required." };
  }

  // Rate limit: 3 magic links per 10 minutes per IP/email
  const allowed = rateLimit(`magic-link:${ip}:${email}`, 3, 600_000);
  if (!allowed) {
    return { error: "Too many requests. Please wait a few minutes before requesting another link." };
  }

  const supabase = await createClient();
  const origin = headersList.get("origin") ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Failed to send magic link. Please try again." };
  }

  return { magicLinkSent: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
