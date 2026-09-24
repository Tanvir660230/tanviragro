import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";
import type { Locale } from "@/i18n/getDictionary";
import Link from "next/link";
import { loadHomeModel } from "@/lib/home/home-data";
import { HomeScreen } from "@/components/home/HomeScreen";

export const revalidate = 0; // Ensures fresh data for the dashboard

export default async function DashboardPage() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en") as Locale;
  const t = await getDictionary(locale);

  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">No Business Found</h2>
        <p className="text-muted-foreground">
          Your account is not linked to a farm yet. Ask the farm owner to invite you from Settings → Team.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all"
        >
          Back to login
        </Link>
      </div>
    );
  }

  // One model for the whole home screen, from the audited sources (see lib/home/home-model.ts)
  const model = await loadHomeModel(supabase, businessId);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(now));
  const dateLabel = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka",
  }).format(now);

  return <HomeScreen model={model} t={t.home} hour={hour} dateLabel={dateLabel} />;
}
