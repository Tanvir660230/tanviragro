"use client";

import { useMemo, useState, useTransition } from "react";
import { Wheat, Info, Pencil, Check, X } from "lucide-react";
import { calculateDailyFeedRequirement, ROUGHAGE_TYPES, type RoughageTypeId } from "@/utils/feed-calculator";
import { updateRoughageOverride, logManualFeed } from "@/app/dashboard/(app)/cattle/[id]/actions";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/I18nProvider";

export function DailyFeedRequirementCard({
  cattleId,
  initialWeightKg,
  latestLoggedWeightKg,
  lastWeighedAt,
  purchaseDate,
  expectedDailyGainKg = 0.8,
  roughageOverrideKg = null,
  activeRoughage = null,
}: {
  cattleId: string;
  initialWeightKg: number;
  latestLoggedWeightKg: number | null;
  lastWeighedAt: string | null;
  purchaseDate: string;
  expectedDailyGainKg?: number;
  roughageOverrideKg?: number | null;
  activeRoughage?: { id: string; name: string; unit: string } | null;
}) {
  const { t } = useTranslation();
  const [roughageTypeId, setRoughageTypeId] = useState<RoughageTypeId>("straw");
  const selectedRoughageType = ROUGHAGE_TYPES.find((r) => r.id === roughageTypeId) ?? ROUGHAGE_TYPES[0];

  const feedReq = useMemo(() => {
    return calculateDailyFeedRequirement({
      initialWeightKg,
      latestLoggedWeightKg,
      lastWeighedAt,
      purchaseDate,
      expectedDailyGainKg,
      roughageDmPercent: selectedRoughageType.dmPercent,
    });
  }, [initialWeightKg, latestLoggedWeightKg, lastWeighedAt, purchaseDate, expectedDailyGainKg, selectedRoughageType.dmPercent]);

  const effectiveRoughageKg = roughageOverrideKg ?? feedReq.roughageKg;
  const effectiveRoughageDmKg = effectiveRoughageKg * feedReq.roughageDmPercent;
  const totalDmi = feedReq.actualConcentrateKg + effectiveRoughageDmKg;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(effectiveRoughageKg.toFixed(2));
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setDraft(effectiveRoughageKg.toFixed(2));
    setEditing(true);
  }
  function cancel() { setEditing(false); }
  function save() {
    const val = parseFloat(draft);
    if (isNaN(val) || val < 0) return;
    startTransition(async () => { await updateRoughageOverride(cattleId, val); setEditing(false); });
  }
  function clearOverride() {
    startTransition(async () => { await updateRoughageOverride(cattleId, null); setEditing(false); });
  }
  function logFeed() {
    if (!activeRoughage) return;
    const val = parseFloat(draft);
    if (isNaN(val) || val <= 0) { toast.error("Invalid amount"); return; }
    startTransition(async () => {
      const res = await logManualFeed(cattleId, activeRoughage.id, val);
      if (res?.error) toast.error(res.error);
      else toast.success(`Logged ${val} ${activeRoughage.unit} of ${activeRoughage.name}`);
    });
  }

  const roughageUnit = activeRoughage?.unit || "kg";
  const concentratePct = totalDmi > 0 ? (feedReq.actualConcentrateKg / totalDmi) * 100 : 0;
  const roughagePct = 100 - concentratePct;

  return (
    <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-amber-50/60 dark:bg-amber-950/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
            <Wheat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t.cattle_details.feed_card.today_feed}</h2>
            <p className="text-xs text-muted-foreground">
              {t.cattle_details.feed_card.based_on_weight.replace("{{weight}}", feedReq.projectedWeightKg.toFixed(1))}
            </p>
          </div>
        </div>
        {feedReq.acclimatizationFactor < 1 && (
          <span className="text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2.5 py-1">
            {t.cattle_details.feed_card.acclimatizing.replace("{{pct}}", String(Math.round(feedReq.acclimatizationFactor * 100)))}
          </span>
        )}
      </div>

      {/* Big numbers — Concentrate | Roughage */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Concentrate */}
        <div className="px-4 sm:px-5 py-4 sm:py-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.cattle_details.feed_card.concentrate}</p>
          </div>
          <p className="text-3xl sm:text-4xl font-bold tabular-nums leading-none text-amber-700 dark:text-amber-300">
            {feedReq.actualConcentrateKg.toFixed(1)}
            <span className="text-base sm:text-lg font-normal text-muted-foreground ml-1">kg</span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{t.cattle_details.feed_card.dry_matter_pct.replace("{{pct}}", String(feedReq.concentratePercent))}</p>
          {feedReq.adgBasedConcentrateKg !== null && Math.abs(feedReq.adgBasedConcentrateKg - feedReq.actualConcentrateKg) > 0.1 && (
            <span className="mt-1.5 inline-block text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold">
              ADG→ {feedReq.adgBasedConcentrateKg.toFixed(1)} kg
            </span>
          )}
        </div>

        {/* Roughage — editable */}
        <div className="px-4 sm:px-5 py-4 sm:py-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.cattle_details.feed_card.roughage}</p>
              {roughageOverrideKg !== null && (
                <span className="text-xs font-semibold rounded bg-primary/10 text-primary px-1 py-0.5">{t.cattle_details.feed_card.manual}</span>
              )}
            </div>
            {!editing && (
              <button
                onClick={startEdit}
                className="rounded-md p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Edit roughage amount"
                title="Edit roughage amount"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums font-bold outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
                />
                <span className="text-sm text-muted-foreground">{roughageUnit}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={save}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                {activeRoughage && (
                  <button
                    onClick={logFeed}
                    disabled={pending}
                    className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {t.cattle_details.feed_card.log_fed}
                  </button>
                )}
                <button onClick={cancel} aria-label="Cancel editing" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-3 w-3" />
                </button>
                {roughageOverrideKg !== null && (
                  <button onClick={clearOverride} disabled={pending} className="text-xs text-red-500 hover:text-red-600 px-1">
                    Reset
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
                {effectiveRoughageKg.toFixed(1)}
                <span className="text-base sm:text-lg font-normal text-muted-foreground ml-1">{roughageUnit}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <select
                  value={roughageTypeId}
                  onChange={(e) => setRoughageTypeId(e.target.value as RoughageTypeId)}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                >
                  {ROUGHAGE_TYPES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                {selectedRoughageType.dmPercent < 0.85 && (
                  <span className="text-xs text-muted-foreground">
                    {(selectedRoughageType.dmPercent * 100).toFixed(0)}% DM
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* DMI summary bar */}
      <div className="px-4 sm:px-5 pb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>
            {t.cattle_details.feed_card.total_dry_matter}{" "}
            <span className="font-semibold text-foreground">{totalDmi.toFixed(1)} kg/day</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex">
          <div
            className="h-full bg-amber-500 transition-all rounded-l-full"
            style={{ width: `${concentratePct}%` }}
          />
          <div
            className="h-full bg-emerald-400 transition-all rounded-r-full"
            style={{ width: `${roughagePct}%` }}
          />
        </div>
        <div className="flex gap-4 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> {t.cattle_details.feed_card.concentrate}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> {t.cattle_details.feed_card.roughage}
          </span>
        </div>
      </div>

      {feedReq.acclimatizationFactor < 1 && (
        <div className="flex items-start gap-2 border-t border-border bg-blue-50/60 dark:bg-blue-950/10 px-4 sm:px-5 py-3 text-xs text-blue-700 dark:text-blue-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            {t.cattle_details.feed_card.acidosis_warning
              .replace("{{days}}", String(feedReq.daysOnFarm))
              .replace("{{pct}}", String(feedReq.acclimatizationFactor * 100))}
          </p>
        </div>
      )}
    </div>
  );
}
