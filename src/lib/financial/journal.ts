import type { JournalEntry, JournalPostingLine, FinancialTransactionSource } from "./types";
import { CHART_OF_ACCOUNTS, mapExpenseCategoryToAccount } from "./chart-of-accounts";
import { JournalImbalanceError } from "./errors";

export class JournalEngine {
  /**
   * Validates that total debits match total credits (within floating point epsilon)
   */
  public static validateJournalEntry(entry: Omit<JournalEntry, "isBalanced" | "totalDebit" | "totalCredit">): JournalEntry {
    const totalDebit = Math.round(
      entry.lines.reduce((s, line) => s + (Number(line.debit) || 0), 0) * 100
    ) / 100;
    const totalCredit = Math.round(
      entry.lines.reduce((s, line) => s + (Number(line.credit) || 0), 0) * 100
    ) / 100;

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (!isBalanced) {
      throw new JournalImbalanceError(totalDebit, totalCredit);
    }

    return {
      ...entry,
      totalDebit,
      totalCredit,
      isBalanced: true,
    };
  }

  /**
   * Builds standardized double-entry journal for cattle purchase
   */
  public static createCattlePurchaseJournal(params: {
    businessId: string;
    cattleId: string;
    amount: number;
    date: string;
    tagId?: string;
    paymentAccount?: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "1200",
        accountName: CHART_OF_ACCOUNTS["1200"].name,
        debit: params.amount,
        credit: 0,
        notes: `Cattle purchase: Tag ${params.tagId ?? params.cattleId}`,
      },
      {
        accountCode: params.paymentAccount ?? "1010",
        accountName: CHART_OF_ACCOUNTS[params.paymentAccount ?? "1010"].name,
        debit: 0,
        credit: params.amount,
        notes: `Cash disbursement for cattle purchase`,
      },
    ];

