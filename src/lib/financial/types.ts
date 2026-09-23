export type AccountSection = "assets" | "liabilities" | "equity" | "revenue" | "expenses";
export type NormalBalance = "debit" | "credit";

export interface AccountDefinition {
  code: string;
  name: string;
  section: AccountSection;
  normalBalance: NormalBalance;
  description: string;
  isSystem?: boolean;
}

export type FinancialTransactionSource =
  | "cattle_purchase"
  | "cattle_sale"
  | "feed_purchase"
  | "feed_consumption"
  | "cost_entry"
  | "fixed_asset_purchase"
  | "fixed_asset_disposal"
  | "depreciation"
  | "loan_disbursement"
  | "loan_repayment"
  | "liability_incurred"
  | "liability_settlement"
  | "partner_investment"
  | "partner_draw"
  | "partner_profit_distribution"
  | "partner_loss_allocation"
  | "livestock_mortality"
  | "manual_journal"
  | "commerce_order"
  | "commerce_payment"
  | "commerce_logistics";

export interface JournalPostingLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  notes?: string | null;
}

export interface JournalEntry {
  id: string;
  businessId: string;
  referenceNumber: string;
  sourceModule: FinancialTransactionSource;
  sourceEntityId?: string | null;
  transactionDate: string;
  description: string;
  lines: JournalPostingLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  createdBy?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CashPosition {
  balance: number;
  opening: number;
  totalInflow: number;
  totalOutflow: number;
  inflows: {
    capitalIn: number;
    salesRevenue: number;
    loanProceeds: number;
    liabilityProceeds: number;
    otherIncome: number;
  };
  outflows: {
    capitalOut: number;
    cattlePurchases: number;
    inventoryPurchases: number;
    operatingExpenses: number;
    fixedAssetPurchases: number;
    loanRepayments: number;
    liabilityRepayments: number;
  };
  financingNet: number;
  accruedInterestPayable: number;
  asOf: string;
}

export interface FinancialMetricSummary {
  cashBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
  grossProfit: number;
  totalRevenue: number;
  totalExpenses: number;
  inventoryValuation: number;
  livestockValuation: number;
  workingCapital: number;
  debtToEquityRatio: number;
}

// ── Cost & Profit Center Types ──────────────────────────────────────────
export type CostCenterType = "farm" | "pen" | "feedlot" | "breed" | "herd" | "production_cycle" | "department" | "commerce";

export interface CostCenter {
  id: string;
  businessId: string;
  code: string;
  name: string;
  type: CostCenterType;
  parentId?: string | null;
  isActive: boolean;
  managerName?: string | null;
  allocatedBudget: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Authoritative Animal Financial Ledger & Unit Economics ──────────────
export type AnimalFinancialStatus = "active" | "sold" | "deceased" | "transferred" | "culled";

export interface AnimalFinancialLedger {
  id: string;
  businessId: string;
  cattleId: string;
  tagId?: string | null;
  costCenterId?: string | null;
  purchaseCost: number;
  feedCost: number;
  medicineCost: number;
  vaccineCost: number;
  laborAllocated: number;
  breedingCost: number;
  transportCost: number;
  overheadAllocated: number;
  insuranceCost: number;
  mortalityLoss: number;
  totalAccumulatedCost: number;
  saleRevenue: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  weightGainKg: number;
  costPerKgGain: number;
  currentBiologicalValue: number;
  lastValuationDate?: string | null;
  roiPct: number;
  lifetimeValue: number;
  status: AnimalFinancialStatus;
  updatedAt: string;
}

// ── Multi-Dimensional Cost Allocation Types ──────────────────────────────
export type AllocationMethod = "head_count" | "weight_proportional" | "feed_days" | "equal_split" | "direct";
export type TargetScope = "all_active" | "farm" | "pen" | "breed" | "herd" | "cycle";

export interface CostAllocationRun {
  id: string;
  businessId: string;
  allocationBatchNumber: string;
  sourceCostId?: string | null;
  sourceCategory: string;
  allocationMethod: AllocationMethod;
  totalAmount: number;
  targetScope: TargetScope;
  targetScopeId?: string | null;
  recipientsCount: number;
  appliedDate: string;
  journalEntryId?: string | null;
  notes?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface AllocationCandidate {
  cattleId: string;
  tagId?: string;
  farmId?: string;
  penId?: string;
  breed?: string;
  herdId?: string;
  currentWeightKg: number;
  daysOnFeed: number;
  isActive: boolean;
}

export interface AllocatedResult {
  cattleId: string;
  tagId?: string;
  allocatedAmount: number;
  proportionPct: number;
}

// ── IAS 41 Biological Asset Valuations ──────────────────────────────────
export type ValuationBasis = "market_weight_estimate" | "market_active_quotes" | "discounted_cash_flow" | "historical_cost";

export interface BiologicalAssetValuation {
  id: string;
  businessId: string;
  valuationNumber: string;
  valuationDate: string;
  valuationBasis: ValuationBasis;
  marketRatePerKg: number;
  totalHeadCount: number;
  totalHerdWeightKg: number;
  previousBookValue: number;
  newFairValue: number;
  unrealizedGainLoss: number;
  journalEntryId?: string | null;
  isPosted: boolean;
  valuatorNotes?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

// ── Financial Budgets & Forecasting ─────────────────────────────────────
export interface FinancialBudget {
  id: string;
  businessId: string;
  fiscalYear: number;
  month?: number | null;
  costCenterId?: string | null;
  accountCode: string;
  budgetedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePct: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Accounting Period Locks & Internal Controls ─────────────────────────
export interface FinancialPeriodLock {
  id: string;
  businessId: string;
  lockName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt: string;
  reason?: string | null;
  unlockedAt?: string | null;
  unlockedBy?: string | null;
}

// ── Journal Reversal (Storno) ───────────────────────────────────────────
export interface FinancialReversal {
  id: string;
  businessId: string;
  originalJournalId: string;
  reversalJournalId: string;
  reversalReason: string;
  reversedBy?: string | null;
  createdAt: string;
}
