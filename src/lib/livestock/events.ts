export type LivestockEventType =
  | "CattleRegistered"
  | "WeightRecorded"
  | "HealthEventScheduled"
  | "HealthEventCompleted"
  | "VaccinationCompleted"
  | "TreatmentRecorded"
  | "BreedingInseminated"
  | "PregnancyConfirmed"
  | "CalfDelivered"
  | "StatusChanged"
  | "CattleSold"
  | "CattleDeceased"
  | "CommerceOrderCreated"
  | "CommercePurchaseApproved"
  | "CommerceAnimalArrived"
  | "CommerceTransferDispatched"
  | "CommerceTransferCompleted"
  | "CommerceSaleCompleted"
  | "CommercePaymentReceived"
  | "OwnershipTransferred";

export interface LivestockDomainEvent<T = any> {
  type: LivestockEventType;
  businessId: string;
  cattleId: string;
  payload: T;
  timestamp: string;
  userId?: string;
}

export type LivestockEventHandler<T = any> = (event: LivestockDomainEvent<T>) => void | Promise<void>;

/**
 * Livestock Event Bus
 * Publishes life-cycle, health, and weight events.
 */
export class LivestockEventBus {
  private static subscribers: Map<LivestockEventType, Set<LivestockEventHandler>> = new Map();

  public static subscribe<T = any>(
    type: LivestockEventType,
    handler: LivestockEventHandler<T>
  ): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler as LivestockEventHandler);

    return () => {
      this.subscribers.get(type)?.delete(handler as LivestockEventHandler);
    };
  }

  public static async publish<T = any>(
    type: LivestockEventType,
    businessId: string,
    cattleId: string,
    payload: T,
    userId?: string
  ): Promise<void> {
    const event: LivestockDomainEvent<T> = {
      type,
      businessId,
      cattleId,
      payload,
      timestamp: new Date().toISOString(),
      userId,
    };

    const handlers = this.subscribers.get(type);
    if (handlers && handlers.size > 0) {
      for (const handler of Array.from(handlers)) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[LivestockEventBus] Handler failed for ${type}:`, err);
        }
      }
    }
  }
}