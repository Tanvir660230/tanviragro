/**
 * Tanvir Agro ERP — Event-Driven Architecture
 * Strongly typed domain event contracts across Livestock, Inventory, Finance, System & Security
 */

export type EventPriority = "critical" | "high" | "medium" | "low" | "info";

export type EventCategory = 
  | "livestock"
  | "inventory"
  | "finance"
  | "compliance"
  | "system"
  | "security"
  | "operations";

export type DomainEventType =
  // ── Livestock Events ──────────────────────────────────────────────
  | "AnimalAdded"
  | "AnimalStatusChanged"
  | "AnimalWeightRecorded"
  | "AnimalWeightDropped"
  | "AnimalQuarantined"
  | "VaccinationDue"
  | "VaccinationCompleted"
  | "TreatmentDue"
  | "TreatmentCompleted"
  | "SellWindowOptimal"
  | "AnimalSold"
  | "InsuranceExpiring"
  
  // ── Inventory & Feed Events ───────────────────────────────────────
  | "InventoryLow"
  | "InventoryCritical"
  | "InventoryExpired"
  | "InventoryExpiringSoon"
  | "FeedRunningLow"
  | "MedicineRunningLow"
  | "InventoryStockAdded"
  | "StockConsumed"
  | "StockAdjusted"
  
  // ── Finance & Partner Events ──────────────────────────────────────
  | "ExpenseRecorded"
  | "IncomeRecorded"
  | "CashBelowThreshold"
  | "LoanDue"
  | "LoanPaymentRecorded"
  | "PartnerPaymentReceived"
  | "PartnerPaymentOverdue"
  | "ProfitDistributed"
  | "FinancialLockCreated"
  | "BudgetExceeded"
  
  // ── System, Security & Operations ─────────────────────────────────
  | "BackupCompleted"
  | "BackupFailed"
  | "UserCreated"
  | "PermissionChanged"
  | "LoginDetected"
  | "FailedLogin"
  | "ReportGenerated"
  | "SystemError"
  | "JobCompleted"
  | "WorkflowExecuted";

export interface BaseEventPayload {
  eventId: string;
  eventType: DomainEventType;
  category: EventCategory;
  priority: EventPriority;
  businessId: string;
  userId?: string | null;
  timestamp: string; // ISO 8601
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

// ── Specific Domain Event Payloads ─────────────────────────────────

export interface AnimalWeightRecordedPayload extends BaseEventPayload {
  eventType: "AnimalWeightRecorded" | "AnimalWeightDropped";
  cattleId: string;
  tagId: string;
  weightKg: number;
  previousWeightKg?: number;
  changeKg?: number;
}

export interface VaccinationDuePayload extends BaseEventPayload {
  eventType: "VaccinationDue";
  cattleId: string;
  tagId: string;
  vaccineName: string;
  dueDate: string;
  isOverdue: boolean;
}

export interface InventoryThresholdPayload extends BaseEventPayload {
  eventType: "InventoryLow" | "InventoryCritical" | "FeedRunningLow" | "MedicineRunningLow";
  itemId: string;
  itemName: string;
  currentStock: number;
  threshold: number;
  unit: string;
  daysRemaining?: number | null;
}

export interface LoanDuePayload extends BaseEventPayload {
  eventType: "LoanDue";
  loanId: string;
  lenderName: string;
  principalAmount: number;
  dueDate: string;
  daysUntilDue: number;
}

export interface FinancialAlertPayload extends BaseEventPayload {
  eventType: "CashBelowThreshold" | "ExpenseRecorded" | "BudgetExceeded";
  amount: number;
  threshold?: number;
  costCategory?: string;
}

export interface SystemAuditPayload extends BaseEventPayload {
  eventType: "BackupCompleted" | "BackupFailed" | "UserCreated" | "PermissionChanged" | "SystemError";
  actorEmail?: string;
  resourceId?: string;
  details?: string;
}

export type DomainEvent =
  | BaseEventPayload
  | AnimalWeightRecordedPayload
  | VaccinationDuePayload
  | InventoryThresholdPayload
  | LoanDuePayload
  | FinancialAlertPayload
  | SystemAuditPayload;
