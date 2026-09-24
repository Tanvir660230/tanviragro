import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/login/actions";
import { BusinessProfileForm } from "@/components/settings/BusinessProfileForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { HealthProtocolCard } from "@/components/settings/HealthProtocolCard";
import { OpeningCashForm } from "@/components/settings/OpeningCashForm";
import { TaxForm } from "@/components/settings/TaxForm";
import { ManagementFeeForm } from "@/components/settings/ManagementFeeForm";
import type { ManagementFeeRate, UserRole } from "@/types/database";
import { UnitPriceForm } from "@/components/settings/UnitPriceForm";
import { DailyGainForm } from "@/components/settings/DailyGainForm";
import { FiscalYearForm } from "@/components/settings/FiscalYearForm";
import { DefaultRoughageForm } from "@/components/settings/DefaultRoughageForm";
import { InviteForm } from "@/components/settings/InviteForm";
import { MemberRow } from "@/components/settings/MemberRow";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { PushNotificationButton } from "@/components/shared/PushNotificationButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut, Trash2, Users, Building2, User, ShieldCheck,
  Wallet, Bell, Paintbrush, Heart, BadgeCheck, ChevronRight, Layers,
  Calendar, Wheat, Download, Languages, Settings2, Shield, Activity,
  Database, CheckCircle2, HardDrive, Sparkles, ExternalLink, UserPlus, Zap
} from "lucide-react";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Settings & Administration" };

const TAB_KEYS = ["profile", "team", "security", "finance", "operations", "preferences"] as const;
type Tab = typeof TAB_KEYS[number];

function getInitials(name?: string | null, email?: string) {
  if (name) {
    return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }
  return (email ?? "U")[0].toUpperCase();
}

