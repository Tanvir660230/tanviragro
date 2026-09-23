import { WorkflowTemplate } from "./types";

export const PARTNER_INVESTMENT_TEMPLATE: WorkflowTemplate = {
  id: "wf_partner_investment",
  code: "PTR-01",
  title: "Partner Capital Deposit",
  shortDescription: "Record partner investment, equity balance update, and bank deposit",
  fullDescription: "Capital infusion workflow. Updates equity capital ledger and records treasury deposit.",
  category: "partner",
  icon: "Users",
  estimatedTimeMinutes: 3,
  tags: ["partner", "investment", "equity", "capital"],
  roleAccess: ["owner", "accountant"],
  isPinned: false,
  isFavorite: false,
  clickReductionRatio: "2 steps vs 16 clicks",
  timeOfDaySuggestion: "anytime",
  steps: [
    {
      id: "step_ptr_inv",
      title: "Partner & Capital Amount",
      description: "Select partner and deposit amount",
      fields: [
        {
          id: "partner_id",
          name: "partner_id",
          label: "Partner Name",
          type: "select",
          required: true,
          options: [
            { label: "Tanvir Ahmed (Managing Partner)", value: "ptr_tanvir" },
            { label: "Dr. Mahbub Rahman (Silent Partner)", value: "ptr_mahbub" },
          ],
        },
        {
          id: "amount_bdt",
          name: "amount_bdt",
          label: "Capital Investment (BDT)",
          type: "currency",
          required: true,
          placeholder: "e.g. 500000",
        },
      ],
    },
  ],
  cascadeActions: [
    {
      id: "cascade_ptr_equity",
      type: "update_partner_balance",
      name: "Update Partner Equity",
      description: "Credits partner equity ledger balance",
      targetModule: "partner",
      isCompensatable: true,
      executor: async (ctx) => ({
        success: true,
        actionId: "cascade_ptr_equity",
        actionType: "update_partner_balance",
        entityId: String(ctx.formData.partner_id || "ptr_tanvir"),
        data: { capitalAdded: ctx.formData.amount_bdt },
        timestamp: new Date().toISOString(),
      }),
    },
  ],
  relatedEntitiesResolver: (data) => [
    {
      id: String(data.partner_id || "ptr_tanvir"),
      entityType: "partner",
      label: `Partner: ${data.partner_id || "Tanvir"}`,
      url: "/dashboard/partners",
      module: "partner",
    },
  ],
};

export const LOAN_PAYMENT_TEMPLATE: WorkflowTemplate = {
  id: "wf_loan_payment",
  code: "LOAN-01",
  title: "Bank Loan Repayment",
  shortDescription: "Record loan EMI installment, split principal vs interest, and update balance",
  fullDescription: "Debt service workflow. Updates liability ledger and bank accounts.",
  category: "finance",
  icon: "Landmark",
  estimatedTimeMinutes: 2,
  tags: ["loan", "debt", "bank", "installment"],
  roleAccess: ["owner", "accountant"],
  isPinned: false,
  isFavorite: false,
  clickReductionRatio: "1 step vs 14 clicks",
  timeOfDaySuggestion: "anytime",
  steps: [
    {
      id: "step_loan_pay",
      title: "Loan Installment",
      description: "Select lender and installment amount",
      fields: [
        {
          id: "loan_id",
          name: "loan_id",
          label: "Bank / Microfinance Loan",
          type: "select",
          required: true,
          options: [
            { label: "IBBL Agri-Term Loan (#LN-992)", value: "ln_ibbl_992" },
            { label: "BRAC Agro Facility (#LN-331)", value: "ln_brac_331" },
          ],
        },
        {
          id: "payment_amount_bdt",
          name: "payment_amount_bdt",
          label: "Installment (BDT)",
          type: "currency",
          required: true,
          placeholder: "e.g. 50000",
        },
      ],
    },
  ],
  cascadeActions: [
    {
      id: "cascade_loan_entry",
      type: "post_journal_entry",
      name: "Loan Ledger Adjustment",
      description: "Reduces outstanding principal liability",
      targetModule: "accounting",
      isCompensatable: true,
      executor: async (ctx) => ({
        success: true,
        actionId: "cascade_loan_entry",
        actionType: "post_journal_entry",
        entityId: String(ctx.formData.loan_id || "ln_ibbl_992"),
        data: { paid: ctx.formData.payment_amount_bdt },
        timestamp: new Date().toISOString(),
      }),
    },
  ],
  relatedEntitiesResolver: (data) => [
    {
      id: String(data.loan_id || "ln_ibbl_992"),
      entityType: "loan",
      label: `Loan: ${data.loan_id || "IBBL Loan"}`,
      url: "/dashboard/finance/loans",
      module: "finance",
    },
  ],
};
