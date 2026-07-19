"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type State = { error?: string } | undefined;

export async function resetPassword(
  _prevState: State,
  formData: FormData
): Promise<State> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Failed to update password. The reset link may have expired." };
  }

  await supabase.auth.signOut();
  redirect("/login?message=password_updated");
}