const ROLE_BADGE: Record<string, string> = {
  admin:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border border-blue-300 dark:border-blue-800",
  worker:  "bg-muted text-muted-foreground border border-border",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const activeTab: Tab = (TAB_KEYS.includes(rawTab as Tab) ? rawTab : "profile") as Tab;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";
  const t = await getDictionary(locale as "en" | "bn");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const [{ data: bizData }, { data: profileData }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", userId).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  // Fetch contextual tab data concurrently
  const [
    { data: feeRates },
    { data: membersData },
    { count: trashCostCount },
    { count: trashInvCount },
    { count: trashLogCount },
  ] = await Promise.all([
    bizData?.id && activeTab === "finance"
      ? supabase
          .from("management_fee_rates")
          .select("*")
          .eq("business_id", bizData.id)
          .is("deleted_at", null)
          .order("effective_from", { ascending: false })
      : Promise.resolve({ data: null }),
    bizData?.id
      ? supabase
          .from("business_users")
          .select("id, role, created_at, user_id")
          .eq("business_id", bizData.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from("cost_entries").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("inventory_items").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("weight_logs").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);

  const feeHistory = (feeRates ?? []) as ManagementFeeRate[];
  const currentFeeRate = feeHistory[0] ?? null;
  const members = (membersData ?? []) as { id: string; role: string; created_at: string; user_id: string }[];
  const totalTrashCount = (trashCostCount ?? 0) + (trashInvCount ?? 0) + (trashLogCount ?? 0);

  const displayName = profileData?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email ?? "";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";
  const initials = getInitials(profileData?.full_name, email);
  const businessName = bizData?.name ?? "Enterprise Farm";

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { key: "profile",     label: "Organization & Profile", icon: Building2 },
    { key: "team",        label: "Team & Roles",          icon: Users, badge: members.length + 1 },
    { key: "security",    label: "Security & Access",     icon: ShieldCheck },
    { key: "finance",     label: "Financial Setup",       icon: Wallet },
    { key: "operations",  label: "Herd & Operations",     icon: Layers },
    { key: "preferences", label: "Preferences & System",  icon: Settings2, badge: totalTrashCount > 0 ? `${totalTrashCount} in trash` : undefined },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings2 className="h-6 w-6 text-primary" />
            Enterprise Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage enterprise parameters, user roles, security credentials, and system defaults.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/operations"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Operations & Health
          </Link>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 py-1.5 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-foreground">Active Workspace</span>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-xs text-muted-foreground font-mono">{businessName}</span>
          </div>
        </div>
      </div>

      {/* ── Tab Bar Navigation ── */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none" aria-label="Settings Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/dashboard/settings?tab=${tab.key}`}
                className={cn(
                  "group inline-flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-all",
                  isActive
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium font-mono",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ══ PROFILE / ORGANIZATION TAB ══════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Identity & Organization Card */}
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 text-lg shrink-0 border-2 border-border/80 shadow-sm">
                  <AvatarImage src={profileData?.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-foreground truncate">{displayName}</h2>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                      Enterprise Owner
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    Managing <span className="font-semibold text-foreground">{businessName}</span> · Joined {memberSince}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Link
                  href="/dashboard/settings/activity"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors shadow-xs"
                >
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  Activity Timeline
                </Link>
                <Link
                  href="/dashboard/settings/team"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors shadow-xs"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Team ({members.length + 1})
                </Link>
              </div>
            </div>
          </div>

          {/* Business Profile */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.business_profile}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Official enterprise name, logo, direct phone number, and physical farm address. Used on invoices and printable documents.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <BusinessProfileForm initialData={bizData || { name: "Enterprise Farm" }} />
              </div>
            </div>
          </div>

          {/* Personal Profile */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.personal_profile}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your individual account details, job title, avatar photo, and direct phone number.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <ProfileForm initialData={profileData || {}} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TEAM & ROLES TAB ═════════════════════════════════════════ */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Role matrix + Invite section */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* Access Levels Guide */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Role-Based Access Control (RBAC)</h3>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  { role: "admin",   label: "Admin / Owner",   desc: "Full administrative, financial, system settings, deletion, and user management authority." },
                  { role: "manager", label: "Farm Manager",    desc: "Can record cattle, health logs, feed batches, inventory transactions, and sales." },
                  { role: "worker",  label: "Worker / Field",  desc: "Field staff restricted to daily task logging, weight entries, and feeding checks." },
                ].map(({ role, label, desc }) => (
                  <div key={role} className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 mt-0.5 ${ROLE_BADGE[role]}`}>
                      {label}
                    </span>
                    <p className="text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Invite Form */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Invite New Team Member</h3>
              </div>
              <InviteForm />
            </div>
          </div>

          {/* Current Workspace Owner */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workspace Primary Owner</h3>
              <span className="text-xs text-muted-foreground font-mono">1 Owner</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 text-xs shrink-0">
                  <AvatarImage src={profileData?.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName} ({email})</p>
                  <p className="text-xs text-muted-foreground">Full system administrator</p>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Members ({members.length})</h3>
              <Link href="/dashboard/settings/team" className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
                Full Team Page <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {members.length === 0 ? (
              <div className="p-8 text-center bg-muted/5">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No additional team members yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Use the invite form above to invite managers and staff.</p>
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
      )}

      {/* ══ SECURITY & ACCESS TAB ═══════════════════════════════════ */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Email & Account Details */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden divide-y divide-border/60">
            {/* Identity row */}
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Authentication Account</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Primary credential used to access the control center and authenticate server actions.
                </p>
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-sm font-semibold text-foreground font-mono">{email}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified Account
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
                  <p>User UID: <span className="font-mono text-foreground">{userId}</span></p>
                  <p>{t.settings.member_since} {memberSince}</p>
                </div>
              </div>
            </div>

            {/* Password update row */}
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.change_password}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Update your enterprise login password. Requires at least 8 characters with letters and numbers.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <PasswordForm />
              </div>
            </div>
          </div>

          {/* Security & Audit Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/settings/activity"
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-105 transition-transform">
                  <Activity className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Unified Audit Timeline</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Live activity log of cattle additions, sales, medical treatments, and ledger movements.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4 pt-3 border-t border-border/50">
                <span>View Activity Log</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            <Link
              href="/dashboard/finance/utilities"
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-3 group-hover:scale-105 transition-transform">
                  <Zap className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Utility Categories &amp; Expenses</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Add, rename or disable utilities (electricity, WiFi, gas, water, telephone) and record their bills.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4 pt-3 border-t border-border/50">
                <span>Manage utilities</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            <Link
              href="/dashboard/settings/trash"
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Soft-Deleted Trash Bin</h4>
                  {totalTrashCount > 0 && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold px-2 py-0.5">
                      {totalTrashCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Recover deleted costs, inventory batches, and weight logs or permanently purge them.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4 pt-3 border-t border-border/50">
                <span>Manage Trash Bin</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            <a
              href="/api/backup"
              download
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                  <Download className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Instant Full Backup</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Export complete enterprise datasets into formatted CSV tables for offline archiving and audit compliance.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-4 pt-3 border-t border-border/50">
                <span>Export Dataset (.CSV)</span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </a>
          </div>

          {/* Session Termination / Danger Zone */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Terminate Active Session
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Revoke this browser session and sign out of the control center.
                </p>
              </div>
              <form action={logout}>
                <Button type="submit" variant="destructive" size="sm" className="gap-1.5 shadow-sm">
                  <LogOut className="h-3.5 w-3.5" />
                  {t.settings.sign_out}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ FINANCE TAB ═════════════════════════════════════════════ */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Opening Cash Balance</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                ৳{(bizData?.opening_cash_balance ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Starting balance on balance sheet</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Default VAT / Tax</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {(bizData?.default_tax_rate ?? 0)}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Applied to sales &amp; expenses</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Unit Valuation</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                ৳{(bizData?.unit_price_bdt ?? 1000).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Per share equity baseline</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Current Mgmt Fee</p>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {currentFeeRate ? `${currentFeeRate.rate_percent}%` : "0%"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Founder share before partner split</p>
            </div>
          </div>

          {/* Opening Cash */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Opening Cash Balance</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Initial liquid capital available before accounting records began. Reflected in Cash &amp; Bank balance sheet ledger.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <OpeningCashForm initialValue={bizData?.opening_cash_balance ?? 0} />
              </div>
            </div>
          </div>

          {/* Tax / VAT Settings */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Default VAT / Tax Rate</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Standard tax percentage pre-populated for newly recorded invoices and livestock transactions.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <TaxForm initialRate={bizData?.default_tax_rate ?? 0} />
              </div>
            </div>
          </div>

          {/* Equity unit price */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Equity Unit Valuation</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Capital investment needed to purchase 1 equity unit. Partner ownership percentage equals owned units divided by total system units.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <UnitPriceForm initialPrice={bizData?.unit_price_bdt ?? 1000} />
              </div>
            </div>
          </div>

          {/* Fiscal year */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Fiscal Year Cycle</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Controls the starting calendar month for financial statements, tax reporting, and &quot;This Fiscal Year&quot; calculations.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <FiscalYearForm initialMonth={(bizData as { fiscal_year_start_month?: number } | null)?.fiscal_year_start_month ?? 7} />
              </div>
            </div>
          </div>

          {/* Management fee */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Management Fee Rates</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Founder management fee deducted from enterprise profit before dividend distributions. Historical rate changes are preserved with effective date ranges.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <ManagementFeeForm currentRate={currentFeeRate} history={feeHistory} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ OPERATIONS & HERD TAB ════════════════════════════════════ */}
      {activeTab === "operations" && (
        <div className="space-y-6">
          {/* Cattle Growth Rate */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Cattle Growth Benchmark</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Estimated daily live weight gain (ADG in kg/day). Used to project current cattle weight when scale weigh-in readings are not yet logged.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <DailyGainForm initialGain={bizData?.default_daily_gain_kg ?? 0.6} />
              </div>
            </div>
          </div>

          {/* Default Roughage Formulation */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Wheat className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Default Roughage Formulation</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sets the primary roughage type and baseline Dry Matter % (DM) for daily feed ration calculations across all active cattle profiles.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <DefaultRoughageForm initialType={(bizData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw"} />
              </div>
            </div>
          </div>

          {/* Auto Health & Vaccination Protocol */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Automated Health Protocol</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scheduled preventive health workflow automatically populated on every newly registered animal (deworming, FMD, Anthrax, BQ, and clinical checkups).
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <HealthProtocolCard />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PREFERENCES & SYSTEM TAB ═════════════════════════════════ */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Language Preference */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Language / ভাষা</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Switch between English and বাংলা. Changes apply immediately to navigation, tables, financial ledgers, and notifications.
                </p>
              </div>
              <div className="p-5 sm:p-6 flex items-center">
                <LanguageSwitcher />
              </div>
            </div>
          </div>

          {/* Appearance & Theme */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Paintbrush className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.appearance}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose your UI appearance: dark mode for low-light environments, clean light mode, or automatic system sync.
                </p>
              </div>
              <div className="p-5 sm:p-6 flex items-center">
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* Browser Push Notifications */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.notifications}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Receive instant Web Push alerts for critical feed shortages, overdue health events, and partner transaction confirmations.
                </p>
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{t.settings.notifications_info}</p>
                <PushNotificationButton />
              </div>
            </div>
          </div>

          {/* Cloud Backups & Archival Storage */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Cloud Backups &amp; Export</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automated weekly snapshot to cloud storage with 12-week retention. You can also generate an on-demand CSV data export anytime.
                </p>
              </div>
              <div className="p-5 sm:p-6 space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Automated Cron Schedule</span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5">
                      Every Monday 08:00 UTC
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exports complete cattle records, sales history, feed purchases, financial costs, and weight histories into structured CSV files saved directly to Supabase storage.
                  </p>
                </div>
                <div>
                  <a
                    href="/api/backup"
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    Download Instant Backup (.CSV)
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Trash Bin & Soft Deletes Card */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
              <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-foreground">{t.settings.trash_bin}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Recover deleted costs, feed inventory items, and weight logs within retention policy or purge them permanently.
                </p>
              </div>
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {totalTrashCount === 0 ? "Trash bin is empty" : `${totalTrashCount} soft-deleted record${totalTrashCount > 1 ? "s" : ""} pending`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Soft-deleted items can be restored without data loss.
                  </p>
                </div>
                <Link
                  href="/dashboard/settings/trash"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors shadow-xs self-start sm:self-auto"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Open Trash Bin
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
