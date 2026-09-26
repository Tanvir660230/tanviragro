import { addDays, startOfMonth, todayDhaka } from "@/lib/dates";

/**
 * The Money page's period from its URL (?fp=this-month|last-month|last-3m|this-year|all, or
 * ?fs=YYYY-MM-DD&fe=YYYY-MM-DD). Dhaka calendar dates as strings.
 */
export function financePeriod(
  fp: string | undefined,
  fs: string | undefined,
  fe: string | undefined,
  fiscalYearStartMonth = 7,   // 1-based; default July for Bangladesh
): { start: string | null; end: string | null } {
  // Dhaka calendar dates as strings: toISOString() gave the UTC date (yesterday before 06:00)
  // and shifted month starts by a day on a UTC+6 machine.
  const todayStr = todayDhaka();
  const year = Number(todayStr.slice(0, 4));
  const month = Number(todayStr.slice(5, 7));   // 1-based
  const ym = (y: number, m: number) => {        // m may be ≤ 0: roll back into earlier years
    const t = y * 12 + (m - 1);
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  };

  if (fp === "all") return { start: null, end: null };
  if (!fp && fs)    return { start: fs, end: fe ?? todayStr };

  const preset = fp ?? "this-month";

  if (preset === "last-month") {
    const start = `${ym(year, month - 1)}-01`;
    return { start, end: addDays(`${ym(year, month)}-01`, -1) };
  }
  if (preset === "last-3m") {
    return { start: `${ym(year, month - 3)}-01`, end: todayStr };
  }
  if (preset === "this-year") {
    const fyYear = month >= fiscalYearStartMonth ? year : year - 1;
    return { start: `${fyYear}-${String(fiscalYearStartMonth).padStart(2, "0")}-01`, end: todayStr };
  }

  // Default / "this-month"
  return { start: startOfMonth(todayStr), end: todayStr };
}
