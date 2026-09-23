/**
 * Tanvir Agro ERP — In-Memory / Async Event Bus
 * Non-blocking event dispatch with subscriber isolation, error containment, and execution audit.
 */

import { DomainEvent, DomainEventType } from "./types";

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

interface Subscription {
  id: string;
  eventType: DomainEventType | "*";
  handler: EventHandler<any>;
}

class EventBus {
  private static instance: EventBus;
  private subscriptions: Map<string, Subscription> = new Map();
  private eventHistory: DomainEvent[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe a handler to a specific event type or all events ('*')
   */
  public subscribe<T extends DomainEvent = DomainEvent>(
    eventType: DomainEventType | "*",
    handler: EventHandler<T>
  ): () => void {
    const id = `${eventType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.subscriptions.set(id, { id, eventType, handler });
    
    // Unsubscribe callback
    return () => {
      this.subscriptions.delete(id);
    };
  }

  /**
   * Publish a domain event asynchronously to all matching subscribers.
   * Isolates failures so one failing handler does not disrupt others or the calling business flow.
   */
  public async publish(event: DomainEvent): Promise<void> {
    // Record in circular audit buffer
    this.recordEvent(event);

    const matchingSubs: Subscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.eventType === "*" || sub.eventType === event.eventType) {
        matchingSubs.push(sub);
      }
    }

    if (matchingSubs.length === 0) {
      return;
    }

    // Execute handlers in parallel with individual error boundaries
    await Promise.allSettled(
      matchingSubs.map(async (sub) => {
        try {
          await sub.handler(event);
        } catch (err) {
          console.error(`[EventBus] Handler error for event ${event.eventType} (sub ${sub.id}):`, err);
        }
      })
    );
  }

  /**
   * Synchronous non-blocking publish trigger
   */
  public emit(event: DomainEvent): void {
    // Non-blocking fire & forget
    void this.publish(event);
  }

  private recordEvent(event: DomainEvent): void {
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }
  }

  /**
   * Retrieve recent event history for auditing and diagnostics
   */
  public getRecentEvents(): readonly DomainEvent[] {
    return this.eventHistory;
  }

  /**
   * Clear subscriptions (useful for tests or hot reload resets)
   */
  public clear(): void {
    this.subscriptions.clear();
  }
}

export const eventBus = EventBus.getInstance();
