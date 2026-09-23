/**
 * Tanvir Agro ERP — Predefined Enterprise Automation Rules
 * Standard production rules for Livestock health, Inventory thresholds, Finance liabilities, and System integrity.
 */

import { WorkflowRule } from "./types";

export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  // ── 1. Critical Inventory Depletion ──────────────────────────────
  {
    id: "rule_inv_critical_depletion",
    name: "Critical Inventory Depletion Alert",
    description: "Alerts managers when inventory stock reaches zero or falls below critical safety buffer",
    eventTypes: ["InventoryLow", "InventoryCritical", "FeedRunningLow", "MedicineRunningLow"],
    priority: "critical",
    status: "active",
    cooldownSeconds: 3600,
    conditions: [
      {
        id: "cond_stock_lte_threshold",
        field: "currentStock",
        operator: "lte",
        value: 0,
      },
    ],
    conditionLogic: "OR",
    actions: [
      {
        id: "act_inv_in_app",
        type: "send_in_app",
        titleTemplate: "Stock Out: {itemName}",
        bodyTemplate: "{itemName} is currently out of stock ({currentStock} {unit}). Restock immediately.",
        actionUrlTemplate: "/dashboard/inventory",
      },
      {
        id: "act_inv_whatsapp",
        type: "send_whatsapp",
        titleTemplate: "⚠️ Low Stock Alert: {itemName}",
        bodyTemplate: "Item: {itemName}\nCurrent Stock: {currentStock} {unit}\nThreshold: {threshold} {unit}",
        actionUrlTemplate: "/dashboard/inventory",
      },
      {
        id: "act_inv_push",
        type: "send_push",
        titleTemplate: "Low Stock: {itemName}",
        bodyTemplate: "Current stock: {currentStock} {unit}",
        actionUrlTemplate: "/dashboard/inventory",
      },
    ],
    tags: ["inventory", "feed", "procurement"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  // ── 2. Vaccine & Medical Treatment Overdue ────────────────────────
  {
    id: "rule_vaccine_overdue",
    name: "Vaccination & Treatment Overdue Protocol",
    description: "Triggers veterinary alerts when scheduled livestock immunizations are past due",
    eventTypes: ["VaccinationDue", "TreatmentDue"],
    priority: "critical",
    status: "active",
    cooldownSeconds: 7200,
    conditions: [
      {
        id: "cond_is_overdue",
        field: "isOverdue",
        operator: "eq",
        value: true,
      },
    ],
    actions: [
      {
        id: "act_vet_in_app",
        type: "send_in_app",
        titleTemplate: "Overdue Medical: #{tagId} — {vaccineName}",
        bodyTemplate: "Vaccination or health protocol for cattle #{tagId} was due on {dueDate} and is overdue.",
        actionUrlTemplate: "/dashboard/cattle/{cattleId}?tab=health",
      },
      {
        id: "act_vet_whatsapp",
        type: "send_whatsapp",
        titleTemplate: "🐄 Overdue Health Protocol: #{tagId}",
        bodyTemplate: "Cow: #{tagId}\nProtocol: {vaccineName}\nScheduled: {dueDate}\nStatus: Overdue",
        actionUrlTemplate: "/dashboard/cattle/{cattleId}?tab=health",
      },
    ],
    tags: ["livestock", "health", "compliance"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  // ── 3. Animal Weight Loss Detector ──────────────────────────────
  {
    id: "rule_weight_drop",
    name: "Livestock Weight Loss Detector",
    description: "Detects weight reduction in cattle between weigh-ins indicating possible health issues",
    eventTypes: ["AnimalWeightDropped"],
    priority: "high",
    status: "active",
    cooldownSeconds: 86400,
    conditions: [
      {
        id: "cond_weight_loss",
        field: "changeKg",
        operator: "lt",
        value: 0,
      },
    ],
    actions: [
      {
        id: "act_weight_in_app",
        type: "send_in_app",
        titleTemplate: "Weight Loss: #{tagId}",
        bodyTemplate: "Cattle #{tagId} dropped {changeKg} kg (current: {weightKg} kg).",
        actionUrlTemplate: "/dashboard/cattle/{cattleId}",
      },
    ],
    tags: ["livestock", "growth", "feed"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  // ── 4. Loan Obligation Upcoming / Due ─────────────────────────────
  {
    id: "rule_loan_due",
    name: "Loan Due & Maturity Alert",
    description: "Alerts executive team 30 days prior to loan maturity for cash flow and debt service planning",
    eventTypes: ["LoanDue"],
    priority: "high",
    status: "active",
    cooldownSeconds: 86400 * 3,
    conditions: [
      {
        id: "cond_loan_days",
        field: "daysUntilDue",
        operator: "lte",
        value: 30,
      },
    ],
    actions: [
      {
        id: "act_loan_in_app",
        type: "send_in_app",
        titleTemplate: "Loan Maturity: {lenderName}",
        bodyTemplate: "Principal ৳{principalAmount} due on {dueDate} ({daysUntilDue} days remaining).",
        actionUrlTemplate: "/dashboard/finance/loans",
      },
      {
        id: "act_loan_email",
        type: "send_email",
        titleTemplate: "Upcoming Loan Maturity: {lenderName}",
        bodyTemplate: "Loan principal of ৳{principalAmount} with {lenderName} is due on {dueDate}.",
        actionUrlTemplate: "/dashboard/finance/loans",
      },
    ],
    tags: ["finance", "loans", "liabilities"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  // ── 5. Automated Backup Failure Notification ──────────────────────
  {
    id: "rule_backup_failure",
    name: "System Backup Failure Alert",
    description: "Sends high-priority administrative email alert if automated weekly database backup encounters an error",
    eventTypes: ["BackupFailed"],
    priority: "critical",
    status: "active",
    conditions: [],
    actions: [
      {
        id: "act_backup_email",
        type: "send_email",
        titleTemplate: "CRITICAL: Automated Backup Failed",
        bodyTemplate: "The scheduled database backup failed to execute. Details: {details}.",
      },
      {
        id: "act_backup_in_app",
        type: "send_in_app",
        titleTemplate: "Backup Error",
        bodyTemplate: "Automated database backup failed. Please check server logs.",
        actionUrlTemplate: "/dashboard/settings",
      },
    ],
    tags: ["system", "security", "backup"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];
