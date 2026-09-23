import type { OperationalAlertItem } from "./types";
import { compareSeverity } from "@/lib/alerts/hierarchy";

export interface AlertCompilationInput {
  overdueHealthEvents?: { id: string; title: string; scheduledAt: string; cattleTag?: string; cattleId: string }[];
  upcomingHealthEvents?: { id: string; title: string; scheduledAt: string; cattleTag?: string; cattleId: string }[];
  lowStockItems?: { id: string; name: string; unit: string; currentStock: number; threshold: number }[];
  criticalStockOuts?: { id: string; name: string }[];
  loansDueSoon?: { id: string; lenderName: string; amount: number; dueDate: string; isOverdue: boolean }[];
  withdrawalRestrictedCattle?: { cattleId: string; tagId: string; withdrawalUntil: string }[];
  unweighedCattle?: { cattleId: string; tagId: string; daysSinceLastWeight: number }[];
  mortalityRate?: number;
  grossMarginPct?: number;
  cashRunwayDays?: number;
}

export class AlertEngine {
  /**
   * Compiles farm-wide alerts from disparate domains into a single prioritized queue.
   */
  public static compileOperationalAlerts(input: AlertCompilationInput): OperationalAlertItem[] {
    const alerts: OperationalAlertItem[] = [];

    // 1. Critical Stock-Outs
    for (const item of input.criticalStockOuts ?? []) {
      alerts.push({
        id: `stock-out-${item.id}`,
        category: "inventory",
        severity: "critical",
        title: `Out of Stock: ${item.name}`,
        description: `${item.name} is completely depleted. Ration mixing and feeding may be blocked.`,
        targetId: item.id,
        actionUrl: `/dashboard/inventory/purchase`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 2. High Mortality Spike Detection
    if (input.mortalityRate !== undefined && input.mortalityRate > 3.0) {
      alerts.push({
        id: "alert-mortality-spike",
        category: "health",
        severity: "critical",
        title: `Mortality Rate Spike: ${input.mortalityRate}%`,
        description: `Herd mortality rate has exceeded enterprise threshold (3.0%). Veterinary quarantine check advised.`,
        actionUrl: `/dashboard/medical`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 3. Cash Flow Runway Crunch
    if (input.cashRunwayDays !== undefined && input.cashRunwayDays < 15) {
      alerts.push({
        id: "alert-cash-runway-risk",
        category: "financial",
        severity: input.cashRunwayDays <= 7 ? "critical" : "high",
        title: `Cash Runway Alert: ${input.cashRunwayDays} Days Remaining`,
        description: `Operating cash is projected to deplete within ${input.cashRunwayDays} days.`,
        actionUrl: `/dashboard/accounting/cash-flow`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 4. Overdue Health Events
    for (const h of input.overdueHealthEvents ?? []) {
      alerts.push({
        id: `overdue-health-${h.id}`,
        category: "health",
        severity: "critical",
        title: `Overdue Medical: ${h.title}`,
        description: `Scheduled for ${h.scheduledAt} for animal ${h.cattleTag || h.cattleId}`,
        targetId: h.cattleId,
        actionUrl: `/dashboard/cattle/${h.cattleId}`,
        dueDate: h.scheduledAt,
        detectedAt: new Date().toISOString(),
      });
    }


    // 5. Active Drug Withdrawal Restrictions
    for (const w of input.withdrawalRestrictedCattle ?? []) {
      alerts.push({
        id: `withdrawal-${w.cattleId}`,
        category: "compliance",
        severity: "high",
        title: `Drug Withdrawal Active: ${w.tagId}`,
        description: `Meat and milk sales restricted until ${w.withdrawalUntil}.`,
        targetId: w.cattleId,
        actionUrl: `/dashboard/cattle/${w.cattleId}`,
        dueDate: w.withdrawalUntil,
        detectedAt: new Date().toISOString(),
      });
    }

    // 6. Declining Profit Margin Warning
    if (input.grossMarginPct !== undefined && input.grossMarginPct < 10.0 && input.grossMarginPct > 0) {
      alerts.push({
        id: "alert-low-margin",
        category: "financial",
        severity: "high",
        title: `Thin Operating Margin: ${input.grossMarginPct}%`,
        description: `Gross profit margin is below target threshold of 10.0%. Review feed formulation and operational cost allocation.`,
        actionUrl: `/dashboard/cost-center`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 7. Low Stock Warnings
    for (const i of input.lowStockItems ?? []) {
      alerts.push({
        id: `low-stock-${i.id}`,
        category: "inventory",
        severity: "medium",
        title: `Low Stock: ${i.name}`,
        description: `Current stock (${i.currentStock} ${i.unit}) is at or below reorder threshold (${i.threshold} ${i.unit}).`,
        targetId: i.id,
        actionUrl: `/dashboard/inventory`,
        detectedAt: new Date().toISOString(),
      });
    }

    // 8. Loan Repayments Due
    for (const loan of input.loansDueSoon ?? []) {
      alerts.push({
        id: `loan-due-${loan.id}`,
        category: "financial",
        severity: loan.isOverdue ? "critical" : "high",
        title: loan.isOverdue ? `Loan Overdue: ${loan.lenderName}` : `Loan Repayment Due: ${loan.lenderName}`,
        description: `Amount ৳${loan.amount.toLocaleString()} due on ${loan.dueDate}`,
        targetId: loan.id,
        actionUrl: `/dashboard/finance/loans`,
        dueDate: loan.dueDate,
        detectedAt: new Date().toISOString(),
      });
    }

    // 9. Upcoming Vaccines (Within 7 Days)
    for (const h of input.upcomingHealthEvents ?? []) {
      alerts.push({
        id: `upcoming-health-${h.id}`,
        category: "health",
        severity: "low",
        title: `Upcoming: ${h.title}`,
        description: `Scheduled on ${h.scheduledAt} for ${h.cattleTag || h.cattleId}`,
        targetId: h.cattleId,
        actionUrl: `/dashboard/cattle/${h.cattleId}`,
        dueDate: h.scheduledAt,
        detectedAt: new Date().toISOString(),
      });
    }

    // 10. Unweighed Cattle (Overdue Weight Check)
    for (const u of input.unweighedCattle ?? []) {
      alerts.push({
        id: `unweighed-${u.cattleId}`,
        category: "weight",
        severity: "info",
        title: `Weight Log Due: ${u.tagId}`,
        description: `No weight recorded for ${u.daysSinceLastWeight} days.`,
        targetId: u.cattleId,
        actionUrl: `/dashboard/cattle/${u.cattleId}`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Sort by strict severity hierarchy rank
    return alerts.sort((a, b) => compareSeverity(a.severity, b.severity));
  }
}