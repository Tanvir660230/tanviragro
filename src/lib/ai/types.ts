/**
 * SPRINT 20: Enterprise AI Decision Support, Prediction & Automation Platform
 * Core Type Definitions & Provider Interfaces
 */

export type AiProviderType = "anthropic" | "openai" | "deepseek" | "gemini" | "local_rules";

export type AiModelTask =
  | "disease_risk"
  | "mortality_risk"
  | "growth_prediction"
  | "weight_forecast"
  | "feed_demand"
  | "medicine_demand"
  | "cashflow_forecast"
  | "breeding_probability"
  | "treatment_recommendation"
  | "feed_optimization"
  | "breeding_pair_selection"
  | "inventory_replenishment"
  | "purchase_sale_timing"
  | "nl_query"
  | "executive_summary"
  | "workflow_automation";

export type AiConfidenceLevel = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "UNCERTAIN";
export type AiRiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "NORMAL";
export type AiUrgency = "IMMEDIATE" | "ACTION_REQUIRED" | "MONITOR" | "OPTIONAL" | "INFORMATIONAL";

export interface AiExplanationFactor {
  factor: string;
  weight: number; // 0 to 1 relative impact
  observedValue: string | number;
  expectedBaseline?: string | number;
  description: string;
}

export interface ExplainableAiMetadata {
  modelName: string;
  modelVersion: string;
  provider: AiProviderType;
  confidenceScore: number; // 0.00 to 1.00
  confidenceLevel: AiConfidenceLevel;
  primaryRationale: string;
  contributingFactors: AiExplanationFactor[];
  historicalEvidence: string[];
  applicableBusinessRules: string[];
  humanOverrideAllowed: boolean;
  generatedAt: string;
}

// -------------------------------------------------------------
// 1. PREDICTIONS
// -------------------------------------------------------------

export interface DiseaseRiskPrediction {
  cattleId: string;
  tagNumber: string;
  penId?: string;
  /** 0-100 risk score produced by the engine (runtime field) */
  overallRiskScore: number;
  riskLevel: AiRiskLevel;
  potentialConditions: string[];
  earlyWarningSignals: string[];
  recommendedVetIntervention: string;
  explainability: ExplainableAiMetadata;
}

export interface MortalityRiskAssessment {
  cattleId: string;
  tagNumber: string;
  mortalityProbabilityPct: number; // 0-100%
  urgency: AiUrgency;
  topRiskDrivers: string[];
  preventativeProtocol: string[];
  explainability: ExplainableAiMetadata;
}

export interface GrowthTrajectoryPrediction {
  cattleId: string;
  tagNumber: string;
  currentWeightKg: number;
  currentAdgKg: number;
  projectedWeight30Days: number;
  projectedWeight60Days: number;
  projectedWeight90Days: number;
  projectedDaysToTarget: number;
  targetWeightKg: number;
  expectedFeedConversionRatio: number;
  growthPlateauRisk: boolean;
  explainability: ExplainableAiMetadata;
}

export interface FeedDemandForecast {
  daysAhead: number;
  forecastDate: string;
  projectedBiomassKg: number;
  dryMatterRequiredKg: number;
  concentrateRequiredKg: number;
  roughageRequiredKg: number;
  estimatedFeedCostBdt: number;
  feedShortageRisk: boolean;
  explainability: ExplainableAiMetadata;
}

export interface CashFlowForecastHorizon {
  monthOffset: number;
  monthLabel: string;
  projectedInflowBdt: number;
  projectedOutflowBdt: number;
  projectedNetMarginBdt: number;
}

export interface AiCashFlowForecast {
  businessId: string;
  generatedAt: string;
  currency: string;
  horizons: CashFlowForecastHorizon[];
  expectedSeasonalSpikes: Array<{ season: string; rationale: string }>;
  riskFactors: string[];
  explainability: ExplainableAiMetadata;
}

// -------------------------------------------------------------
// 2. RECOMMENDATIONS
// -------------------------------------------------------------

