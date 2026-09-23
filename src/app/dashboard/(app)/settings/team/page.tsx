import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield, UserPlus, Users, CheckCircle2, ShieldCheck, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/settings/InviteForm";
import { MemberRow } from "@/components/settings/MemberRow";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Team & User Access Control" };

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800",
  worker:  "bg-muted text-muted-foreground border border-border",
};

export default async function TeamPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const t = await getDictionary(locale as "en" | "bn");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const [{ data: biz }, { data: profile }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const { data: membersData } = biz
    ? await supabase
        .from("business_users")
        .select("id, role, created_at, user_id")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const members = (membersData ?? []) as { id: string; role: string; created_at: string; user_id: string }[];
  const ownerName = profile?.full_name || user?.email?.split("@")[0] || "Owner";
  const initials = ownerName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title={t.team.title}
        subtitle={t.team.subtitle}
        icon={Users}
        back="/dashboard/settings?tab=team"
      />

      {/* Role Guide + Invite Grid */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Role Guide */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">{t.team.access_levels}</h2>
          </div>
          <div className="space-y-3 text-xs">
            {[
              { role: "admin",   label: t.team.admin,   desc: t.team.admin_desc },
              { role: "manager", label: t.team.manager,  desc: t.team.manager_desc },
              { role: "worker",  label: t.team.staff,    desc: t.team.staff_desc },
            ].map(({ role, label, desc }) => (
              <div key={role} className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase shrink-0 mt-0.5 ${ROLE_BADGE[role]}`}>
                  {label}
                </span>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Form Card */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">{t.team.invite}</h2>
          </div>
          <InviteForm />
        </div>
      </div>

      {/* Primary Workspace Owner */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.team.owner}</h3>
          <span className="text-xs text-muted-foreground font-mono">1 Primary Owner</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 text-xs shrink-0 border border-border/80">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={ownerName} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{ownerName} ({user?.email ?? "—"})</p>
              <p className="text-xs text-muted-foreground">{t.team.owner_desc}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize shrink-0 ${ROLE_BADGE.admin}`}>
            Admin / Owner
          </span>
        </div>
      </div>

      {/* Team Members List */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t.team.team_members} ({members.length})
          </h3>
          <span className="text-xs text-muted-foreground font-mono">Multi-tenant RBAC</span>
        </div>
        {members.length === 0 ? (
          <div className="p-12 text-center bg-muted/5">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No additional members invited yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send an email invitation above to onboard managers and field staff to your enterprise workspace.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {members.map((m) => (
              <MemberRow key={m.id} id={m.id} role={m.role} joinedAt={m.created_at} userId={m.user_id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
