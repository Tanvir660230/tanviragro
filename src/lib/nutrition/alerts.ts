import {
  type FeedNutrientProfile,
  type FeedSession,
  type FeedConsumptionRecord,
  type NutritionAlert,
} from "./types";

export function evaluateAlerts(
  inventoryItems: FeedNutrientProfile[],
  sessions: FeedSession[],
  recentConsumption: FeedConsumptionRecord[],
  todayISO: string = new Date().toISOString().slice(0, 10)
): NutritionAlert[] {
  const alerts: NutritionAlert[] = [];

  for (const item of inventoryItems) {
    if (item.currentStockKg <= 0) {
      alerts.push({
        id: `alert-stockout-${item.id}`,
        type: "low_feed_stock",
        severity: "critical",
        title: `Feed Stockout: ${item.name}`,
        description: `Current balance is 0 kg. Animals scheduled for ${item.name} cannot be fed today.`,
        entityId: item.id,
        entityType: "item",
        timestamp: todayISO,
        recommendedAction: "Procure or substitute ingredient immediately.",
        actionHref: `/dashboard/inventory/purchase`,
      });
    } else if (item.lowStockThresholdKg != null && item.currentStockKg <= item.lowStockThresholdKg) {
      alerts.push({
        id: `alert-lowstock-${item.id}`,
        type: "low_feed_stock",
        severity: "warning",
        title: `Low Stock: ${item.name} (${Math.round(item.currentStockKg)} kg remaining)`,
        description: `Remaining stock is below threshold (${item.lowStockThresholdKg} kg). Reorder needed soon.`,
        entityId: item.id,
        entityType: "item",
        timestamp: todayISO,
        recommendedAction: "Create purchase order to replenish batch.",
        actionHref: `/dashboard/inventory/purchase`,
      });
    }

    if (item.expiryDate) {
      const daysToExpiry = Math.ceil(
        (new Date(item.expiryDate).getTime() - new Date(todayISO).getTime()) / (1000 * 3600 * 24)
      );
      if (daysToExpiry < 0) {
        alerts.push({
          id: `alert-expired-${item.id}`,
          type: "expired_feed",
          severity: "critical",
          title: `Expired Feed Batch: ${item.name}`,
          description: `Batch ${item.batchNumber || ""} expired on ${item.expiryDate}. Risk of mycotoxins.`,
          entityId: item.id,
          entityType: "item",
          timestamp: todayISO,
          recommendedAction: "Discard or return expired stock. Do not feed to livestock.",
          actionHref: `/dashboard/inventory`,
        });
      }
    }
  }

  for (const session of sessions) {
    if (session.dateISO < todayISO && session.status === "planned") {
      alerts.push({
        id: `alert-missed-session-${session.id}`,
        type: "missed_feeding",
        severity: "critical",
        title: `Missed Feeding Slot: ${session.slot.toUpperCase()} (${session.targetGroupOrPen})`,
        description: `Scheduled for ${session.dateISO} at ${session.scheduledTime} was never executed.`,
        entityId: session.id,
        entityType: "session",
        timestamp: session.dateISO,
        recommendedAction: "Log retroactive dispensation or mark session reason.",
      });
    }

    if (session.status === "completed" && session.actualTotalKg > 0) {
      const wasteRatio = session.totalWasteKg / session.actualTotalKg;
      if (wasteRatio > 0.08) {
        alerts.push({
          id: `alert-waste-${session.id}`,
          type: "high_feed_waste",
          severity: "warning",
          title: `High Feed Waste (${Math.round(wasteRatio * 100)}%) in ${session.slot} Slot`,
          description: `${session.totalWasteKg} kg wasted out of ${session.actualTotalKg} kg dispensed. Financial loss: ৳${Math.round(session.wasteCostBdt)}.`,
          entityId: session.id,
          entityType: "session",
          timestamp: session.dateISO,
          recommendedAction: "Inspect trough hygiene, bunk capacity, and palatability.",
        });
      }
    }
  }

  for (const rec of recentConsumption.slice(0, 50)) {
    if (rec.targetAsFedKg > 0 && rec.actualDispensedKg > 0) {
      const ratio = rec.actualDispensedKg / rec.targetAsFedKg;
      if (ratio > 1.25) {
        alerts.push({
          id: `alert-overfeed-${rec.id}`,
          type: "over_feeding",
          severity: "warning",
          title: `Over-Feeding Recorded: ${rec.tagId || "Animal"} (${Math.round(ratio * 100)}% of target)`,
          description: `Target was ${rec.targetAsFedKg} kg, but ${rec.actualDispensedKg} kg was dispensed. Risk of bloat.`,
          entityId: rec.cattleId,
          entityType: "cattle",
          timestamp: rec.recordedAt.slice(0, 10),
          recommendedAction: "Re-align feeder scale calibrations and train operators.",
        });
      } else if (ratio < 0.70 && rec.actualDispensedKg > 0) {
        alerts.push({
          id: `alert-underfeed-${rec.id}`,
          type: "under_feeding",
          severity: "warning",
          title: `Under-Feeding Recorded: ${rec.tagId || "Animal"} (${Math.round(ratio * 100)}% of target)`,
          description: `Target was ${rec.targetAsFedKg} kg, but only ${rec.actualDispensedKg} kg dispensed. ADG will stall.`,
          entityId: rec.cattleId,
          entityType: "cattle",
          timestamp: rec.recordedAt.slice(0, 10),
          recommendedAction: "Verify feed intake refusal and check animal for clinical signs.",
        });
      }
    }
  }

  return alerts;
}
