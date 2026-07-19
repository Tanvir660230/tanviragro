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
import type { ManagementFeeRate } from "@/types/database";
import { UnitPriceForm } from "@/components/settings/UnitPriceForm";
import { DailyGainForm } from "@/components/settings/DailyGainForm";
import { FiscalYearForm } from "@/components/settings/FiscalYearForm";
import { DefaultRoughageForm } from "@/components/settings/DefaultRoughageForm";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { PushNotificationButton } from "@/components/shared/PushNotificationButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut, Trash2, Users, Building2, User, ShieldCheck,
  Wallet, Bell, Paintbrush, Heart, BadgeCheck, ChevronRight, Layers,
  Calendar, Wheat, Download, Languages, Settings2,
} from "lucide-react";
import { cookies } from "next/headers";
import { getDictionary } from "@/i18n/getDictionary";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Settings" };

const TAB_KEYS = ["profile", "security", "finance", "preferences"] as const;
type Tab = typeof TAB_KEYS[number];

function getInitials(name?: string | null, email?: string) {
  if (name) {
    return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }
  return (email ?? "U")[0].toUpperCase();
}

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

  // Only fetch fee rates when on Finance tab — skips one serial DB round-trip on other tabs
  const { data: feeRates } = (activeTab === "finance" && bizData?.id)
    ? await supabase
        .from("management_fee_rates")
        .select("*")
        .eq("business_id", bizData.id)
        .is("deleted_at", null)
        .order("effective_from", { ascending: false })
    : { data: null };
  const feeHistory = (feeRates ?? []) as ManagementFeeRate[];
  const currentFeeRate = feeHistory[0] ?? null;

  const displayName = profileData?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email ?? "";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";
  const initials = getInitials(profileData?.full_name, email);
  const businessName = bizData?.name ?? "Chowdhury Agro";

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        icon={Settings2}
        actions={
          <div className="hidden sm:flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-card">
            <Avatar size="default">
              <AvatarImage src={profileData?.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{businessName}</p>
            </div>
          </div>
        }
      />

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto scrollbar-none">
        {([
          { key: "profile",     label: t.settings.tab_profile,     icon: User },
          { key: "security",    label: t.settings.tab_security,    icon: ShieldCheck },
          { key: "finance",     label: t.settings.tab_finance,     icon: Wallet },
          { key: "preferences", label: t.settings.tab_preferences, icon: Paintbrush },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/dashboard/settings?tab=${key}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* ══ PROFILE tab ══════════════════════════════════════════════ */}
      {activeTab === "profile" && (
        <div className="space-y-4">

          {/* Identity banner */}
          <div className="flex items-center gap-5 rounded-xl border border-border/60 bg-card px-4 py-4 sm:px-6 sm:py-5 shadow-card">
            <Avatar className="size-14 text-lg shrink-0">
              <AvatarImage src={profileData?.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {businessName}
                </span>
                <span className="text-xs text-muted-foreground/50">·</span>
                <span className="text-xs text-muted-foreground">Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Business profile */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t.settings.business_profile}</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.settings.business_desc}</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <BusinessProfileForm initialData={bizData || { name: "Chowdhury Agro" }} />
              </div>
            </div>
          </div>

          {/* Personal profile */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t.settings.personal_profile}</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.settings.personal_desc}</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <ProfileForm initialData={profileData || {}} />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══ SECURITY tab ═════════════════════════════════════════════ */}
      {activeTab === "security" && (
        <div className="space-y-4">

          {/* Email + password */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden divide-y divide-border/40">
            {/* Email row */}
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Email Address</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Your login email. Cannot be changed here.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{email}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.settings.member_since} {memberSince}</p>
              </div>
            </div>
            {/* Password row */}
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t.settings.change_password}</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Use a strong password of at least 8 characters.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <PasswordForm />
              </div>
            </div>
          </div>

          {/* Team & Data */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden divide-y divide-border/40">
            <Link
              href="/dashboard/settings/team"
              className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t.settings.team_roles}</p>
                  <p className="text-xs text-muted-foreground">Invite teammates and manage access</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </Link>
            <Link
              href="/dashboard/settings/trash"
              className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2">
                  <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold">{t.settings.trash_bin} / Deleted</h4>
                  <p className="text-xs text-muted-foreground">Recover or permanently delete deleted records</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </Link>
            <a
              href="/api/backup"
              download
              className="flex items-center justify-between px-6 py-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold">Download Full Backup</h4>
                  <p className="text-xs text-muted-foreground">Export all farm data as JSON — cattle, costs, sales, inventory</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </a>
          </div>

          {/* Sign out */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-destructive/20">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-destructive/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <LogOut className="h-4 w-4 text-destructive/70" />
                  <h2 className="text-sm font-semibold text-destructive/80">Danger Zone</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Log out of your current session on this browser.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5 flex items-center">
                <form action={logout}>
                  <Button type="submit" variant="destructive" size="sm">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    {t.settings.sign_out}
                  </Button>
                </form>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══ FINANCE tab ══════════════════════════════════════════════ */}
      {activeTab === "finance" && (
        <div className="space-y-4">

          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Opening Balance</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                ৳{(bizData?.opening_cash_balance ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Default Tax Rate</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {(bizData?.default_tax_rate ?? 0)}%
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Unit Price</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                ৳{(bizData?.unit_price_bdt ?? 1000).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Opening cash */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Opening Balance</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Cash on hand before you started using this system. Shown as Cash &amp; Bank on the Balance Sheet.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <OpeningCashForm initialValue={bizData?.opening_cash_balance ?? 0} />
              </div>
            </div>
          </div>

          {/* Tax rate */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Default Tax Rate</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Applied to sales by default. Can be overridden per transaction.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <TaxForm initialRate={bizData?.default_tax_rate ?? 0} />
              </div>
            </div>
          </div>

          {/* Equity unit price */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Equity Unit Price</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">৳X per unit. Share % = own units ÷ total units. Labor partners earn units monthly at this rate.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <UnitPriceForm initialPrice={bizData?.unit_price_bdt ?? 1000} />
              </div>
            </div>
          </div>

          {/* Cattle growth rate */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Cattle Growth Rate</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Default daily weight gain (kg/day). Used when no weigh-in is recorded. Typical range: 0.5–1.0 kg/day.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <DailyGainForm initialGain={bizData?.default_daily_gain_kg ?? 0.6} />
              </div>
            </div>
          </div>

          {/* Fiscal year */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Fiscal Year</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Which month your financial year starts. Controls the &quot;This Year&quot; date preset in Finance and Accounting reports.
                </p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <FiscalYearForm initialMonth={(bizData as { fiscal_year_start_month?: number } | null)?.fiscal_year_start_month ?? 7} />
              </div>
            </div>
          </div>

          {/* Default roughage */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wheat className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Default Roughage</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The roughage your farm uses. Sets the Dry Matter % for daily feed requirement calculations on all cattle. Can be overridden per animal.
                </p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <DefaultRoughageForm initialType={(bizData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw"} />
              </div>
            </div>
          </div>

          {/* Management fee */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Management Fee</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Founder fee deducted from total profit before splitting with partners. Changes tracked with effective dates.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <ManagementFeeForm currentRate={currentFeeRate} history={feeHistory} />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══ PREFERENCES tab ══════════════════════════════════════════ */}
      {activeTab === "preferences" && (
        <div className="space-y-4">

          {/* Language */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Language / ভাষা</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Switch between English and বাংলা. Affects all labels, dates, and messages.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5 flex items-center">
                <LanguageSwitcher />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Paintbrush className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t.settings.appearance}</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Light, dark, or match your system preference.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5 flex items-center">
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t.settings.notifications}</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.settings.notifications_desc}</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{t.settings.notifications_info}</p>
                <PushNotificationButton />
              </div>
            </div>
          </div>

          {/* Health Protocol */}
          <div className="rounded-xl border border-border/60 bg-card shadow-card overflow-hidden">
            <div className="md:grid md:grid-cols-[240px_1fr] md:divide-x divide-border/40">
              <div className="px-4 py-4 sm:px-6 sm:py-5 border-b md:border-b-0 border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Auto Health Protocol</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Auto-schedule health events when cattle is added to the system.</p>
              </div>
              <div className="px-4 py-4 sm:px-6 sm:py-5">
                <HealthProtocolCard />
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
