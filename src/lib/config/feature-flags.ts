/**
 * Enterprise Feature Flag Engine
 * Centralized feature toggles with role-based, business-type, and environment evaluations.
 */

import { appConfig } from "@/lib/config/app-config";
import { ExtendedUserRole } from "@/constants/roles";
import { BusinessContext } from "@/types/context";

export type FeatureFlagKey =
  | "enablePushNotifications"
  | "enableTelemetryProbes"
  | "enableIslamicPartnershipVesting"
  | "enableFifoInventoryDeduction"
  | "enableAutomatedAlerts"
  | "enableAdvancedAnalytics"
  | "enableExportCompliancePdf";

export interface FeatureContext {
  role?: ExtendedUserRole;
  businessId?: string;
  isOwner?: boolean;
}

export class FeatureFlagEngine {
  private static instance: FeatureFlagEngine;

  private customOverrides: Map<string, boolean> = new Map();

  private constructor() {}

  public static getInstance(): FeatureFlagEngine {
    if (!FeatureFlagEngine.instance) {
      FeatureFlagEngine.instance = new FeatureFlagEngine();
    }
    return FeatureFlagEngine.instance;
  }

  /**
   * Checks if a given feature flag is enabled for the context.
   */
  public isEnabled(flag: FeatureFlagKey, context?: FeatureContext | BusinessContext): boolean {
    const overrideKey = context?.businessId ? `${context.businessId}:${flag}` : null;
    if (overrideKey && this.customOverrides.has(overrideKey)) {
      return this.customOverrides.get(overrideKey)!;
    }

    if (this.customOverrides.has(flag)) {
      return this.customOverrides.get(flag)!;
    }

    // Standard static config baseline
    const staticFlag = (appConfig.featureFlags as Record<string, boolean>)[flag];
    if (staticFlag !== undefined) {
      return staticFlag;
    }

    // Default true for enterprise baseline features
    return true;
  }

  /**
   * Allows tenant-level or runtime override (useful for enterprise plans & beta features)
   */
  public setOverride(flag: FeatureFlagKey, enabled: boolean, businessId?: string): void {
    const key = businessId ? `${businessId}:${flag}` : flag;
    this.customOverrides.set(key, enabled);
  }

  public clearOverrides(): void {
    this.customOverrides.clear();
  }
}

export const featureFlagEngine = FeatureFlagEngine.getInstance();
