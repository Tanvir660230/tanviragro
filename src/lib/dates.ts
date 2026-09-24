/**
 * Calendar-date helpers for the farm's time zone (Asia/Dhaka, UTC+6, no DST).
 *
 * Use these for `date` columns (recorded_at, sold_at, ...) and "today" comparisons.
 * `new Date().toISOString().slice(0, 10)` gives the UTC date, which is still
 * "yesterday" in Dhaka between 00:00 and 05:59 local time (BUG-08).
 * Keep full timestamps (timestamptz) as UTC ISO strings.
 */
export const FARM_TIME_ZONE = "Asia/Dhaka";

const dhakaDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: FARM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of the given instant as seen on a Dhaka calendar. */
export function toDhakaDate(instant: Date | number = new Date()): string {
  return dhakaDateFormat.format(instant);
}

/** Today's date (YYYY-MM-DD) in Dhaka. */
export function todayDhaka(): string {
  return toDhakaDate(new Date());
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no time-zone effects). */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** First day of the month (YYYY-MM-01) containing the given YYYY-MM-DD. */
export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}
