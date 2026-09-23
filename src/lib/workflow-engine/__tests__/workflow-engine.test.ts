import { enterpriseWorkflowEngine } from "../engine";
import { WORKFLOW_CATALOG, QUICK_ACTION_MATRIX } from "../templates";

describe("Enterprise Workflow Engine", () => {
  const user = { userId: "user_1", userName: "Admin User", role: "manager" as const };
  const businessId = "biz_001";

  it("should have all registered workflows in catalog", () => {
    expect(WORKFLOW_CATALOG.length).toBeGreaterThanOrEqual(10);
    const ids = WORKFLOW_CATALOG.map((w) => w.id);
    expect(ids).toContain("wf_purchase_feed");
    expect(ids).toContain("wf_medicine_usage");
    expect(ids).toContain("wf_record_expense");
    expect(ids).toContain("wf_partner_investment");
    expect(ids).toContain("wf_sell_animal");
  });

  it("should provide complete Quick Action Matrix data", () => {
    expect(QUICK_ACTION_MATRIX.length).toBeGreaterThanOrEqual(10);
    const feedAction = QUICK_ACTION_MATRIX.find((a) => a.workflowId === "wf_purchase_feed");
    expect(feedAction).toBeDefined();
    expect(feedAction?.previousClicks).toBe(18);
    expect(feedAction?.workflowSteps).toBe(2);
    expect(feedAction?.automatedCascades).toBeGreaterThanOrEqual(3);
  });

  it("should create workflow instances with lifecycle tracking", () => {
    const inst = enterpriseWorkflowEngine.createInstance({
      templateId: "wf_purchase_feed",
      businessId,
      user,
    });
    expect(inst).toBeDefined();
    expect(inst.instanceId).toContain("wf_inst_");
    expect(inst.templateId).toBe("wf_purchase_feed");
    expect(inst.status).toBe("draft");
    expect(inst.currentStepIndex).toBe(0);
    expect(inst.timeline.length).toBeGreaterThan(0);
  });

  it("should execute steps and cascading automations with saga pattern", async () => {
    const inst = enterpriseWorkflowEngine.createInstance({
      templateId: "wf_purchase_feed",
      businessId,
      user,
    });

    const step1Result = await enterpriseWorkflowEngine.completeStep(
      inst.instanceId,
      {
        vendor_id: "v_bengal",
        item_id: "item_silage",
      },
      user
    );

    expect(step1Result.currentStepIndex).toBe(1);
    expect(step1Result.status).toBe("in_progress");

    const finalResult = await enterpriseWorkflowEngine.completeStep(
      inst.instanceId,
      {
        quantity_kg: 5000,
        total_amount_bdt: 125000,
        paid_amount_bdt: 125000,
      },
      user
    );

    expect(finalResult.status).toBe("completed");
    expect(finalResult.cascadeResults.length).toBeGreaterThanOrEqual(3);
    expect(finalResult.timeline.some((t) => t.type === "cascade_executed")).toBe(true);
    expect(finalResult.relatedEntities.length).toBeGreaterThan(0);
  });

  it("should support comments and draft state retrieval", () => {
    const inst = enterpriseWorkflowEngine.createInstance({
      templateId: "wf_purchase_feed",
      businessId,
      user,
    });

    enterpriseWorkflowEngine.saveDraft(inst.instanceId, { supplierName: "Agro Feeds Ltd" });
    const draft = enterpriseWorkflowEngine.getInstance(inst.instanceId);
    expect(draft?.formData.supplierName).toBe("Agro Feeds Ltd");

    const cmt = enterpriseWorkflowEngine.addComment(inst.instanceId, user, "Awaiting supplier delivery note");
    expect(cmt.content).toBe("Awaiting supplier delivery note");
    expect(draft?.comments.length).toBe(1);
  });

  it("should support favorites and template search filtering", () => {
    enterpriseWorkflowEngine.toggleFavorite("wf_purchase_feed");
    expect(enterpriseWorkflowEngine.isFavorite("wf_purchase_feed")).toBe(true);

    const searchResults = enterpriseWorkflowEngine.searchTemplates("vaccin");
    expect(searchResults.some((s) => s.id === "wf_vaccination")).toBe(true);

    const categoryFiltered = enterpriseWorkflowEngine.searchTemplates("", "inventory");
    expect(categoryFiltered.every((s) => s.category === "inventory")).toBe(true);
  });
});



