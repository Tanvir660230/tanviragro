import {
  WorkflowTemplate,
  WorkflowInstance,
  WorkflowLifecycleStatus,
  WorkflowExecutionContext,
  CascadeActionResult,
  WorkflowTimelineEvent,
  WorkflowComment,
  WorkflowAttachment,
  ApprovalRecord,
  UserRole,
  WorkflowCategory,
} from "./types";
import { ALL_WORKFLOW_TEMPLATES, QUICK_ACTION_MATRIX } from "./templates";

export class EnterpriseWorkflowEngine {
  private static instance: EnterpriseWorkflowEngine;
  private templates: Map<string, WorkflowTemplate> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();
  private userFavorites: Set<string> = new Set();
  private recentTemplateIds: string[] = [];

  private constructor() {
    this.registerTemplates(ALL_WORKFLOW_TEMPLATES);
  }

  public static getInstance(): EnterpriseWorkflowEngine {
    if (!EnterpriseWorkflowEngine.instance) {
      EnterpriseWorkflowEngine.instance = new EnterpriseWorkflowEngine();
    }
    return EnterpriseWorkflowEngine.instance;
  }

  public registerTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  public registerTemplates(templates: WorkflowTemplate[]): void {
    for (const t of templates) {
      this.templates.set(t.id, t);
    }
  }

  public getTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  public getAllTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplatesByCategory(category: WorkflowCategory): WorkflowTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  public getPinnedTemplates(): WorkflowTemplate[] {
    return this.getAllTemplates().filter((t) => t.isPinned);
  }

