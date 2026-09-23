import type { Partner, PartnerTransaction } from "@/types/database";

export interface PartnerAccountSummary {
  totalInvested: number;
  withdrawn: number;
  profitReceived: number;
  lossBorne: number;
  laborValue: number;
  months: number;
  equity: number;
  pendingProfit: number;
  pendingLoss: number;
}

export function bdt(n: number): string {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

const AVATAR_PAL = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-indigo-500",
  "bg-pink-500",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_PAL[h % AVATAR_PAL.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function monthsActive(joinedAt: string): number {
  const joined = new Date(joinedAt + "T00:00:00");
  const now = new Date();
  let months =
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth());
  if (now.getDate() < joined.getDate()) months--;
  return Math.max(0, months);
}

/** Total capital invested by a partner = sum of ALL investment transactions.
 *  Transactions are the single source of truth; investment_amount is a display-only reference. */
export function totalCapitalOf(txns: PartnerTransaction[]): number {
  return txns
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + t.amount, 0);
}

/** Net Investment a partner holds: capital invested - withdrawn + vested labor value. */
export function computeNetInvestment(
  p: Partner,
  txns: PartnerTransaction[]
): number {
  const invested = totalCapitalOf(txns);
  const withdrawn = txns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);

  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue = p.labor_value_monthly
    ? p.labor_value_monthly * vestedMonths
    : 0;

  return Math.max(0, invested - withdrawn + laborValue);
}

/** Effective share %:
 *  - manual partners get their fixed profit_share_pct
 *  - auto partners proportionally split whatever % remains after manual partners
 *    (so total across all partners always sums to 100%) */
export function effectiveShare(
  p: Partner,
  allPartners: Partner[],
  txnsByPartner: Record<string, PartnerTransaction[]>
): number {
  if (p.share_mode === "manual") return p.profit_share_pct;

  const manualTotal = allPartners
    .filter((x) => x.share_mode === "manual")
    .reduce((s, x) => s + x.profit_share_pct, 0);
  const remainingPool = Math.max(0, 100 - manualTotal);

  const autoPartners = allPartners.filter((x) => x.share_mode !== "manual");
  const totalAutoInvested = autoPartners.reduce(
    (s, x) => s + computeNetInvestment(x, txnsByPartner[x.id] ?? []),
    0
  );
  if (totalAutoInvested === 0) return 0;

  return (
    (computeNetInvestment(p, txnsByPartner[p.id] ?? []) / totalAutoInvested) *
    remainingPool
  );
}

/** Full capital-account summary for one partner. */
export function computeAccount(
  p: Partner,
  txns: PartnerTransaction[],
  netPL: number,
  sharePct: number
): PartnerAccountSummary {
  const totalInvested = totalCapitalOf(txns);
  const withdrawn = txns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const profitReceived = txns
    .filter((t) => t.type === "profit")
    .reduce((s, t) => s + t.amount, 0);
  const lossBorne = txns
    .filter((t) => t.type === "loss_allocation")
    .reduce((s, t) => s + t.amount, 0);

  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue =
    p.partner_type !== "capital" && p.labor_value_monthly
      ? p.labor_value_monthly * vestedMonths
      : 0;

  const pendingProfit =
    netPL > 0 && sharePct > 0
      ? Math.max(0, (netPL * sharePct) / 100 - profitReceived)
      : 0;
  const pendingLoss =
    netPL < 0 && sharePct > 0 && p.bears_loss
      ? Math.max(0, (Math.abs(netPL) * sharePct) / 100 - lossBorne)
      : 0;

  const equity =
    totalInvested +
    laborValue -
    withdrawn -
    lossBorne +
    pendingProfit -
    pendingLoss;

  return {
    totalInvested,
    withdrawn,
    profitReceived,
    lossBorne,
    laborValue,
    months,
    equity,
    pendingProfit,
    pendingLoss,
  };
}
