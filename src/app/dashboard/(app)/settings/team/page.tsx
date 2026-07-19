import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/settings/InviteForm";
import { MemberRow } from "@/components/settings/MemberRow";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Team & Roles" };

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  worker:  "bg-muted text-muted-foreground",
};

export default async function TeamPage() {
   
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: membersData } = biz
    ? await supabase
        .from("business_users")
        .select("id, role, created_at, user_id")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const members = (membersData ?? []) as { id: string; role: string; created_at: string; user_id: string }[];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.team.title}
        subtitle={t.team.subtitle}
        icon={Users}
        back="/dashboard/settings"
      />

      {/* Role Guide + Invite — side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Role Guide */}
        <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{t.team.access_levels}</h2>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { role: "admin",   label: t.team.admin,   desc: t.team.admin_desc },
              { role: "manager", label: t.team.manager,  desc: t.team.manager_desc },
              { role: "worker",  label: t.team.staff,    desc: t.team.staff_desc },
            ].map(({ role, label, desc }) => (
              <div key={role} className="flex items-start gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0 mt-0.5 ${ROLE_BADGE[role]}`}>
                  {label}
                </span>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Invite */}
        <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{t.team.invite}</h2>
          </div>
          <InviteForm />
        </div>
      </div>

      {/* Current Owner */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{t.team.owner}</h2>
        </div>
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t.team.owner_desc}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE.admin}`}>
            Admin
          </span>
        </div>
      </div>

      {/* Team Members */}
      {members.length > 0 && (
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">{t.team.team_members}</h2>
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <MemberRow key={m.id} id={m.id} role={m.role} joinedAt={m.created_at} userId={m.user_id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
