import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { Cattle, HealthEvent } from "@/types/database";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  FileText,
  ChevronRight,
  CalendarDays,
  Syringe,
  Stethoscope,
  HeartPulse,
  ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { todayDhaka } from "@/lib/dates";

import { getL } from "@/i18n/server-text";
export const metadata: Metadata = { title: "টিকার রিপোর্ট" };

// DLS Bangladesh standard vaccination schedule
const VACCINE_SCHEDULE = [
  { key: "fmd",    label: "FMD",     fullNameBn: "ক্ষুরা রোগ", fullName: "Foot & Mouth Disease",        intervalDays: 180 },
  { key: "hs",     label: "HS",      fullNameBn: "গলাফুলা", fullName: "Hemorrhagic Septicemia",      intervalDays: 365 },
  { key: "bq",     label: "BQ",      fullNameBn: "বাদলা", fullName: "Black Quarter",               intervalDays: 365 },
  { key: "anthrax",label: "Anthrax", fullNameBn: "তড়কা", fullName: "Anthrax",                     intervalDays: 365 },
] as const;

type VaccineKey = typeof VACCINE_SCHEDULE[number]["key"];

interface CattleCompliance {
  cattle: Pick<Cattle, "id" | "tag_id" | "breed" | "gender" | "status">;
  vaccines: Record<VaccineKey, { lastDate: string | null; status: "ok" | "due" | "overdue" | "never" }>;
  overallStatus: "compliant" | "partial" | "non-compliant";
}

function matchVaccineKey(title: string): VaccineKey | null {
  const t = title.toLowerCase();
  if (t.includes("fmd") || t.includes("foot") || t.includes("mouth")) return "fmd";
  if (/hs/.test(t) || t.includes("hemorrhagic") || t.includes("haemorrhagic") || t.includes("septicemia") || t.includes("septicaemia")) return "hs";
  if (/bq/.test(t) || t.includes("black quarter") || t.includes("blackquarter")) return "bq";
  if (t.includes("anthrax")) return "anthrax";
  return null;
}

function getStatus(lastDate: string | null, intervalDays: number): "ok" | "due" | "overdue" | "never" {
  if (!lastDate) return "never";
  const ms = new Date(lastDate).getTime();
  if (!Number.isFinite(ms)) return "never";
  const daysSince = (Date.now() - ms) / (1000 * 60 * 60 * 24);
  if (daysSince < intervalDays * 0.85) return "ok";
  if (daysSince < intervalDays) return "due";
  return "overdue";
}

