import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/login/actions";
import { BusinessProfileForm } from "@/components/settings/BusinessProfileForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { HealthProtocolCard } from "@/components/settings/HealthProtocolCard";
import { OpeningCashForm } from "@/components/settings/OpeningCashForm";
import { ManagementFeeForm } from "@/components/settings/ManagementFeeForm";
import type { ManagementFeeRate } from "@/types/database";
import { DailyGainForm } from "@/components/settings/DailyGainForm";
import { FiscalYearForm } from "@/components/settings/FiscalYearForm";
import { DefaultRoughageForm } from "@/components/settings/DefaultRoughageForm";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { PushNotificationButton } from "@/components/shared/PushNotificationButton";
import { Button } from "@/components/ui/button";
import {
  LogOut, Building2, User, ShieldCheck, Wallet, Bell, Paintbrush, Heart, Layers,
  Calendar, Wheat, Download, Languages, Settings2, HandCoins,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { getL } from "@/i18n/server-text";

export const metadata: Metadata = { title: "সেটিংস" };

/** One setting: what it is on the left, the form on the right. */
function Row({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[260px_1fr] md:divide-x divide-border/60">
      <div className="p-5 sm:p-6 border-b md:border-b-0 border-border/60 bg-muted/10">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden divide-y divide-border/60">{children}</div>
    </section>
  );
}

/**
 * Settings: one page. The section tabs above already lead to Team, Activity, Trash and
 * Notifications, so this page has no tab row of its own.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const L = await getL();

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const [{ data: bizData }, { data: profileData }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", userId).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  const { data: feeRates } = bizData?.id
    ? await supabase.from("management_fee_rates").select("*").eq("business_id", bizData.id).is("deleted_at", null).order("effective_from", { ascending: false })
    : { data: null };
  const feeHistory = (feeRates ?? []) as ManagementFeeRate[];
  const currentFeeRate = feeHistory[0] ?? null;
  const email = user?.email ?? "";

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <PageHeader
        title={L("সেটিংস", "Settings")}
        subtitle={L("খামারের তথ্য, হিসাবের শুরু, গরু ও খাবারের নিয়ম, পছন্দ", "Farm details, accounts setup, herd rules and preferences")}
        icon={Settings2}
        className="mb-0"
      />

      <Group title={L("খামার ও আমি", "Farm & me")}>
        <Row icon={Building2} title={L("খামারের তথ্য", "Farm details")} desc={L("খামারের নাম, লোগো, ফোন ও ঠিকানা। রিপোর্ট ও প্রিন্টে দেখায়।", "Farm name, logo, phone and address. Shown on reports and printouts.")}>
          <BusinessProfileForm initialData={bizData || { name: "" }} />
        </Row>
        <Row icon={User} title={L("আমার প্রোফাইল", "My profile")} desc={L("আপনার নাম, পদ, ছবি ও ফোন।", "Your name, position, photo and phone.")}>
          <ProfileForm initialData={profileData || {}} />
        </Row>
      </Group>

      <Group title={L("হিসাব", "Accounts")}>
        <Row icon={Wallet} title={L("শুরুর নগদ টাকা", "Opening cash")} desc={L("হিসাব শুরুর আগে হাতে বা ব্যাংকে যে টাকা ছিল। নগদ ও ব্যালেন্স শিটে যোগ হয়।", "Cash on hand or in the bank before records began. Counted in cash and the balance sheet.")}>
          <OpeningCashForm initialValue={bizData?.opening_cash_balance ?? 0} />
        </Row>
        <Row icon={Calendar} title={L("অর্থবছর শুরুর মাস", "Fiscal year start")} desc={L("বছরের হিসাব কোন মাস থেকে শুরু হবে।", "The month the financial year starts.")}>
          <FiscalYearForm initialMonth={(bizData as { fiscal_year_start_month?: number } | null)?.fiscal_year_start_month ?? 7} />
        </Row>
        <Row icon={HandCoins} title={L("ম্যানেজমেন্ট ফি", "Management fee")} desc={L("অংশীদারদের ভাগের আগে লাভ থেকে যে % কাটা হয়। আগের হার তারিখসহ থাকে।", "Share of profit taken before partners split it. Past rates keep their dates.")}>
          <ManagementFeeForm currentRate={currentFeeRate} history={feeHistory} />
        </Row>
      </Group>

      <Group title={L("গরু ও খাবার", "Herd & feed")}>
        <Row icon={Layers} title={L("দৈনিক ওজন বৃদ্ধি (আনুমানিক)", "Daily weight gain (estimate)")} desc={L("ওজন না মাপা পর্যন্ত গরুর বর্তমান ওজন আন্দাজ করতে ব্যবহার হয় (কেজি/দিন)।", "Used to estimate current weight until an animal is weighed (kg/day).")}>
          <DailyGainForm initialGain={bizData?.default_daily_gain_kg ?? 0.6} />
        </Row>
        <Row icon={Wheat} title={L("প্রধান খড়/ঘাস", "Main roughage")} desc={L("দৈনিক খাবারের হিসাবে কোন খড়/ঘাস ধরা হবে।", "The roughage used in daily ration calculations.")}>
          <DefaultRoughageForm initialType={(bizData as { default_roughage_type?: string } | null)?.default_roughage_type ?? "straw"} />
        </Row>
        <Row icon={Heart} title={L("স্বয়ংক্রিয় টিকা ও স্বাস্থ্য সূচি", "Automatic health schedule")} desc={L("নতুন গরু যোগ করলে এই টিকা, কৃমিনাশক ও চেকআপগুলো নিজে থেকে তালিকায় আসে।", "Vaccines, deworming and check-ups added to every new animal.")}>
          <HealthProtocolCard />
        </Row>
      </Group>

      <Group title={L("পছন্দ", "Preferences")}>
        <Row icon={Languages} title={L("ভাষা", "Language")} desc={L("বাংলা বা English — সাথে সাথে পুরো সাইটে বদলায়।", "বাংলা or English — changes the whole site at once.")}>
          <LanguageSwitcher />
        </Row>
        <Row icon={Paintbrush} title={L("রং (ডার্ক/লাইট)", "Appearance")} desc={L("ডার্ক, লাইট বা ডিভাইসের সেটিং অনুযায়ী।", "Dark, light or follow the device.")}>
          <ThemeToggle />
        </Row>
        <Row icon={Bell} title={L("নোটিফিকেশন", "Notifications")} desc={L("খাবার কমে যাওয়া, টিকার সময় পেরোনো ইত্যাদি সতর্কতা এই ডিভাইসে পান।", "Get alerts for low feed, overdue vaccines and more on this device.")}>
          <PushNotificationButton />
        </Row>
      </Group>

      <Group title={L("নিরাপত্তা ও ব্যাকআপ", "Security & backup")}>
        <Row icon={ShieldCheck} title={L("পাসওয়ার্ড বদলান", "Change password")} desc={L(`লগইন: ${email}। কমপক্ষে ৮ অক্ষর, অক্ষর ও সংখ্যা দুটোই।`, `Signed in as ${email}. At least 8 characters with letters and numbers.`)}>
          <PasswordForm />
        </Row>
        <Row icon={Download} title={L("ব্যাকআপ", "Backup")} desc={L("প্রতি সোমবার নিজে থেকে ব্যাকআপ হয়। চাইলে এখনই সব তথ্য CSV ফাইলে নামাতে পারেন।", "A backup runs every Monday. You can also download all data as CSV now.")}>
          <a href="/api/backup" download className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs">
            <Download className="h-4 w-4" />
            {L("এখনই ব্যাকআপ নামান (.CSV)", "Download backup now (.CSV)")}
          </a>
        </Row>
        <Row icon={LogOut} title={L("লগ আউট", "Sign out")} desc={L("এই ব্রাউজার থেকে বের হয়ে যান।", "Sign out of this browser.")}>
          <form action={logout}>
            <Button type="submit" variant="destructive" size="sm" className="gap-1.5 shadow-sm">
              <LogOut className="h-3.5 w-3.5" />
              {L("লগ আউট", "Sign out")}
            </Button>
          </form>
        </Row>
      </Group>
    </div>
  );
}