export type RecommendationCategory =
  | "VACCINATION"
  | "TREATMENT"
  | "FEED_OPTIMIZATION"
  | "BREEDING_PAIR"
  | "INVENTORY_REORDER"
  | "PURCHASE_TIMING"
  | "SALE_TIMING"
  | "COST_REDUCTION"
  | "OPERATIONAL_EFFICIENCY";

export interface EnterpriseAiRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  summary: string;
  urgency: AiUrgency;
  confidenceScore: number;
  expectedFinancialImpactBdt?: number;
  expectedBiologicalImpact?: string;
  supportingData: Record<string, any>;
  actionPayload?: {
    actionType: string;
    entityType: string;
    entityId: string;
    suggestedParameters: Record<string, any>;
    requiresApproval: boolean;
  };
  explainability: ExplainableAiMetadata;
}

// -------------------------------------------------------------
// 3. NATURAL LANGUAGE ANALYTICS
// -------------------------------------------------------------

export type NlQueryIntentType =
  | "FILTER_ANIMALS"
  | "COST_ANALYSIS"
  | "PROFITABILITY_DIAGNOSTIC"
  | "HEALTH_VACCINATION_OVERDUE"
  | "INVENTORY_STATUS"
  | "GENERAL_KNOWLEDGE"
  | "ERP_NAVIGATION";

export interface NlAnalyticsQueryRequest {
  query: string;
  locale?: "en" | "bn";
  userId?: string;
  role?: string;
  businessId: string;
}

export interface NlAnalyticsQueryResponse {
  query: string;
  intent: NlQueryIntentType;
  answerSummary: string;
  answerSummaryBn?: string;
  structuredData?: Record<string, any>[];
  directNavigationUrl?: string;
  suggestedFollowUps: string[];
  executedFilterSqlSafeDescription?: string;
  explainability: ExplainableAiMetadata;
}

// -------------------------------------------------------------
// 4. AUTOMATION & HUMAN-IN-THE-LOOP ACTIONS
// -------------------------------------------------------------

export type AiAutomationStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "AUTO_EXECUTED" | "CANCELLED";

export interface AiAutomationProposal {
  id: string;
  businessId: string;
  actionType:
    | "REORDER_INVENTORY"
    | "SCHEDULE_TREATMENT"
    | "DISPATCH_VACCINE_CAMPAIGN"
    | "QUARANTINE_ANIMAL"
    | "ADJUST_FEED_RATION"
    | "EXECUTE_HARVEST_SALE"
    | "DRAFT_EXECUTIVE_REPORT";
  title: string;
  description: string;
  status: AiAutomationStatus;
  urgency: AiUrgency;
  requiresApproval: boolean;
  confidenceScore: number;
  parameters: Record<string, any>;
  proposedByModel: string;
  reasoning: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  executionResult?: Record<string, any>;
}

// -------------------------------------------------------------
// 5. AUDIT & FEEDBACK
// -------------------------------------------------------------

export interface AiAuditLogEntry {
  id: string;
  businessId: string;
  userId?: string;
  task: AiModelTask;
  provider: AiProviderType;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  sanitizedPrompt: string;
  sanitizedOutputSummary: string;
  confidenceScore: number;
  feedbackRating?: 1 | -1;
  feedbackNotes?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// 6. PROVIDER CLIENT INTERFACE
// -------------------------------------------------------------

export interface AiProviderConfig {
  provider: AiProviderType;
  modelName: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AiPromptPayload {
  systemPrompt: string;
  userPrompt: string;
  contextData?: Record<string, any>;
  temperature?: number;
}

export interface AiGenerationResult {
  text: string;
  parsedJson?: any;
  confidence: number;
  tokensUsed: { prompt: number; completion: number; total: number };
  model: string;
  provider: AiProviderType;
}

export interface BreedingSuccessProbability {
  cowId: string;
  cowTag: string;
  sireId?: string;
  sireBreed?: string;
  conceptionSuccessProbabilityPct: number;
  optimalInseminationWindowHours: number;
  calvingDifficultyRisk: AiRiskLevel;
  explainability: ExplainableAiMetadata;
}