export default async function CompliancePage() {
   const L = await getL();
   
  const [supabase, businessId] = await Promise.all([getServerClient(), getCachedBusinessId()]);

  const nowMs = new Date().getTime();
  const todayISO = todayDhaka();
  const in30Days = new Date(nowMs + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(nowMs - 7 * 86400000).toISOString().slice(0, 10);

  const [cattleRes, healthRes, upcomingRes, allCattleTagRes] = await Promise.all([
    businessId
      ? supabase
          .from("cattle")
          .select("id, tag_id, breed, gender, status")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("status", "active")
          .order("tag_id")
          .limit(1000)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase
          .from("health_events")
          .select("cattle_id, title, event_type, completed_at")
          .eq("business_id", businessId)
          .eq("event_type", "vaccine")
          .not("completed_at", "is", null)
          .is("deleted_at", null)
          .order("completed_at", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] }),
    // Upcoming + recently overdue events (last 7 days → next 30 days, not yet completed)
    businessId
      ? supabase
          .from("health_events")
          .select("id, cattle_id, title, event_type, scheduled_at, notes")
          .eq("business_id", businessId)
          .is("completed_at", null)
          .is("deleted_at", null)
          .gte("scheduled_at", sevenDaysAgo)
          .lte("scheduled_at", in30Days)
          .order("scheduled_at", { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] }),
    // Map all cattle ids → tag_id for upcoming events display
    businessId
      ? supabase
          .from("cattle")
          .select("id, tag_id")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .limit(1000)
      : Promise.resolve({ data: [] }),
  ]);

  type CattleRow = Pick<Cattle, "id" | "tag_id" | "breed" | "gender" | "status">;
  type HealthRow = Pick<HealthEvent, "cattle_id" | "title" | "event_type" | "completed_at">;
  type UpcomingRow = { id: string; cattle_id: string; title: string; event_type: string; scheduled_at: string; notes: string | null };

  const allCattle = (cattleRes.data ?? []) as CattleRow[];
  const allVaccines = (healthRes.data ?? []) as HealthRow[];
  const upcomingEvents = (upcomingRes.data ?? []) as UpcomingRow[];

  // Build cattle tag map from full cattle list
  const tagMap = new Map<string, string>();
  for (const c of (allCattleTagRes.data ?? []) as { id: string; tag_id: string }[]) {
    tagMap.set(c.id, c.tag_id);
  }

  // Group upcoming events by date
  const eventsByDate = new Map<string, UpcomingRow[]>();
  for (const ev of upcomingEvents) {
    const date = ev.scheduled_at.slice(0, 10);
    if (!eventsByDate.has(date)) eventsByDate.set(date, []);
    eventsByDate.get(date)!.push(ev);
  }
  const sortedDates = [...eventsByDate.keys()].sort();

  // Build vaccine history map: cattle_id → vaccineKey → latest completed_at
  const vaccineMap = new Map<string, Map<VaccineKey, string>>();
  for (const h of allVaccines) {
    const key = matchVaccineKey(h.title ?? "");
    if (!key || !h.completed_at) continue;
    if (!vaccineMap.has(h.cattle_id)) vaccineMap.set(h.cattle_id, new Map());
    const existing = vaccineMap.get(h.cattle_id)!;
    if (!existing.has(key) || existing.get(key)! < h.completed_at) {
      existing.set(key, h.completed_at);
    }
  }

  const complianceList: CattleCompliance[] = allCattle.map((c) => {
    const cVaccines = vaccineMap.get(c.id) ?? new Map<VaccineKey, string>();
    const vaccines = {} as CattleCompliance["vaccines"];
    let okCount = 0;
    for (const sched of VACCINE_SCHEDULE) {
      const lastDate = cVaccines.get(sched.key) ?? null;
      const status = getStatus(lastDate, sched.intervalDays);
      vaccines[sched.key] = { lastDate, status };
      if (status === "ok") okCount++;
    }
    const overallStatus: CattleCompliance["overallStatus"] =
      okCount === VACCINE_SCHEDULE.length ? "compliant" :
      okCount === 0 ? "non-compliant" : "partial";
    return { cattle: c, vaccines, overallStatus };
  });

  const totalCattle = complianceList.length;
  const compliant = complianceList.filter((c) => c.overallStatus === "compliant").length;
  const partial = complianceList.filter((c) => c.overallStatus === "partial").length;
  const nonCompliant = complianceList.filter((c) => c.overallStatus === "non-compliant").length;
  const complianceRate = totalCattle > 0 ? Math.round((compliant / totalCattle) * 100) : 0;

  const STATUS_STYLE = {
    ok:      { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "OK" },
    due:     { icon: Clock,        className: "text-amber-600 dark:text-amber-400",    label: "Due Soon" },
    overdue: { icon: AlertCircle,  className: "text-red-600 dark:text-red-400",         label: "Overdue" },
    never:   { icon: AlertCircle,  className: "text-red-500 dark:text-red-400",         label: "Never" },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={L("টিকার রিপোর্ট", "Vaccine report")}
        subtitle={L("প্রাণিসম্পদ অধিদপ্তরের (DLS) টিকা সূচি অনুযায়ী প্রতিটি সক্রিয় গরুর অবস্থা", "Each active animal against the DLS Bangladesh vaccine schedule")}
        icon={ClipboardList}
        actions={
          <Link
            href="/dashboard/compliance/report"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {L("প্রিন্ট রিপোর্ট", "Print Report")}
          </Link>
        }
      />

      {/* Upcoming Health Schedule */}
      {sortedDates.length > 0 && (
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{L("সামনের স্বাস্থ্য কাজ", "Upcoming Health Schedule")}</h2>
            <span className="ml-auto text-xs text-muted-foreground">{L("আগামী ৩০ দিন", "Next 30 days")}</span>
          </div>
          <div className="divide-y divide-border">
            {sortedDates.map((date) => {
              const events = eventsByDate.get(date)!;
              const isOverdue = date < todayISO;
              const isToday = date === todayISO;
              const dateLabel = isToday ? L("আজ", "Today") : new Date(date + "T00:00:00").toLocaleDateString(L("bn-BD-u-nu-latn", "en-US"), {
                weekday: "short", day: "numeric", month: "short",
              });
              return (
                <div key={date} className={cn("flex gap-4 px-5 py-3", isOverdue && "bg-red-50/40 dark:bg-red-950/10")}>
                  <div className={cn(
                    "shrink-0 w-20 sm:w-24 text-xs font-semibold pt-0.5",
                    isOverdue ? "text-red-600 dark:text-red-400" :
                    isToday ? "text-amber-600 dark:text-amber-400" :
                    "text-muted-foreground"
                  )}>
                    {isOverdue && <span className="block text-xs uppercase tracking-wider mb-0.5">{L("সময় পেরিয়েছে", "Overdue")}</span>}
                    {dateLabel}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {events.map((ev) => {
                      const tag = tagMap.get(ev.cattle_id) ?? ev.cattle_id.slice(0, 6);
                      const Icon = ev.event_type === "vaccine" ? Syringe :
                                   ev.event_type === "checkup" ? Stethoscope : HeartPulse;
                      return (
                        <div
                          key={ev.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border",
                            isOverdue
                              ? "bg-red-100 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                              : "bg-muted/60 border-border text-foreground"
                          )}
                          title={ev.notes ?? ev.title}
                        >
                          <Icon className="h-3 w-3 shrink-0 opacity-70" />
                          <span className="font-bold">#{tag}</span>
                          <span className="opacity-80">{ev.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Compliance Rate — with visual progress bar */}
        <div className="rounded-xl bg-card border border-border/60 shadow-card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{L("টিকা সম্পূর্ণ", "Compliance Rate")}</p>
          <p className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            complianceRate >= 70 ? "text-emerald-600 dark:text-emerald-400" :
            complianceRate >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
          )}>{complianceRate}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                complianceRate >= 70 ? "bg-emerald-500" :
                complianceRate >= 40 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${complianceRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{L(`${totalCattle}টির মধ্যে ${compliant}টির সব টিকা হালনাগাদ`, `${compliant} of ${totalCattle} fully up to date`)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:ring-emerald-800 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{L("সম্পূর্ণ", "Compliant")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{compliant}</p>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{L("৪টি টিকাই হালনাগাদ", "All 4 vaccines current")}</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:ring-amber-800 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">{L("আংশিক", "Partial")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{partial}</p>
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70">{L("কিছু টিকা বাকি", "Some vaccines missing")}</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:ring-red-800 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-400">{L("টিকা নেই", "Non-Compliant")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{nonCompliant}</p>
          <p className="text-xs text-red-600/70 dark:text-red-400/70">{L("কোনো টিকার রেকর্ড নেই", "No recorded vaccines")}</p>
        </div>
      </div>

      {/* Vaccine schedule legend */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{L("DLS-এর প্রয়োজনীয় টিকা", "DLS Required Vaccines")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
          {VACCINE_SCHEDULE.map((s) => (
            <div key={s.key} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="font-semibold">{s.label}</p>
              <p className="text-xs text-muted-foreground">{L(s.fullNameBn, s.fullName)}</p>
              <p className="text-xs text-muted-foreground">{s.intervalDays === 180 ? L("প্রতি ৬ মাসে", "Every 6 months") : L("প্রতি ১২ মাসে", "Every 12 months")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-cattle compliance table */}
      {totalCattle === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted/50">
            <Shield className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{L("কোনো সক্রিয় গরু নেই", "No active cattle")}</p>
            <p className="text-sm text-muted-foreground max-w-xs">{L("গরু যোগ করে টিকা লিখলে এখানে অবস্থা দেখাবে।", "Add cattle and log vaccination events to track compliance.")}</p>
          </div>
          <Link href="/dashboard/cattle" className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-2")}>
            {L("গরুর তালিকা →", "Go to Cattle →")}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 px-4 text-left font-semibold">{L("ট্যাগ", "Tag")}</th>
                {VACCINE_SCHEDULE.map((s) => (
                  <th key={s.key} className="py-3 px-4 text-center font-semibold">{s.label}</th>
                ))}
                <th className="py-3 px-4 text-center font-semibold">{L("অবস্থা", "Status")}</th>
                <th className="py-3 px-4 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {complianceList.map(({ cattle, vaccines, overallStatus }) => (
                <tr key={cattle.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/cattle/${cattle.id}`} className="font-medium hover:underline">
                      #{cattle.tag_id}
                    </Link>
                    {cattle.breed && <p className="text-xs text-muted-foreground">{cattle.breed}</p>}
                  </td>
                  {VACCINE_SCHEDULE.map((s) => {
                    const v = vaccines[s.key];
                    const style = STATUS_STYLE[v.status];
                    const Icon = style.icon;
                    const needsAction = v.status === "overdue" || v.status === "never" || v.status === "due";
                    // Link directly to cattle health tab for overdue/never — title hint tells user which vaccine to log
                    const cellContent = (
                      <span
                        title={
                          v.lastDate
                            ? L(`শেষ টিকা: ${v.lastDate.slice(0, 10)}`, `Last: ${v.lastDate.slice(0, 10)}`)
                            : L(`কখনো দেওয়া হয়নি — এই গরুর "${s.label}" টিকা লিখুন`, `Never vaccinated — record "${s.label}" for this animal`)
                        }
                      >
                        <Icon className={`h-4 w-4 mx-auto ${style.className}`} />
                        {v.lastDate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(v.lastDate).toLocaleDateString(L("bn-BD-u-nu-latn", "en-US"), { month: "short", year: "2-digit" })}
                          </p>
                        )}
                        {needsAction && !v.lastDate && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 font-medium">{L("লিখুন", "Log")}</p>
                        )}
                      </span>
                    );
                    return (
                      <td key={s.key} className="py-3 px-4 text-center">
                        {needsAction ? (
                          <Link
                            href={`/dashboard/cattle/${cattle.id}?tab=health`}
                            className="block hover:opacity-75 transition-opacity"
                            title={L(`#${cattle.tag_id}-এর ${s.label} টিকা লিখুন`, `Record ${s.label} for #${cattle.tag_id}`)}
                          >
                            {cellContent}
                          </Link>
                        ) : cellContent}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      overallStatus === "compliant"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : overallStatus === "partial"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                    }`}>
                      {overallStatus === "compliant" ? L("সম্পূর্ণ", "Complete") : overallStatus === "partial" ? L("আংশিক", "Partial") : L("টিকা নেই", "None")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/dashboard/cattle/${cattle.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">{L("টিকা লিখতে:", "To record a vaccine:")}</p>
        <p>{L("\"টিকা ও কাজ\" পাতা থেকে বা গরুর পাতার স্বাস্থ্য অংশে টিকা লিখুন। শিরোনামে নিচের যেকোনো নাম থাকলে এখানে গোনা হবে:", "Record it on the Vaccines & tasks page or the animal's health section. A title containing one of these names is counted here:")}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {(["FMD", "HS", "BQ", "Anthrax"] as const).map((v) => (
            <code key={v} className="rounded bg-background border border-border px-1.5 py-0.5 text-xs font-mono text-foreground">{v}</code>
          ))}
        </div>
        <p className="mt-1">{L("টেবিলে লাল ঘরে চাপলে সেই গরুর পাতায় যাবেন।", "Tap a red cell in the table to open that animal's page.")}</p>
      </div>
    </div>
  );
}
