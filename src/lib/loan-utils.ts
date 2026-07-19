/**
 * Accrued interest using simple interest on the original principal.
 *
 * Interest = P × r × (days / 365)
 *
 * Payments reduce the outstanding balance (principal + accumulated interest)
 * but do NOT change the rate at which interest accrues — the accrual base
 * is always the original principal. This matches the "is paid?" check in
 * loans/actions.ts: totalOwed = principal + calcAccruedInterest(...).
 *
 * The `payments` and `status` parameters are accepted for call-site
 * compatibility but status="paid" short-circuits to 0.
 */
export function calcAccruedInterest(
  principal: number,
  ratePct: number,
  loanDate: string,
  asOfDate: string,
  _payments: { amount: number; paid_at: string }[] = [],
  status: string = "active"
): number {
  if (!ratePct || status === "paid") return 0;

  const start = new Date(loanDate).getTime();
  const end   = new Date(asOfDate).getTime();
  const days  = (end - start) / 86_400_000;
  if (days <= 0) return 0;

  return principal * (ratePct / 100) * (days / 365);
}
