"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
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
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.TEAM_MANAGE);

    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const role = formData.get("role") as string;

    if (!email || !email.includes("@")) return { error: "Enter a valid email address" };
    if (!["manager", "worker"].includes(role)) return { error: "Select a valid role" };

    // Invite via Supabase admin API
    const admin = await getAdminSupabase();
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, business_id: ctx.businessId },
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "vercel.app") ?? ""}/auth/callback`,
    });

    if (inviteErr) return { error: inviteErr.message };

    // Add to business_users
    if (invited.user) {
      await supabase.from("business_users").upsert({
        business_id: ctx.businessId,
        user_id: invited.user.id,
        role: role as UserRole,
      });
    }

    revalidatePath("/dashboard/settings/team");
    return { success: `Invitation sent to ${email}` };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to invite team member" };
  }
}

export async function updateMemberRole(
  memberId: string,
  role: UserRole
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.TEAM_MANAGE);

    const member = await assertResourceOwnership<{ id: string; user_id: string; business_id: string }>(
      supabase,
      "business_users",
      memberId,
      ctx.businessId
    );

    const { error } = await supabase
      .from("business_users")
      .update({ role })
      .eq("id", memberId);

    if (error) return { error: "Failed to update role" };

    // Also update user_metadata via admin API
    if (member.user_id) {
      const admin = await getAdminSupabase();
      await admin.auth.admin.updateUserById(member.user_id, { user_metadata: { role } });
    }

    revalidatePath("/dashboard/settings/team");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update member role" };
  }
}

export async function removeMember(memberId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.TEAM_MANAGE);

    await assertResourceOwnership(
      supabase,
      "business_users",
      memberId,
      ctx.businessId
    );

    const { error } = await supabase
      .from("business_users")
      .delete()
      .eq("id", memberId);

    if (error) return { error: "Failed to remove member" };
    revalidatePath("/dashboard/settings/team");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to remove member" };
  }
}
