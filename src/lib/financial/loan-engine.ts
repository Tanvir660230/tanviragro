import { calculateAccruedInterest } from "./calculations";

export interface LoanDetails {
  id: string;
  businessId: string;
  lenderName: string;
  principalAmount: number;
  interestRatePct: number;
  loanDate: string;
  dueDate?: string | null;
  status: "active" | "paid" | "defaulted";
  payments: {
    id: string;
    amount: number;
    paymentDate: string;
    notes?: string | null;
  }[];
}

export interface LoanSummary {
  id: string;
  lenderName: string;
  principalAmount: number;
  interestRatePct: number;
  totalPaid: number;
  principalOutstanding: number;
  accruedInterest: number;
  totalSettlementDue: number;
  status: "active" | "paid" | "defaulted";
  isFullyPaid: boolean;
}

export class LoanEngine {
  /**
   * Summarizes a loan record with real-time interest and payment calculations
   */
  public static summarizeLoan(loan: LoanDetails, asOfDate = new Date().toISOString().slice(0, 10)): LoanSummary {
    const principal = Number(loan.principalAmount) || 0;
    const rate = Number(loan.interestRatePct) || 0;
    const totalPaid = (loan.payments ?? []).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    const principalOutstanding = Math.max(0, principal - totalPaid);
    const accruedInterest =
      loan.status === "paid" || principalOutstanding <= 0
        ? 0
        : calculateAccruedInterest(
            principalOutstanding,
            rate,
            loan.loanDate,
            asOfDate,
            [],
            loan.status
          );

    const isFullyPaid = principalOutstanding <= 0 && loan.status !== "defaulted";
    const status = isFullyPaid ? "paid" : loan.status;

    return {
      id: loan.id,
      lenderName: loan.lenderName,
      principalAmount: Math.round(principal * 100) / 100,
      interestRatePct: rate,
      totalPaid: Math.round(totalPaid * 100) / 100,
      principalOutstanding: Math.round(principalOutstanding * 100) / 100,
      accruedInterest: Math.round(accruedInterest * 100) / 100,
      totalSettlementDue: Math.round((principalOutstanding + accruedInterest) * 100) / 100,
      status,
      isFullyPaid,
    };
  }

  /**
   * Aggregates total loan obligations across the farm
   */
  public static aggregateLoanObligations(loans: LoanDetails[], asOfDate?: string) {
    const summaries = loans.map((l) => this.summarizeLoan(l, asOfDate));
    const totalPrincipal = summaries.reduce((s, l) => s + l.principalAmount, 0);
    const totalPaid = summaries.reduce((s, l) => s + l.totalPaid, 0);
    const totalOutstanding = summaries.reduce((s, l) => s + l.principalOutstanding, 0);
    const totalAccruedInterest = summaries.reduce((s, l) => s + l.accruedInterest, 0);

    return {
      totalPrincipal: Math.round(totalPrincipal * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalAccruedInterest: Math.round(totalAccruedInterest * 100) / 100,
      totalObligations: Math.round((totalOutstanding + totalAccruedInterest) * 100) / 100,
      activeLoanCount: summaries.filter((l) => l.status === "active").length,
    };
  }
}