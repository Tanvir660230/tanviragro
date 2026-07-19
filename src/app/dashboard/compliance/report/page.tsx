import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { buttonVariants } from "@/components/ui/button";
import { PrintButton } from "@/components/compliance/PrintButton";
import type { Cattle, HealthEvent, Business } from "@/types/database";
import { ArrowLeft, Shield } from "lucide-react";
import { AutoPrint } from "@/components/ui/auto-print";

export const metadata: Metadata = { title: "Health & Compliance Report" };

const VACCINE_SCHEDULE = [
  { key: "fmd",     label: "FMD",     fullName: "Foot & Mouth Disease (FMD)",     intervalDays: 180, regulation: "Livestock Vaccination Programme, DLS Bangladesh" },
  { key: "hs",      label: "HS",      fullName: "Hemorrhagic Septicemia (HS)",    intervalDays: 365, regulation: "DLS SRO No. 183-L/2010" },
  { key: "bq",      label: "BQ",      fullName: "Black Quarter (BQ)",             intervalDays: 365, regulation: "DLS SRO No. 183-L/2010" },
  { key: "anthrax", label: "Anthrax", fullName: "Anthrax",                        intervalDays: 365, regulation: "Anthrax Prevention Act, DLS" },
] as const;

type VaccineKey = typeof VACCINE_SCHEDULE[number]["key"];

function matchVaccineKey(title: string): VaccineKey | null {
  const t = title.toLowerCase();
  if (t.includes("fmd") || t.includes("foot") || t.includes("mouth")) return "fmd";
  if (t.includes("hs") || t.includes("hemorrhagic") || t.includes("haemorrhagic") || t.includes("septicemia")) return "hs";
  if (t.includes("bq") || t.includes("black quarter")) return "bq";
  if (t.includes("anthrax")) return "anthrax";
  return null;
}

