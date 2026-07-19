import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "./BottomNav";

export async function BottomNavWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = true;
  if (user) {
    const { data: roleData } = await supabase.rpc("get_user_business_role", { p_user_id: user.id });
    const role = (roleData as { role?: string } | null)?.role;
    isAdmin = !role || role === "owner" || role === "admin";
  }

  return <BottomNav isAdmin={isAdmin} />;
}
