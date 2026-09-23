export type InventoryEventType =
  | "StockReceived"
  | "StockIssued"
  | "StockAdjusted"
  | "StockTransferred"
  | "BatchCreated"
  | "BatchExpired"
  | "FeedMixed"
  | "DailyFeedDeducted"
  | "ItemArchived"
  | "ItemRestored";

export interface InventoryEvent<T = Record<string, unknown>> {
  id: string;
  type: InventoryEventType;
  businessId: string;
  payload: T;
  userId?: string;
  timestamp: string;
}

type InventoryEventHandler<T = any> = (event: InventoryEvent<T>) => void | Promise<void>;

/**
 * Enterprise Inventory Event Bus
 * Dispatches domain lifecycle events across the inventory platform.
 */
export class InventoryEventBus {
  private static subscribers = new Map<InventoryEventType, Set<InventoryEventHandler>>();

  public static subscribe<T = any>(type: InventoryEventType, handler: InventoryEventHandler<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler);
    return () => {
      this.subscribers.get(type)?.delete(handler);
    };
  }

  public static async publish<T = Record<string, unknown>>(
    type: InventoryEventType,
    businessId: string,
    payload: T,
    userId?: string
  ): Promise<void> {
    const event: InventoryEvent<T> = {
      id: `INV-EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      businessId,
      payload,
      userId,
      timestamp: new Date().toISOString(),
    };

    const handlers = this.subscribers.get(type);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[InventoryEventBus] Error handling event ${type}:`, err);
        }
      }
    }
  }
}