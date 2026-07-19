import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "./AppSidebar";

export async function AppSidebarWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <AppSidebar isAdmin={false} business={null} />;

  // RPC returns { business_id, role } for both owners and team members
  const { data: roleData } = await supabase.rpc("get_user_business_role", {
    p_user_id: user.id,
  });

  const role = (roleData as { role?: string; business_id?: string } | null)?.role;
  const businessId = (roleData as { business_id?: string } | null)?.business_id;
  const isAdmin = !role || role === "owner" || role === "admin";

  // Fetch business by ID so non-admin team members also see the correct name/logo
  const { data: bizData } = businessId
    ? await supabase
        .from("businesses")
        .select("name, logo_url")
        .eq("id", businessId)
        .maybeSingle()
    : { data: null };

  return <AppSidebar isAdmin={isAdmin} business={bizData} />;
}
