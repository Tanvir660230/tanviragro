import { ReservationConflictError } from "./errors";

export interface StockReservationRecord {
  id: string;
  businessId: string;
  itemId: string;
  reservedQty: number;
  purpose: "planned_ration" | "pending_mix" | "reserved_sale" | "quarantine";
  expiresAt?: string;
  createdAt: string;
}

/**
 * Enterprise Stock Reservation Engine
 * Tracks active stock allocations to prevent double-promising inventory.
 */
export class ReservationEngine {
  private static reservations = new Map<string, StockReservationRecord[]>();

  /**
   * Creates a temporary stock reservation.
   */
  public static reserveStock(
    businessId: string,
    itemId: string,
    itemName: string,
    qty: number,
    purpose: StockReservationRecord["purpose"],
    currentAvailableStock: number
  ): StockReservationRecord {
    if (qty > currentAvailableStock) {
      throw new ReservationConflictError(itemName, qty, currentAvailableStock);
    }

    const reservation: StockReservationRecord = {
      id: `RES-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      businessId,
      itemId,
      reservedQty: qty,
      purpose,
      createdAt: new Date().toISOString(),
    };

    const existing = this.reservations.get(itemId) || [];
    this.reservations.set(itemId, [...existing, reservation]);
    return reservation;
  }

  /**
   * Releases an existing stock reservation.
   */
  public static releaseReservation(itemId: string, reservationId: string): void {
    const existing = this.reservations.get(itemId) || [];
    this.reservations.set(
      itemId,
      existing.filter((r) => r.id !== reservationId)
    );
  }

  /**
   * Gets total active reserved quantity for an item.
   */
  public static getReservedQty(itemId: string): number {
    const list = this.reservations.get(itemId) || [];
    return list.reduce((sum, r) => sum + r.reservedQty, 0);
  }
}