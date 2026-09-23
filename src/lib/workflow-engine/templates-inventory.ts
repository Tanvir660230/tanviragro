import { WorkflowTemplate } from "./types";

export const INVENTORY_ADJUSTMENT_TEMPLATE: WorkflowTemplate = {
  id: "wf_inventory_adjustment",
  code: "INV-ADJ",
  title: "Inventory Stock Adjustment",
  shortDescription: "Reconcile physical stock count variance with reason code and shrinkage log",
  fullDescription: "Stock audit discrepancy adjustment. Reconciles theoretical system quantity with physical warehouse counts.",
  category: "inventory",
  icon: "Boxes",
  estimatedTimeMinutes: 2,
  tags: ["inventory", "adjustment", "shrinkage", "reconciliation"],
  roleAccess: ["owner", "manager"],
  isPinned: false,
  isFavorite: false,
  clickReductionRatio: "1 step vs 10 clicks",
  timeOfDaySuggestion: "anytime",
  steps: [
    {
      id: "step_inv_adj",
      title: "Item & Variance",
      description: "Select inventory item and physical counted balance",
      fields: [
        {
          id: "item_id",
          name: "item_id",
          label: "Inventory Product",
          type: "select",
          required: true,
          options: [
            { label: "Silage (Corn / Napier)", value: "item_silage" },
            { label: "TMR Feed", value: "item_tmr" },
          ],
        },
        {
          id: "counted_stock",
          name: "counted_stock",
          label: "Physical Count",
          type: "number",
          required: true,
          placeholder: "e.g. 4150",
        },
      ],
    },
  ],
  cascadeActions: [
    {
      id: "cascade_adj_update",
      type: "update_inventory",
      name: "Update Stock Balance",
      description: "Aligns stock with physical count",
      targetModule: "inventory",
      isCompensatable: true,
      executor: async (ctx) => ({
        success: true,
        actionId: "cascade_adj_update",
        actionType: "update_inventory",
        entityId: String(ctx.formData.item_id || "item_silage"),
        data: { newCount: ctx.formData.counted_stock },
        timestamp: new Date().toISOString(),
      }),
    },
  ],
  relatedEntitiesResolver: (data) => [
    {
      id: String(data.item_id || "item_silage"),
      entityType: "inventory_item",
      label: `Inventory: ${data.item_id || "Silage"}`,
      url: "/dashboard/inventory",
      module: "inventory",
    },
  ],
};
