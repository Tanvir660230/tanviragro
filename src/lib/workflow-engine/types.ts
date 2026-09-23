/**
 * Tanvir Agro ERP — Enterprise Workflow Engine Types
 */

export type WorkflowLifecycleStatus =
  | "draft"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected"
  | "archived";

export type WorkflowCategory =
  | "livestock"
  | "inventory"
  | "finance"
  | "accounting"
  | "partner"
  | "operations";

export type UserRole = "owner" | "manager" | "accountant" | "veterinarian" | "worker" | "system";

export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "select"
  | "multiselect"
  | "date"
  | "textarea"
  | "boolean"
  | "file"
  | "entity_picker";

export interface WorkflowFieldOption {
  label: string;
  value: string | number;
  description?: string;
  badge?: string;
}

export interface WorkflowFormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helperText?: string;
  options?: WorkflowFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  entityType?: "cattle" | "inventory_item" | "vendor" | "partner" | "account" | "loan";
  dependsOn?: {
    fieldId: string;
    value: unknown;
  };
  validationRule?: (value: unknown, allValues: Record<string, unknown>) => string | null;
}

export interface WorkflowStepDefinition {
  id: string;
  title: string;
  description: string;
  fields: WorkflowFormField[];
  isAutomated?: boolean;
  automatedActionId?: string;
  optional?: boolean;
}

export type CascadeActionType =
  | "update_inventory"
  | "record_expense"
  | "record_income"
  | "update_supplier_balance"
  | "update_partner_balance"
  | "update_cattle_status"
  | "update_cattle_weight"
  | "schedule_health_protocol"
  | "post_journal_entry"
  | "log_activity"
  | "dispatch_notification"
  | "trigger_webhook";

export interface CascadeActionResult {
  success: boolean;
  actionId: string;
  actionType: CascadeActionType;
  entityId?: string;
  entityType?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export interface CascadeActionDefinition {
  id: string;
  type: CascadeActionType;
  name: string;
  description: string;
  targetModule: WorkflowCategory;
  isCompensatable: boolean;
  executor: (
    context: WorkflowExecutionContext,
    payload: Record<string, unknown>
  ) => Promise<CascadeActionResult>;
  compensator?: (
    context: WorkflowExecutionContext,
    payload: Record<string, unknown>,
    result: CascadeActionResult
  ) => Promise<boolean>;
}

export interface RelatedEntityReference {
  id: string;
  entityType: "cattle" | "inventory_item" | "expense" | "income" | "vendor" | "partner" | "loan" | "journal_entry" | "notification";
  label: string;
  url: string;
  description?: string;
  module: WorkflowCategory;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRequirement {
  requiredRole: UserRole[];
  minApprovalCount: number;
  conditionDescription?: string;
  autoApproveBelowAmount?: number;
}

export interface ApprovalRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  status: "approved" | "rejected" | "pending";
  comment?: string;
  timestamp: string;
}

export interface WorkflowTimelineEvent {
  id: string;
  type:
    | "created"
    | "status_changed"
    | "step_started"
    | "step_completed"
    | "approval_requested"
    | "approved"
    | "rejected"
    | "cascade_executed"
    | "cascade_rolled_back"
    | "comment_added"
    | "file_attached";
  title: string;
  description: string;
  actor: {
    userId: string;
    userName: string;
    role: UserRole;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowComment {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar?: string;
  content: string;
  createdAt: string;
  attachments?: WorkflowAttachment[];
}

export interface WorkflowAttachment {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface WorkflowTemplate {
  id: string;
  code: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: WorkflowCategory;
  icon: string;
  estimatedTimeMinutes: number;
  tags: string[];
  roleAccess: UserRole[];
  isPinned?: boolean;
  isFavorite?: boolean;
  clickReductionRatio: string;
  timeOfDaySuggestion?: "morning" | "afternoon" | "evening" | "anytime";
  steps: WorkflowStepDefinition[];
  cascadeActions: CascadeActionDefinition[];
  approvalRequirement?: ApprovalRequirement;
  relatedEntitiesResolver?: (data: Record<string, unknown>) => RelatedEntityReference[];
}

export interface WorkflowInstance {
  instanceId: string;
  templateId: string;
  templateCode: string;
  title: string;
  category: WorkflowCategory;
  businessId: string;
  createdBy: {
    userId: string;
    userName: string;
    role: UserRole;
  };
  createdAt: string;
  updatedAt: string;
  status: WorkflowLifecycleStatus;
  currentStepIndex: number;
  formData: Record<string, unknown>;
  stepResults: Record<string, unknown>;
  cascadeResults: CascadeActionResult[];
  timeline: WorkflowTimelineEvent[];
  comments: WorkflowComment[];
  attachments: WorkflowAttachment[];
  approvals: ApprovalRecord[];
  relatedEntities: RelatedEntityReference[];
  completedAt?: string;
}

export interface WorkflowExecutionContext {
  instanceId: string;
  templateId: string;
  businessId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  formData: Record<string, unknown>;
  stepResults: Record<string, unknown>;
  timestamp: string;
}

export interface QuickActionMatrixItem {
  id: string;
  workflowId: string;
  title: string;
  actionName: string;
  description: string;
  category: WorkflowCategory;
  traditionalSteps: number;
  previousClicks: number;
  workflowSteps: number;
  clicksSaved: number;
  automatedCascades: number;
  automationCount: number;
  timeSavedMinutes: number;
  reductionSummary: string;
  crossModuleReach: string[];
}
