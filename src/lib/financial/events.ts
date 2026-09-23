export type FinancialEventType =
  | "ExpenseCreated"
  | "RevenueCreated"
  | "JournalPosted"
  | "LoanCreated"
  | "LoanPaid"
  | "AssetPurchased"
  | "AssetDisposed"
  | "PartnerCreated"
  | "PartnerUpdated"
  | "PartnerArchived"
  | "PartnerInvestment"
  | "PartnerWithdrawal"
  | "CapitalAdjusted"
  | "ProfitDistributed"
  | "LossDistributed"
  | "SettlementCompleted"
  | "InventoryPurchased"
  | "SaleCompleted";

export interface FinancialEvent<T = Record<string, unknown>> {
  id: string;
  eventType: FinancialEventType;
  businessId: string;
  timestamp: string;
  payload: T;
  userId?: string | null;
}

type EventHandler<T = any> = (event: FinancialEvent<T>) => void | Promise<void>;

export class FinancialEventBus {
  private static handlers: Map<FinancialEventType, EventHandler[]> = new Map();

  public static subscribe<T = any>(eventType: FinancialEventType, handler: EventHandler<T>): () => void {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
    return () => {
      const current = this.handlers.get(eventType) || [];
      this.handlers.set(
        eventType,
        current.filter((h) => h !== handler)
      );
    };
  }

  public static async publish<T = Record<string, unknown>>(
    eventType: FinancialEventType,
    businessId: string,
    payload: T,
    userId?: string | null
  ): Promise<FinancialEvent<T>> {
    const event: FinancialEvent<T> = {
      id: `fe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventType,
      businessId,
      timestamp: new Date().toISOString(),
      payload,
      userId,
    };

    const handlers = this.handlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[FinancialEventBus] Handler error for ${eventType}:`, err);
      }
    }

    return event;
  }
}