    return this.validateJournalEntry({
      id: `je-cat-pur-${params.cattleId}`,
      businessId: params.businessId,
      referenceNumber: `CP-${params.cattleId.slice(0, 8)}`,
      sourceModule: "cattle_purchase",
      sourceEntityId: params.cattleId,
      transactionDate: params.date,
      description: `Purchase of cattle (Tag: ${params.tagId ?? params.cattleId})`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for cattle sale
   */
  public static createCattleSaleJournal(params: {
    businessId: string;
    saleId: string;
    cattleId: string;
    salePrice: number;
    purchaseCost: number;
    date: string;
    tagId?: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      // 1. Debit Cash for full sale price
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: params.salePrice,
        credit: 0,
        notes: `Cash received from sale`,
      },
      // 2. Credit Cattle Sales Revenue
      {
        accountCode: "4010",
        accountName: CHART_OF_ACCOUNTS["4010"].name,
        debit: 0,
        credit: params.salePrice,
        notes: `Revenue from cattle sale`,
      },
    ];

    return this.validateJournalEntry({
      id: `je-cat-sale-${params.saleId}`,
      businessId: params.businessId,
      referenceNumber: `CS-${params.saleId.slice(0, 8)}`,
      sourceModule: "cattle_sale",
      sourceEntityId: params.saleId,
      transactionDate: params.date,
      description: `Sale of cattle (Tag: ${params.tagId ?? params.cattleId})`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for cost / expense entries
   */
  public static createCostEntryJournal(params: {
    businessId: string;
    costId: string;
    amount: number;
    category: string;
    entryClass: "expense" | "asset";
    date: string;
    description?: string;
    userId?: string;
  }): JournalEntry {
    const isAsset = params.entryClass === "asset";
    const debitAccount = isAsset
      ? CHART_OF_ACCOUNTS["1500"]
      : mapExpenseCategoryToAccount(params.category);

    const lines: JournalPostingLine[] = [
      {
        accountCode: debitAccount.code,
        accountName: debitAccount.name,
        debit: params.amount,
        credit: 0,
        notes: params.description || `${params.category} cost entry`,
      },
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: 0,
        credit: params.amount,
        notes: `Cash payment for ${params.category}`,
      },
    ];

    return this.validateJournalEntry({
      id: `je-cost-${params.costId}`,
      businessId: params.businessId,
      referenceNumber: `EXP-${params.costId.slice(0, 8)}`,
      sourceModule: "cost_entry",
      sourceEntityId: params.costId,
      transactionDate: params.date,
      description: params.description || `${params.category} payment`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for partner transactions (investments/drawings)
   */
  public static createPartnerTransactionJournal(params: {
    businessId: string;
    transactionId: string;
    partnerId: string;
    partnerName: string;
    amount: number;
    type: "investment" | "draw" | "withdrawal" | "profit" | "loss_allocation";
    date: string;
    notes?: string;
    userId?: string;
  }): JournalEntry {
    let lines: JournalPostingLine[];

    if (params.type === "investment") {
      lines = [
        {
          accountCode: "1010",
          accountName: CHART_OF_ACCOUNTS["1010"].name,
          debit: params.amount,
          credit: 0,
          notes: `Capital contribution from ${params.partnerName}`,
        },
        {
          accountCode: "3010",
          accountName: CHART_OF_ACCOUNTS["3010"].name,
          debit: 0,
          credit: params.amount,
          notes: `Partner equity: ${params.partnerName}`,
        },
      ];
    } else {
      // Draw / Profit distribution
      lines = [
        {
          accountCode: "3020",
          accountName: CHART_OF_ACCOUNTS["3020"].name,
          debit: params.amount,
          credit: 0,
          notes: `Partner draw/distribution: ${params.partnerName}`,
        },
        {
          accountCode: "1010",
          accountName: CHART_OF_ACCOUNTS["1010"].name,
          debit: 0,
          credit: params.amount,
          notes: `Cash payout to ${params.partnerName}`,
        },
      ];
    }

    return this.validateJournalEntry({
      id: `je-ptxn-${params.transactionId}`,
      businessId: params.businessId,
      referenceNumber: `PTX-${params.transactionId.slice(0, 8)}`,
      sourceModule: params.type === "investment" ? "partner_investment" : "partner_draw",
      sourceEntityId: params.transactionId,
      transactionDate: params.date,
      description: `Partner ${params.type} by ${params.partnerName}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for partner profit or loss distribution
   */
  public static createPartnerDistributionJournal(params: {
    businessId: string;
    distributionId: string;
    totalAmount: number;
    isLoss: boolean;
    date: string;
    entries: { partnerId: string; partnerName: string; amount: number }[];
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [];

    if (params.isLoss) {
      for (const entry of params.entries) {
        lines.push({
          accountCode: "3010",
          accountName: CHART_OF_ACCOUNTS["3010"].name,
          debit: entry.amount,
          credit: 0,
          notes: `Loss allocation: ${entry.partnerName}`,
        });
      }
      lines.push({
        accountCode: "3200",
        accountName: CHART_OF_ACCOUNTS["3200"].name,
        debit: 0,
        credit: params.totalAmount,
        notes: `Total period loss allocated across ${params.entries.length} partners`,
      });
    } else {
      lines.push({
        accountCode: "3100",
        accountName: CHART_OF_ACCOUNTS["3100"].name,
        debit: params.totalAmount,
        credit: 0,
        notes: `Profit distribution declared`,
      });
      for (const entry of params.entries) {
        lines.push({
          accountCode: "1010",
          accountName: CHART_OF_ACCOUNTS["1010"].name,
          debit: 0,
          credit: entry.amount,
          notes: `Profit payout to ${entry.partnerName}`,
        });
      }
    }

    return this.validateJournalEntry({
      id: `je-dist-${params.distributionId}`,
      businessId: params.businessId,
      referenceNumber: `DIST-${params.distributionId.slice(0, 8)}`,
      sourceModule: params.isLoss ? "partner_loss_allocation" : "partner_profit_distribution",
      sourceEntityId: params.distributionId,
      transactionDate: params.date,
      description: `${params.isLoss ? "Loss allocation" : "Profit distribution"} of ৳${params.totalAmount}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for commercial orders (purchases or sales)
   */
  public static createCommerceOrderJournal(params: {
    businessId: string;
    orderId: string;
    orderNumber: string;
    orderType: "purchase" | "sale";
    counterpartyName: string;
    totalAmount: number;
    date: string;
    userId?: string;
  }): JournalEntry {
    const isPurchase = params.orderType === "purchase";
    const lines: JournalPostingLine[] = isPurchase
      ? [
          {
            accountCode: "1200", // Livestock Asset
            accountName: CHART_OF_ACCOUNTS["1200"].name,
            debit: params.totalAmount,
            credit: 0,
            notes: `Livestock inventory acquired from ${params.counterpartyName} (PO: ${params.orderNumber})`,
          },
          {
            accountCode: "2010", // Accounts Payable
            accountName: CHART_OF_ACCOUNTS["2010"].name,
            debit: 0,
            credit: params.totalAmount,
            notes: `Payable accrued to ${params.counterpartyName}`,
          },
        ]
      : [
          {
            accountCode: "1100", // Accounts Receivable
            accountName: CHART_OF_ACCOUNTS["1100"].name,
            debit: params.totalAmount,
            credit: 0,
            notes: `Receivable from ${params.counterpartyName} (Order: ${params.orderNumber})`,
          },
          {
            accountCode: "4010", // Cattle Sales Revenue
            accountName: CHART_OF_ACCOUNTS["4010"].name,
            debit: 0,
            credit: params.totalAmount,
            notes: `Commercial livestock sale revenue`,
          },
        ];

    return this.validateJournalEntry({
      id: `je-ord-${params.orderId}`,
      businessId: params.businessId,
      referenceNumber: `ORD-${params.orderNumber}`,
      sourceModule: "commerce_order",
      sourceEntityId: params.orderId,
      transactionDate: params.date,
      description: `Commerce ${params.orderType.toUpperCase()} - ${params.counterpartyName}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for commercial payments & settlements
   */
  public static createCommercePaymentJournal(params: {
    businessId: string;
    paymentId: string;
    paymentNumber: string;
    paymentType: "receipt" | "disbursement" | "refund" | "installment";
    counterpartyName: string;
    amount: number;
    accountCode?: string;
    date: string;
    userId?: string;
  }): JournalEntry {
    const isReceipt = params.paymentType === "receipt" || params.paymentType === "installment";
    const paymentAccountCode = params.accountCode || "1010";
    const paymentAccountName = CHART_OF_ACCOUNTS[paymentAccountCode]?.name || "Cash on Hand";

    const lines: JournalPostingLine[] = isReceipt
      ? [
          {
            accountCode: paymentAccountCode,
            accountName: paymentAccountName,
            debit: params.amount,
            credit: 0,
            notes: `Cash received from ${params.counterpartyName}`,
          },
          {
            accountCode: "1100", // Accounts Receivable
            accountName: CHART_OF_ACCOUNTS["1100"].name,
            debit: 0,
            credit: params.amount,
            notes: `Receivable settlement from ${params.counterpartyName}`,
          },
        ]
      : [
          {
            accountCode: "2010", // Accounts Payable
            accountName: CHART_OF_ACCOUNTS["2010"].name,
            debit: params.amount,
            credit: 0,
            notes: `Disbursement reducing payable to ${params.counterpartyName}`,
          },
          {
            accountCode: paymentAccountCode,
            accountName: paymentAccountName,
            debit: 0,
            credit: params.amount,
            notes: `Payment disbursed to ${params.counterpartyName}`,
          },
        ];

    return this.validateJournalEntry({
      id: `je-pay-${params.paymentId}`,
      businessId: params.businessId,
      referenceNumber: `PAY-${params.paymentNumber}`,
      sourceModule: "commerce_payment",
      sourceEntityId: params.paymentId,
      transactionDate: params.date,
      description: `Payment ${params.paymentType} - ${params.counterpartyName}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Builds standardized double-entry journal for transport & logistics expenses
   */
  public static createCommerceLogisticsJournal(params: {
    businessId: string;
    transferId: string;
    transferNumber: string;
    amount: number;
    routeDescription: string;
    date: string;
    userId?: string;
  }): JournalEntry {
    const lines: JournalPostingLine[] = [
      {
        accountCode: "6700", // Transport & Logistics
        accountName: CHART_OF_ACCOUNTS["6700"].name,
        debit: params.amount,
        credit: 0,
        notes: `Logistics cost: ${params.routeDescription} (Transfer: ${params.transferNumber})`,
      },
      {
        accountCode: "1010",
        accountName: CHART_OF_ACCOUNTS["1010"].name,
        debit: 0,
        credit: params.amount,
        notes: `Cash payment for livestock logistics`,
      },
    ];

    return this.validateJournalEntry({
      id: `je-trf-${params.transferId}`,
      businessId: params.businessId,
      referenceNumber: `TRF-${params.transferNumber}`,
      sourceModule: "commerce_logistics",
      sourceEntityId: params.transferId,
      transactionDate: params.date,
      description: `Logistics expense - ${params.routeDescription}`,
      lines,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    });
  }
}
