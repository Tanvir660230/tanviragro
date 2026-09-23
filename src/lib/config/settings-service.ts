/**
 * Enterprise Settings & Configuration Service
 * Authoritative provider for business configurations, operational thresholds, financial defaults,
 * and tenant-level master data settings with in-memory caching and audit tracking.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business } from "@/types/database";
import { FARM_DEFAULTS, CACHE_TAGS } from "@/constants/config";
import { CURRENCY, DEFAULT_FISCAL_YEAR_START_MONTH } from "@/constants/financial";
import { AuditService } from "@/lib/logging/audit";
import { logger } from "@/lib/logging/logger";

export interface BusinessConfiguration {
  id: string;
  name: string;
  type: string;
  unitPriceBdt: number;
  defaultDailyGainKg: number;
  defaultRoughageType: "straw" | "hay" | "silage" | "grass";
  openingCashBalance: number;
  defaultTaxRate: number;
  fiscalYearStartMonth: number;
  currency: typeof CURRENCY;
  billingPlan: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export class SettingsService {
  private static instance: SettingsService;
  private cache: Map<string, { config: BusinessConfiguration; cachedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

  private constructor() {}

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Loads and normalizes authoritative business settings with caching.
   */
  public async getBusinessConfig(
    supabase: SupabaseClient,
    businessId: string,
    forceRefresh = false
  ): Promise<BusinessConfiguration> {
    const cached = this.cache.get(businessId);
    if (!forceRefresh && cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.config;
    }

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (error || !data) {
      logger.warn("Failed to load business config from database, using fallback defaults", {
        businessId,
        error: error?.message,
      });

      return this.buildDefaultConfig(businessId);
    }

    const business = data as Business;
    const config: BusinessConfiguration = {
      id: business.id,
      name: business.name,
      type: business.type,
      unitPriceBdt: business.unit_price_bdt ?? 1000,
      defaultDailyGainKg: business.default_daily_gain_kg ?? FARM_DEFAULTS.DAILY_GAIN_KG,
      defaultRoughageType: business.default_roughage_type ?? "straw",
      openingCashBalance: business.opening_cash_balance ?? 0,
      defaultTaxRate: business.default_tax_rate ?? 0,
      fiscalYearStartMonth: business.fiscal_year_start_month ?? DEFAULT_FISCAL_YEAR_START_MONTH,
      currency: CURRENCY,
      billingPlan: business.billing_plan ?? "free",
      logoUrl: business.logo_url,
      address: business.address,
      phone: business.phone,
      email: business.email,
    };

    this.cache.set(businessId, { config, cachedAt: Date.now() });
    return config;
  }

  /**
   * Updates business configuration and invalidates cache.
   */
  public async updateBusinessConfig(
    supabase: SupabaseClient,
    businessId: string,
    userId: string,
    updates: Partial<Business>
  ): Promise<void> {
    const { error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", businessId);

    if (error) {
      throw new Error(`Failed to update business configuration: ${error.message}`);
    }

    // Invalidate in-memory cache
    this.cache.delete(businessId);

    // Audit log setting change
    void AuditService.record({
      businessId,
      userId,
      action: "SETTINGS_UPDATED",
      entityType: "business_configuration",
      entityId: businessId,
      metadata: updates as Record<string, unknown>,
    });
  }

  public invalidateCache(businessId?: string): void {
    if (businessId) {
      this.cache.delete(businessId);
    } else {
      this.cache.clear();
    }
  }

  private buildDefaultConfig(businessId: string): BusinessConfiguration {
    return {
      id: businessId,
      name: "Tanvir Agro",
      type: "cattle",
      unitPriceBdt: 1000,
      defaultDailyGainKg: FARM_DEFAULTS.DAILY_GAIN_KG,
      defaultRoughageType: "straw",
      openingCashBalance: 0,
      defaultTaxRate: 0,
      fiscalYearStartMonth: DEFAULT_FISCAL_YEAR_START_MONTH,
      currency: CURRENCY,
      billingPlan: "enterprise",
      logoUrl: null,
      address: null,
      phone: null,
      email: null,
    };
  }
}

export const settingsService = SettingsService.getInstance();
