"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

async function getAdminSupabase() {
  const { createClient: createAdmin } = await import("@supabase/supabase-js");
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type TeamFormState = { error?: string; success?: string } | undefined;

export async function inviteTeamMember(
  _prev: TeamFormState,
  formData: FormData
): Promise<TeamFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role  = formData.get("role") as string;

  if (!email || !email.includes("@")) return { error: "Enter a valid email address" };
  if (!["manager", "worker"].includes(role)) return { error: "Select a valid role" };

  // Get business owned by the current user
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!biz) return { error: "No business found. Set up your business first." };

  // Invite via Supabase admin API
  const admin = await getAdminSupabase();
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, business_id: biz.id },
    redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "vercel.app") ?? ""}/auth/callback`,
  });

  if (inviteErr) return { error: inviteErr.message };

  // Add to business_users
  if (invited.user) {
    await supabase.from("business_users").upsert({
      business_id: biz.id,
      user_id: invited.user.id,
      role: role as UserRole,
    });
  }

  revalidatePath("/dashboard/settings/team");
  return { success: `Invitation sent to ${email}` };
}

export async function updateMemberRole(
  memberId: string,
  role: UserRole
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { data: member } = await supabase
    .from("business_users")
    .select("user_id, business_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.business_id !== biz.id) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("business_users")
    .update({ role })
    .eq("id", memberId);

  if (error) return { error: "Failed to update role" };

  // Also update user_metadata via admin API
  const admin = await getAdminSupabase();
  if (member.user_id) {
    await admin.auth.admin.updateUserById(member.user_id, { user_metadata: { role } });
  }

  revalidatePath("/dashboard/settings/team");
  return {};
}

export async function removeMember(memberId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { data: member } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.business_id !== biz.id) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("business_users")
    .delete()
    .eq("id", memberId);

  if (error) return { error: "Failed to remove member" };
  revalidatePath("/dashboard/settings/team");
  return {};
}