function getStatus(lastDate: string | null, intervalDays: number) {
  if (!lastDate) return "Never Vaccinated";
  const daysSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < intervalDays) return "Current";
  return "Overdue";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ComplianceReportPage() {
   
  const [supabase, businessId] = await Promise.all([getServerClient(), getCachedBusinessId()]);
  const bizData = businessId
    ? (await supabase.from("businesses").select("name").eq("id", businessId).maybeSingle()).data
    : null;

  const [cattleRes, healthRes, allHealthRes] = await Promise.all([
    businessId
      ? supabase.from("cattle").select("id, tag_id, breed, gender, dob, purchase_date, status").eq("business_id", businessId).eq("status", "active").order("tag_id").limit(1000)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("health_events").select("cattle_id, title, event_type, completed_at, scheduled_at, notes").eq("business_id", businessId).eq("event_type", "vaccine").not("completed_at", "is", null).is("deleted_at", null).order("completed_at", { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
    businessId
      ? supabase.from("health_events").select("cattle_id, title, event_type, scheduled_at, completed_at, notes").eq("business_id", businessId).is("deleted_at", null).order("scheduled_at", { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
  ]);

  type CattleRow = Pick<Cattle, "id" | "tag_id" | "breed" | "gender" | "dob" | "purchase_date" | "status">;
  type HealthRow = Pick<HealthEvent, "cattle_id" | "title" | "event_type" | "completed_at" | "scheduled_at" | "notes">;

  const biz = (bizData as Pick<Business, "name"> | null);
  const allCattle = (cattleRes.data ?? []) as CattleRow[];
  const vaccineEvents = (healthRes.data ?? []) as HealthRow[];
  const allHealthEvents = (allHealthRes.data ?? []) as HealthRow[];

  const reportDate = new Date().toLocaleDateString("en-US", { dateStyle: "full" });
  const reportNo = `TAC-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  // Build vaccine history
  const vaccineMap = new Map<string, Map<VaccineKey, string>>();
  for (const h of vaccineEvents) {
    const key = matchVaccineKey(h.title ?? "");
    if (!key || !h.completed_at) continue;
    if (!vaccineMap.has(h.cattle_id)) vaccineMap.set(h.cattle_id, new Map());
    const m = vaccineMap.get(h.cattle_id)!;
    if (!m.has(key) || m.get(key)! < h.completed_at) m.set(key, h.completed_at);
  }

  const totalCattle = allCattle.length;
  const compliantCattle = allCattle.filter((c) => {
    const m = vaccineMap.get(c.id) ?? new Map();
    return VACCINE_SCHEDULE.every((s) => {
      const last = m.get(s.key) ?? null;
      const status = getStatus(last, s.intervalDays);
      return status === "Current";
    });
  }).length;

  return (
    <>
      <AutoPrint />
      {/* Print controls  hidden on print */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <Link href="/dashboard/compliance" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
        <PrintButton />
      </div>

      {/*  PRINTABLE REPORT  */}
      <div className="bg-white text-black max-w-4xl mx-auto print:mx-0 print:max-w-full font-sans text-[13px] leading-relaxed">

        {/* Header */}
        <div className="border-2 border-black p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-6 w-6 text-black print:text-black" />
                <span className="font-bold text-lg uppercase tracking-wide">Health &amp; Compliance Report</span>
              </div>
              <p className="text-sm font-semibold">{biz?.name ?? "Chowdhury Agro"}</p>
              <p className="text-xs">Department of Livestock Services (DLS) Bangladesh Compliance</p>
            </div>
            <div className="text-right text-xs border border-black p-3">
              <p><strong>Report No:</strong> {reportNo}</p>
              <p><strong>Date:</strong> {reportDate}</p>
              <p><strong>Active Herd:</strong> {totalCattle} cattle</p>
              <p><strong>Status:</strong> {compliantCattle}/{totalCattle} Compliant</p>
            </div>
          </div>
        </div>

        {/* DLS Vaccine Schedule Reference */}
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">Section 1 — DLS Vaccination Schedule Reference</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="border border-black px-2 py-1 text-left font-bold">Vaccine</th>
                <th className="border border-black px-2 py-1 text-left font-bold">Full Name</th>
                <th className="border border-black px-2 py-1 text-left font-bold">Interval</th>
                <th className="border border-black px-2 py-1 text-left font-bold">Regulatory Basis</th>
              </tr>
            </thead>
            <tbody>
              {VACCINE_SCHEDULE.map((s) => (
                <tr key={s.key}>
                  <td className="border border-black px-2 py-1 font-semibold">{s.label}</td>
                  <td className="border border-black px-2 py-1">{s.fullName}</td>
                  <td className="border border-black px-2 py-1">{s.intervalDays === 180 ? "Every 6 months" : "Annually"}</td>
                  <td className="border border-black px-2 py-1">{s.regulation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Herd Vaccination Status */}
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">Section 2 — Herd Vaccination Status</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="border border-black px-2 py-1 text-left font-bold">Tag ID</th>
                <th className="border border-black px-2 py-1 text-left font-bold">Breed</th>
                <th className="border border-black px-2 py-1 text-left font-bold">Gender</th>
                <th className="border border-black px-2 py-1 text-center font-bold">FMD</th>
                <th className="border border-black px-2 py-1 text-center font-bold">HS</th>
                <th className="border border-black px-2 py-1 text-center font-bold">BQ</th>
                <th className="border border-black px-2 py-1 text-center font-bold">Anthrax</th>
                <th className="border border-black px-2 py-1 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {allCattle.map((c) => {
                const m = vaccineMap.get(c.id) ?? new Map();
                let isCompliant = true;
                const vaccineStatuses = VACCINE_SCHEDULE.map((s) => {
                  const last = m.get(s.key) ?? null;
                  const status = getStatus(last, s.intervalDays);
                  if (status !== "Current") isCompliant = false;
                  return { key: s.key, last, status };
                });
                return (
                  <tr key={c.id}>
                    <td className="border border-black px-2 py-1 font-semibold">{c.tag_id}</td>
                    <td className="border border-black px-2 py-1">{c.breed ?? "—"}</td>
                    <td className="border border-black px-2 py-1 capitalize">{c.gender}</td>
                    {vaccineStatuses.map((v) => (
                      <td key={v.key} className="border border-black px-2 py-1 text-center">
                        {v.last ? (
                          <>
                            <div className={`font-semibold text-xs ${v.status === "Current" ? "text-black" : "text-black font-bold"}`}>
                              {v.status === "Current" ? "✓" : "✗"}
                            </div>
                            <div className="text-xs">{fmtDate(v.last)}</div>
                          </>
                        ) : (
                          <span className="font-bold text-xs">— None</span>
                        )}
                      </td>
                    ))}
                    <td className="border border-black px-2 py-1 text-center font-bold text-xs">
                      {isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Full health event log */}
        <div className="mb-4">
          <h2 className="font-bold text-sm uppercase border-b border-black pb-1 mb-2">Section 3 — Complete Health Event Log</h2>
          {allHealthEvents.length === 0 ? (
            <p className="text-xs italic">No health events recorded.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-black px-2 py-1 text-left font-bold">Cattle</th>
                  <th className="border border-black px-2 py-1 text-left font-bold">Event</th>
                  <th className="border border-black px-2 py-1 text-left font-bold">Type</th>
                  <th className="border border-black px-2 py-1 text-left font-bold">Scheduled</th>
                  <th className="border border-black px-2 py-1 text-left font-bold">Completed</th>
                  <th className="border border-black px-2 py-1 text-left font-bold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {allHealthEvents.map((h, i) => {
                  const cattle = allCattle.find((c) => c.id === h.cattle_id);
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                      <td className="border border-black px-2 py-1 font-semibold">{cattle?.tag_id ?? h.cattle_id.slice(0, 6)}</td>
                      <td className="border border-black px-2 py-1">{h.title}</td>
                      <td className="border border-black px-2 py-1 capitalize">{h.event_type}</td>
                      <td className="border border-black px-2 py-1">{fmtDate(h.scheduled_at)}</td>
                      <td className="border border-black px-2 py-1">{fmtDate(h.completed_at)}</td>
                      <td className="border border-black px-2 py-1">{h.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Certification */}
        <div className="border-2 border-black p-4 mt-6">
          <h2 className="font-bold text-sm uppercase mb-3">Declaration &amp; Certification</h2>
          <p className="text-xs mb-4">
            I hereby certify that the above health and vaccination records for the livestock under the care of{" "}
            <strong>{biz?.name ?? "Chowdhury Agro"}</strong> are accurate and maintained in accordance with the
            Department of Livestock Services (DLS), Bangladesh guidelines and applicable regulations.
          </p>
          <div className="grid grid-cols-2 gap-8 mt-6">
            <div>
              <div className="border-b border-black mb-1 h-8" />
              <p className="text-xs font-semibold">Farm Owner / Manager Signature</p>
              <p className="text-xs text-muted-foreground">Date: _______________</p>
            </div>
            <div>
              <div className="border-b border-black mb-1 h-8" />
              <p className="text-xs font-semibold">Veterinary Officer Signature</p>
              <p className="text-xs text-muted-foreground">Date: _______________</p>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            <p>Generated by {biz?.name ?? "Chowdhury Agro"} ERP · Report No: {reportNo} · {reportDate}</p>
            <p>Department of Livestock Services, Bangladesh — Livestock Vaccination and Health Management Programme</p>
          </div>
        </div>
      </div>
    </>
  );
}
