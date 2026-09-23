import { WorkflowTemplate, QuickActionMatrixItem } from "./types";
import { FEEDING_TEMPLATE } from "./templates-feed";
import { VACCINATION_TEMPLATE, MEDICINE_USAGE_TEMPLATE } from "./templates-vet";
import { WEIGHT_MEASUREMENT_TEMPLATE, SELL_ANIMAL_TEMPLATE } from "./templates-livestock-other";
import { PURCHASE_FEED_TEMPLATE } from "./templates-procure";
import { RECORD_EXPENSE_TEMPLATE, RECEIVE_INCOME_TEMPLATE } from "./templates-finance";
import { PARTNER_INVESTMENT_TEMPLATE, LOAN_PAYMENT_TEMPLATE } from "./templates-partner-loan";
import { INVENTORY_ADJUSTMENT_TEMPLATE } from "./templates-inventory";

export const ALL_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  FEEDING_TEMPLATE,
  VACCINATION_TEMPLATE,
  PURCHASE_FEED_TEMPLATE,
  RECORD_EXPENSE_TEMPLATE,
  RECEIVE_INCOME_TEMPLATE,
  WEIGHT_MEASUREMENT_TEMPLATE,
  SELL_ANIMAL_TEMPLATE,
  MEDICINE_USAGE_TEMPLATE,
  PARTNER_INVESTMENT_TEMPLATE,
  LOAN_PAYMENT_TEMPLATE,
  INVENTORY_ADJUSTMENT_TEMPLATE,
];

export const WORKFLOW_CATALOG = ALL_WORKFLOW_TEMPLATES;

export const QUICK_ACTION_MATRIX: QuickActionMatrixItem[] = ALL_WORKFLOW_TEMPLATES.map((tmpl) => {
  const previousClicks = tmpl.id === "wf_purchase_feed" ? 18 : tmpl.id === "wf_sell_animal" ? 22 : tmpl.id === "wf_vaccination" ? 16 : 14;
  const workflowSteps = tmpl.steps ? tmpl.steps.length : 1;
  const actionsList = tmpl.cascadeActions || (tmpl as any).cascades || [];
  const automatedCascades = actionsList.length;
  const clicksSaved = Math.max(1, previousClicks - workflowSteps);
  const targetModules = Array.from(new Set(actionsList.map((a: any) => String(a.targetModule || tmpl.category).toUpperCase())));
  return {
    id: tmpl.id,
    workflowId: tmpl.id,
    title: tmpl.title,
    actionName: tmpl.title,
    description: tmpl.shortDescription || "",
    category: tmpl.category,
    traditionalSteps: previousClicks,
    previousClicks,
    workflowSteps,
    clicksSaved,
    automatedCascades,
    automationCount: automatedCascades,
    timeSavedMinutes: Math.round(clicksSaved * 0.8),
    reductionSummary: tmpl.clickReductionRatio || `${clicksSaved} clicks saved`,
    crossModuleReach: targetModules.length > 0 ? targetModules : [tmpl.category.toUpperCase()],
  };
});