  public getSuggestedTemplates(context?: {
    role?: UserRole;
    timeOfDay?: "morning" | "afternoon" | "evening";
  }): WorkflowTemplate[] {
    const time = context?.timeOfDay || (new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening");
    const role = context?.role;

    return this.getAllTemplates().filter((t) => {
      const matchRole = !role || t.roleAccess.includes(role);
      const matchTime = !t.timeOfDaySuggestion || t.timeOfDaySuggestion === "anytime" || t.timeOfDaySuggestion === time;
      return matchRole && (matchTime || t.isPinned);
    });
  }

  public searchTemplates(query: string, category?: WorkflowCategory): WorkflowTemplate[] {
    const q = query.toLowerCase().trim();
    return this.getAllTemplates().filter((t) => {
      const matchesCategory = !category || category === ("all" as unknown) || t.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }

  public toggleFavorite(templateId: string): boolean {
    if (this.userFavorites.has(templateId)) {
      this.userFavorites.delete(templateId);
      return false;
    } else {
      this.userFavorites.add(templateId);
      return true;
    }
  }

  public isFavorite(templateId: string): boolean {
    return this.userFavorites.has(templateId);
  }

  public recordRecent(templateId: string): void {
    this.recentTemplateIds = [templateId, ...this.recentTemplateIds.filter((id) => id !== templateId)].slice(0, 8);
  }

  public getRecentTemplates(): WorkflowTemplate[] {
    return this.recentTemplateIds
      .map((id) => this.templates.get(id))
      .filter((t): t is WorkflowTemplate => t !== undefined);
  }
  // ── Workflow Instance Lifecycle ───────────────────────────────────
  public createInstance(params: {
    templateId: string;
    businessId: string;
    user: { userId: string; userName: string; role: UserRole };
    initialData?: Record<string, unknown>;
  }): WorkflowInstance {
    const template = this.templates.get(params.templateId);
    if (!template) {
      throw new Error(`Workflow template not found: ${params.templateId}`);
    }

    const instanceId = `wf_inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const createdEvent: WorkflowTimelineEvent = {
      id: `tl_${Date.now()}_1`,
      type: "created",
      title: "Workflow Initiated",
      description: `Workflow '${template.title}' initiated by ${params.user.userName}`,
      actor: params.user,
      timestamp: now,
    };

    const instance: WorkflowInstance = {
      instanceId,
      templateId: template.id,
      templateCode: template.code,
      title: template.title,
      category: template.category,
      businessId: params.businessId,
      createdBy: params.user,
      createdAt: now,
      updatedAt: now,
      status: "draft",
      currentStepIndex: 0,
      formData: params.initialData || {},
      stepResults: {},
      cascadeResults: [],
      timeline: [createdEvent],
      comments: [],
      attachments: [],
      approvals: [],
      relatedEntities: template.relatedEntitiesResolver ? template.relatedEntitiesResolver(params.initialData || {}) : [],
    };

    this.instances.set(instanceId, instance);
    this.recordRecent(template.id);
    return instance;
  }

  public saveDraft(instanceId: string, formData: Record<string, unknown>): WorkflowInstance {
    const inst = this.getInstanceOrThrow(instanceId);
    inst.formData = { ...inst.formData, ...formData };
    inst.updatedAt = new Date().toISOString();
    return inst;
  }

  public async completeStep(
    instanceId: string,
    stepData: Record<string, unknown>,
    user: { userId: string; userName: string; role: UserRole }
  ): Promise<WorkflowInstance> {
    const inst = this.getInstanceOrThrow(instanceId);
    const template = this.templates.get(inst.templateId)!;
    const now = new Date().toISOString();

    inst.formData = { ...inst.formData, ...stepData };
    inst.status = "in_progress";
    inst.updatedAt = now;

    const currentStep = template.steps[inst.currentStepIndex];
    inst.timeline.push({
      id: `tl_${Date.now()}_step`,
      type: "step_completed",
      title: `Step Completed: ${currentStep?.title || `Step ${inst.currentStepIndex + 1}`}`,
      description: `Completed by ${user.userName}`,
      actor: user,
      timestamp: now,
    });

    if (inst.currentStepIndex + 1 < template.steps.length) {
      inst.currentStepIndex += 1;
      return inst;
    }

    if (template.approvalRequirement) {
      const req = template.approvalRequirement;
      const amount = Number(inst.formData.amount_bdt || inst.formData.total_amount_bdt || 0);
      const requiresApproval = !req.autoApproveBelowAmount || amount > req.autoApproveBelowAmount;

      if (requiresApproval) {
        inst.status = "pending";
        inst.timeline.push({
          id: `tl_${Date.now()}_app_req`,
          type: "approval_requested",
          title: "Approval Requested",
          description: req.conditionDescription || `Awaiting approval from ${req.requiredRole.join(", ")}`,
          actor: user,
          timestamp: now,
        });
        return inst;
      }
    }

    return await this.finalizeAndExecuteCascades(inst, user);
  }

  public async approve(
    instanceId: string,
    user: { userId: string; userName: string; role: UserRole },
    comment?: string
  ): Promise<WorkflowInstance> {
    const inst = this.getInstanceOrThrow(instanceId);
    const now = new Date().toISOString();

    const approval: ApprovalRecord = {
      id: `appr_${Date.now()}`,
      userId: user.userId,
      userName: user.userName,
      userRole: user.role,
      status: "approved",
      comment,
      timestamp: now,
    };
    inst.approvals.push(approval);

    inst.timeline.push({
      id: `tl_${Date.now()}_approved`,
      type: "approved",
      title: "Workflow Approved",
      description: `Approved by ${user.userName} (${user.role})${comment ? `: "${comment}"` : ""}`,
      actor: user,
      timestamp: now,
    });

    return await this.finalizeAndExecuteCascades(inst, user);
  }

  public reject(
    instanceId: string,
    user: { userId: string; userName: string; role: UserRole },
    reason: string
  ): WorkflowInstance {
    const inst = this.getInstanceOrThrow(instanceId);
    const now = new Date().toISOString();

    inst.status = "rejected";
    inst.updatedAt = now;
    inst.approvals.push({
      id: `appr_${Date.now()}`,
      userId: user.userId,
      userName: user.userName,
      userRole: user.role,
      status: "rejected",
      comment: reason,
      timestamp: now,
    });

    inst.timeline.push({
      id: `tl_${Date.now()}_rejected`,
      type: "rejected",
      title: "Workflow Rejected",
      description: `Rejected by ${user.userName}: ${reason}`,
      actor: user,
      timestamp: now,
    });

    return inst;
  }
  public cancel(
    instanceId: string,
    user: { userId: string; userName: string; role: UserRole },
    reason?: string
  ): WorkflowInstance {
    const inst = this.getInstanceOrThrow(instanceId);
    inst.status = "cancelled";
    inst.updatedAt = new Date().toISOString();
    inst.timeline.push({
      id: `tl_${Date.now()}_cancelled`,
      type: "status_changed",
      title: "Workflow Cancelled",
      description: `Cancelled by ${user.userName}${reason ? `: ${reason}` : ""}`,
      actor: user,
      timestamp: new Date().toISOString(),
    });
    return inst;
  }

  private async finalizeAndExecuteCascades(
    inst: WorkflowInstance,
    user: { userId: string; userName: string; role: UserRole }
  ): Promise<WorkflowInstance> {
    const template = this.templates.get(inst.templateId)!;
    const now = new Date().toISOString();

    const ctx: WorkflowExecutionContext = {
      instanceId: inst.instanceId,
      templateId: inst.templateId,
      businessId: inst.businessId,
      userId: user.userId,
      userName: user.userName,
      userRole: user.role,
      formData: inst.formData,
      stepResults: inst.stepResults,
      timestamp: now,
    };

    const executedResults: CascadeActionResult[] = [];
    let cascadeFailed = false;

    for (const cascade of template.cascadeActions) {
      try {
        const result = await cascade.executor(ctx, inst.formData);
        executedResults.push(result);

        inst.timeline.push({
          id: `tl_${Date.now()}_casc_${cascade.id}`,
          type: "cascade_executed",
          title: `Automated: ${cascade.name}`,
          description: cascade.description,
          actor: { userId: "system", userName: "Workflow Engine", role: "system" },
          timestamp: new Date().toISOString(),
          metadata: { actionId: cascade.id, targetModule: cascade.targetModule },
        });

        if (!result.success) {
          cascadeFailed = true;
          break;
        }
      } catch (err) {
        cascadeFailed = true;
        executedResults.push({
          success: false,
          actionId: cascade.id,
          actionType: cascade.type,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    if (cascadeFailed) {
      for (const res of executedResults.filter((r) => r.success).reverse()) {
        const cascadeDef = template.cascadeActions.find((c) => c.id === res.actionId);
        if (cascadeDef?.compensator) {
          try {
            await cascadeDef.compensator(ctx, inst.formData, res);
            inst.timeline.push({
              id: `tl_${Date.now()}_rb_${res.actionId}`,
              type: "cascade_rolled_back",
              title: `Rollback: ${cascadeDef.name}`,
              description: "Compensating action executed successfully",
              actor: { userId: "system", userName: "Workflow Engine", role: "system" },
              timestamp: new Date().toISOString(),
            });
          } catch {
            // ignore compensation failure
          }
        }
      }
      inst.status = "rejected";
    } else {
      inst.status = "completed";
      inst.completedAt = new Date().toISOString();
    }

    inst.cascadeResults = executedResults;
    if (template.relatedEntitiesResolver) {
      inst.relatedEntities = template.relatedEntitiesResolver(inst.formData);
    }
    inst.updatedAt = new Date().toISOString();
    return inst;
  }

  public addComment(
    instanceId: string,
    user: { userId: string; userName: string; role: UserRole },
    content: string
  ): WorkflowComment {
    const inst = this.getInstanceOrThrow(instanceId);
    const comment: WorkflowComment = {
      id: `cmt_${Date.now()}`,
      userId: user.userId,
      userName: user.userName,
      userRole: user.role,
      content,
      createdAt: new Date().toISOString(),
    };
    inst.comments.push(comment);
    inst.timeline.push({
      id: `tl_${Date.now()}_cmt`,
      type: "comment_added",
      title: "Comment Added",
      description: `${user.userName}: "${content.substring(0, 60)}"`,
      actor: user,
      timestamp: comment.createdAt,
    });
    return comment;
  }

  public addAttachment(
    instanceId: string,
    user: { userId: string; userName: string; role: UserRole },
    file: { name: string; url: string; sizeBytes: number; mimeType: string }
  ): WorkflowAttachment {
    const inst = this.getInstanceOrThrow(instanceId);
    const attachment: WorkflowAttachment = {
      id: `att_${Date.now()}`,
      ...file,
      uploadedBy: user.userName,
      uploadedAt: new Date().toISOString(),
    };
    inst.attachments.push(attachment);
    inst.timeline.push({
      id: `tl_${Date.now()}_att`,
      type: "file_attached",
      title: "File Attached",
      description: `Attached ${file.name} by ${user.userName}`,
      actor: user,
      timestamp: attachment.uploadedAt,
    });
    return attachment;
  }

  public getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  public getInstances(filter?: { status?: WorkflowLifecycleStatus; category?: WorkflowCategory }): WorkflowInstance[] {
    let list = Array.from(this.instances.values());
    if (filter?.status) list = list.filter((i) => i.status === filter.status);
    if (filter?.category) list = list.filter((i) => i.category === filter.category);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getQuickActionMatrix(): typeof QUICK_ACTION_MATRIX {
    return QUICK_ACTION_MATRIX;
  }

  private getInstanceOrThrow(instanceId: string): WorkflowInstance {
    const inst = this.instances.get(instanceId);
    if (!inst) throw new Error(`Workflow instance not found: ${instanceId}`);
    return inst;
  }
}

export const enterpriseWorkflowEngine = EnterpriseWorkflowEngine.getInstance();
