export function fmtBDT(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return "৳—";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10000000) {
    return `${sign}৳${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}৳${(abs / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `${sign}৳${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}৳${abs}`;
}

export function fmtBDTFull(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return "৳—";
  return `৳${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function fmtDate(
  s: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", opts);
}

export function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}
