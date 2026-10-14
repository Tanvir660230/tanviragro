"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Box, Landmark, Smartphone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useL } from "@/i18n/text";
import { getCashHolderOptions } from "@/app/dashboard/(app)/finance/cash-holder-actions";
import type { HolderKind } from "@/lib/accounting/cash-holders";

export type HolderOption = { id: string; name: string; kind: HolderKind; partnerId: string | null };
type Options = { enabled: boolean; me: string | null; holders: HolderOption[] };

export const HOLDER_ICON: Record<HolderKind, React.ElementType> = { person: UserRound, bank: Landmark, mobile: Smartphone, box: Box };

// one read shared by every picker on the page, refreshed after a minute (a holder added on another phone shows up)
let cached: { at: number; p: Promise<Options> } | null = null;
const loadOptions = () => {
  if (!cached || Date.now() - cached.at > 60_000)
    cached = { at: Date.now(), p: getCashHolderOptions().catch(() => ({ enabled: false, me: null, holders: [] })) };
  return cached.p;
};
/** after a holder is added or renamed, the next picker reads the list again */
export const forgetHolderOptions = () => { cached = null; };

const LAST_KEY = "tanviragro.cashHolder.last";
const readLast = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const writeLast = (id: string) => { try { localStorage.setItem(LAST_KEY, id); } catch { /* private mode */ } };

/** Which holder a form starts on: a partner's own (their capital) › the signed-in person › the last one used here. */
export function defaultHolder(o: Options, partnerId: string | null | undefined, last: string | null): { id: string; why: "partner" | "me" | "last" } | null {
  const has = (id: string | null | undefined) => !!id && o.holders.some((h) => h.id === id);
  const own = partnerId ? o.holders.find((h) => h.partnerId === partnerId)?.id : undefined;
  if (has(own)) return { id: own!, why: "partner" };
  if (has(o.me)) return { id: o.me!, why: "me" };
  if (has(last)) return { id: last!, why: "last" };
  return null;
}

/**
 * "Whose cash?" on every form that moves money: the sale (who got the money), a purchase or a cost
 * (who paid it), a partner's capital (who received or handed it out). One tap. It starts on the
 * partner's own holder for their capital, else on the signed-in person, else on the last one used
 * on this device — and says which, so a wrong default is seen. "Later" leaves the row to be named on
 * the Money page. Hidden before migration 20261014090000.
 */
export function CashHolderPicker({ value, onChange, direction, name, partnerId, className }: {
  value: string;
  onChange: (id: string) => void;
  /** in: money came in (sale, capital in) — out: money went out (purchase, cost) */
  direction: "in" | "out";
  /** also send it with a form, under this field name */
  name?: string;
  /** a partner's own holder is the natural default for that partner's money */
  partnerId?: string | null;
  className?: string;
}) {
  const L = useL();
  const [opts, setOpts] = useState<Options | null>(null);
  // once someone taps a name in this context, the default's "(you)" / "(last time)" note goes away
  const context = `${partnerId ?? ""}|${direction}`;
  const [touchedFor, setTouchedFor] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadOptions().then((o) => { if (live) setOpts(o); });
    return () => { live = false; };
  }, []);

  // (re)start on the default whenever the list arrives or the form's context changes
  useEffect(() => {
    if (!opts?.enabled || !opts.holders.length) return;
    const d = defaultHolder(opts, partnerId, readLast());
    if (d && d.id !== value) onChange(d.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, partnerId, direction]);

  if (!opts?.enabled) return name ? <input type="hidden" name={name} value="" /> : null;

  const pick = (id: string) => { setTouchedFor(context); onChange(id); if (id) writeLast(id); };
  const auto = touchedFor === context ? null : defaultHolder(opts, partnerId, readLast());
  const why = auto && auto.id === value ? auto.why : null;
  const label = direction === "in" ? L("টাকা কার কাছে এলো?", "Who got the money?") : L("টাকা কার কাছ থেকে গেল?", "Whose cash paid?");
  const hint = (id: string) =>
    value !== id || !why ? null
    : why === "me" ? L("আপনি", "you") : why === "partner" ? L("অংশীদার নিজে", "the partner") : L("শেষবার", "last time");

  return (
    <fieldset className={cn("grid min-w-0 gap-1.5", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Banknote className="h-4 w-4 text-muted-foreground" aria-hidden />{label}</legend>
      {opts.holders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {L("কে কে টাকা রাখেন (যেমন তানভীর, মহিউদ্দিন, ব্যাংক) — আগে ", "Who keeps the cash (e.g. Tanvir, Mohiuddin, the bank) — first ")}
          <Link href="/dashboard/finance?tab=holders" className="font-medium text-primary hover:underline">{L("টাকা-পয়সা পাতায় যোগ করুন", "add them on the Money page")}</Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
          {opts.holders.map((h) => {
            const Icon = HOLDER_ICON[h.kind];
            const note = hint(h.id);
            return (
              <button key={h.id} type="button" role="radio" aria-checked={value === h.id} onClick={() => pick(h.id)}
                className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                  value === h.id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground")}>
                <Icon className="h-4 w-4" aria-hidden />{h.name}
                {note && <span className="text-[11px] font-normal opacity-80">({note})</span>}
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={!value} onClick={() => pick("")}
            className={cn("inline-flex min-h-10 items-center rounded-lg border border-dashed px-3 text-sm transition-colors",
              !value ? "border-foreground/40 bg-muted text-foreground" : "border-input text-muted-foreground hover:text-foreground")}>
            {L("পরে বলব", "Later")}
          </button>
        </div>
      )}
    </fieldset>
  );
}

/** The picker for a plain <form>: keeps its own choice and sends it as `cash_holder_id`. */
export function CashHolderField({ direction, className, partnerId }: { direction: "in" | "out"; className?: string; partnerId?: string | null }) {
  const [value, setValue] = useState("");
  return <CashHolderPicker direction={direction} name="cash_holder_id" value={value} onChange={setValue} className={className} partnerId={partnerId} />;
}
