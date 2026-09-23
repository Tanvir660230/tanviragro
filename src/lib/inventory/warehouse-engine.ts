export interface WarehouseLocation {
  id: string;
  businessId: string;
  name: string;
  code: string;
  isDefault: boolean;
  type: "main_barn" | "silo" | "feed_store" | "medicine_cabinet" | "cold_storage" | "transit";
  capacityKg?: number;
}

/**
 * Enterprise Warehouse & Location Engine
 * Manages agricultural warehouse allocations, silo storage, and multi-location transfers.
 */
export class WarehouseEngine {
  private static readonly DEFAULT_LOCATIONS: WarehouseLocation[] = [
    { id: "wh-feed-store", businessId: "default", name: "Main Feed Store", code: "FEED-01", isDefault: true, type: "feed_store" },
    { id: "wh-silo-1", businessId: "default", name: "Silage Bunker 1", code: "SILO-01", isDefault: false, type: "silo" },
    { id: "wh-med-cabinet", businessId: "default", name: "Veterinary Cabinet", code: "MED-01", isDefault: false, type: "medicine_cabinet" },
  ];

  /**
   * Returns standard warehouse locations for a business.
   */
  public static getWarehousesForBusiness(businessId: string): WarehouseLocation[] {
    return this.DEFAULT_LOCATIONS.map((w) => ({
      ...w,
      businessId,
    }));
  }

  /**
   * Validates internal stock transfer between locations.
   */
  public static validateTransfer(
    fromLocationId: string,
    toLocationId: string,
    transferQty: number,
    availableSourceQty: number
  ): { isValid: boolean; error?: string } {
    if (fromLocationId === toLocationId) {
      return { isValid: false, error: "Source and destination warehouse cannot be the same" };
    }
    if (transferQty <= 0) {
      return { isValid: false, error: "Transfer quantity must be greater than zero" };
    }
    if (transferQty > availableSourceQty) {
      return {
        isValid: false,
        error: `Insufficient stock in source warehouse (requested ${transferQty}, available ${availableSourceQty})`,
      };
    }
    return { isValid: true };
  }
}