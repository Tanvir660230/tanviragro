/** Approximate Eid-ul-Adha dates (Bangladesh moon sighting) — the single list used by the app. */
export const EID_DATES = [
  "2025-06-06", "2026-05-27", "2027-05-16", "2028-05-05",
  "2029-04-24", "2030-04-13", "2031-04-03", "2032-03-22",
];

/** Next Eid-ul-Adha strictly after `today` (YYYY-MM-DD); beyond the list, +354 days per Islamic year. */
export function nextEidDate(today: string): string {
  const next = EID_DATES.find((d) => d > today);
  if (next) return next;
  let d = EID_DATES[EID_DATES.length - 1];
  while (d <= today) d = new Date(Date.parse(`${d}T00:00:00Z`) + 354 * 86400000).toISOString().slice(0, 10);
  return d;
}
