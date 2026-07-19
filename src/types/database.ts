export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enum types ────────────────────────────────────────────────────

export type BusinessType = "cattle" | "poultry" | "fish" | "crop" | "other";
export type UserRole = "owner" | "manager" | "worker";
export type CattleStatus = "active" | "sold" | "dead" | "stolen";
export type CattleGender = "male" | "female";
export type InventoryCategory = "feed" | "medicine" | "equipment" | "other" | "roughage";
export type TransactionType = "purchase" | "consumption";
export type CostType = "fixed" | "variable";
export type CostEntryClass = "expense" | "asset";
export type PhotoType = "purchase" | "current" | "other";
export type HealthEventType = "vaccine" | "checkup" | "deworming" | "treatment" | "other";
export type VendorType = "cattle" | "feed" | "medicine" | "other";
export type PartnerType = "capital" | "labor" | "hybrid";
export type PartnerTransactionType = "investment" | "withdrawal" | "profit" | "loss_allocation";

// ── Domain models ─────────────────────────────────────────────────

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type Business = {
  id: string;
  name: string;
  type: BusinessType;
  owner_id: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  opening_cash_balance: number;
  default_tax_rate: number;
  billing_plan: string;
  unit_price_bdt: number;
  default_daily_gain_kg: number;
  fiscal_year_start_month: number;        // 1–12, default 7 (July for Bangladesh)
  default_roughage_type: "straw" | "hay" | "silage" | "grass";  // feed DM% default
  created_at: string;
};

export type Cattle = {
  id: string;
  business_id: string;
  tag_id: string;
  breed: string | null;
  gender: CattleGender;
  dob: string | null;
  purchase_date: string;
  purchase_price: number;
  initial_weight_kg: number;
  target_weight_kg: number | null;
  expected_daily_gain_kg: number | null;
  manual_feed_override: { roughageKg?: number } | null;
  status: CattleStatus;
  notes: string | null;
  vendor_id: string | null;
  is_quarantined: boolean;
  is_qurbani_marked: boolean;
  insurance_provider: string | null;
  insurance_amount: number | null;
  insurance_expiry: string | null;
  deleted_at: string | null;
  updated_at: string | null;
  created_at: string;
};

export type WeightLog = {
  id: string;
  cattle_id: string;
  recorded_at: string;
  weight_kg: number;
  girth_cm: number | null;
  length_cm: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type CattlePhoto = {
  id: string;
  cattle_id: string;
  photo_type: PhotoType;
  storage_path: string;
  taken_at: string | null;
  created_at: string;
};

export type HealthEvent = {
  id: string;
  cattle_id: string;
  business_id: string;
  title: string;
  event_type: HealthEventType;
  scheduled_at: string;
  completed_at: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Vendor = {
  id: string;
  business_id: string;
  name: string;
  type: VendorType;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type Partner = {
  id: string;
  business_id: string;
  name: string;
  partner_type: PartnerType;
  investment_amount: number;
  profit_share_pct: number;
  labor_value_monthly: number | null;
  joined_at: string;
  notes: string | null;
  deleted_at: string | null;
  cliff_months: number;
  share_mode: "auto" | "manual";
  bears_loss: boolean;
  entry_unit_price: number | null;
  entry_netpl: number | null;
  entry_valuation: number | null;
  created_at: string;
};

export type PartnerTransaction = {
  id: string;
  partner_id: string;
  amount: number;
  type: PartnerTransactionType;
  recorded_at: string;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type ManagementFeeRate = {
  id: string;
  business_id: string;
  rate_percent: number;
  effective_from: string;
  deleted_at: string | null;
  created_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  category: InventoryCategory;
  low_stock_threshold: number | null;
  vendor_id: string | null;
  is_active_roughage: boolean;
  roughage_active_from: string | null;
  roughage_active_until: string | null;
  is_discontinued: boolean;
  deleted_at: string | null;
  created_at: string;
};

export type InventoryTransaction = {
  id: string;
  item_id: string;
  type: TransactionType;
  qty: number;
  unit_cost: number | null;
  cattle_id: string | null;
  recorded_at: string;
  notes: string | null;
  created_at: string;
};

export type CostEntry = {
  id: string;
  business_id: string;
  type: CostType;
  entry_class: CostEntryClass;
  category: string;
  amount: number;
  recorded_at: string;
  description: string | null;
  cattle_id: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  cattle_id: string;
  sold_at: string;
  sale_price_total: number;
  buyer_name: string | null;
  weight_at_sale_kg: number | null;
  notes: string | null;
  deleted_at: string | null;
  reverted_reason: string | null;
  created_at: string;
};

export type FeedRecipe = {
  id: string;
  business_id: string;
  name: string;
  output_qty: number;
  output_unit: string;
  is_active: boolean;
  active_from: string | null;
  active_until: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  item_id: string;
  qty_per_batch: number;
  created_at: string;
};

export type SupplementRule = {
  id: string;
  business_id: string;
  feed_item_id: string;
  supplement_item_id: string;
  qty_per_100: number;
  created_at: string;
};

export type MedicineProtocol = {
  id: string;
  item_id: string;
  dose_per_100kg_weight: number;
  frequency_days: number | null;
  notes: string | null;
  created_at: string;
};

export type FinancialLock = {
  id: string;
  business_id: string;
  locked_until: string;
  created_by: string | null;
  created_at: string;
};

export type FixedAsset = {
  id: string;
  business_id: string;
  name: string;
  category: "infrastructure" | "equipment" | "vehicle" | "other";
  description: string | null;
  purchase_date: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: "straight_line" | "declining_balance";
  declining_rate: number | null;
  is_active: boolean;
  disposed_at: string | null;
  disposal_value: number | null;
  notes: string | null;
  created_at: string;
};

export type CattleTreatment = {
  id: string;
  cattle_id: string;
  medicine_item_id: string | null;
  dose_administered: number | null;
  dose_unit: string;
  vet_fee: number;
  additional_medical_cost: number;
  diagnosis: string | null;
  notes: string | null;
  treated_at: string;
  created_at: string;
};

export type BusinessUser = {
  id: string;
  business_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
};

export type Loan = {
  id: string;
  business_id: string;
  lender_name: string;
  principal_amount: number;
  interest_rate_pct: number;
  loan_date: string;
  due_date: string | null;
  purpose: string | null;
  status: "active" | "paid";
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type LoanPayment = {
  id: string;
  loan_id: string;
  amount: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export type MarketPrice = {
  id: string;
  business_id: string;
  date: string;
  price_per_kg: number;
  notes: string | null;
  created_at: string;
};

export type Liability = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  principal: number;
  outstanding: number;
  recorded_at: string;
  due_date: string | null;
  lender: string | null;
  notes: string | null;
  settled_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

// ── Supabase Database type ────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: { id: string; full_name?: string | null; avatar_url?: string | null; title?: string | null; phone?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      businesses: {
        Row: Business;
        Insert: { id?: string; name: string; type: BusinessType; owner_id: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null; opening_cash_balance?: number; default_tax_rate?: number; billing_plan?: string; unit_price_bdt?: number; created_at?: string };
        Update: Partial<Business>;
        Relationships: [];
      };
      cattle: {
        Row: Cattle;
        Insert: {
          id?: string;
          business_id: string;
          tag_id: string;
          breed?: string | null;
          gender: CattleGender;
          dob?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          initial_weight_kg?: number | null;
          status?: CattleStatus;
          notes?: string | null;
          vendor_id?: string | null;
          is_quarantined?: boolean | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Cattle>;
        Relationships: [];
      };
      weight_logs: {
        Row: WeightLog;
        Insert: {
          id?: string;
          cattle_id: string;
          recorded_at: string;
          weight_kg: number;
          girth_cm?: number | null;
          length_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<WeightLog>;
        Relationships: [];
      };
      cattle_photos: {
        Row: CattlePhoto;
        Insert: {
          id?: string;
          cattle_id: string;
          photo_type: PhotoType;
          storage_path: string;
          taken_at?: string | null;
          created_at?: string;
        };
        Update: Partial<CattlePhoto>;
        Relationships: [];
      };
      health_events: {
        Row: HealthEvent;
        Insert: {
          id?: string;
          cattle_id: string;
          business_id: string;
          title: string;
          event_type: HealthEventType;
          scheduled_at: string;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<HealthEvent>;
        Relationships: [];
      };
      vendors: {
        Row: Vendor;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          type: VendorType;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Vendor>;
        Relationships: [];
      };
      partners: {
        Row: Partner;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          partner_type?: PartnerType;
          investment_amount?: number;
          profit_share_pct?: number;
          labor_value_monthly?: number | null;
          cliff_months?: number;
          share_mode?: "auto" | "manual";
          bears_loss?: boolean;
          joined_at?: string;
          notes?: string | null;
          deleted_at?: string | null;
          entry_netpl?: number | null;
          entry_valuation?: number | null;
          created_at?: string;
        };
        Update: Partial<Partner>;
        Relationships: [];
      };
      partner_transactions: {
        Row: PartnerTransaction;
        Insert: {
          id?: string;
          partner_id: string;
          amount: number;
          type: PartnerTransactionType;
          recorded_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<PartnerTransaction>;
        Relationships: [
          {
            foreignKeyName: "partner_transactions_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          }
        ];
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: Partial<PushSubscription>;
        Relationships: [];
      };
      fixed_assets: {
        Row: FixedAsset;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          category?: "infrastructure" | "equipment" | "vehicle" | "other";
          description?: string | null;
          purchase_date: string;
          purchase_cost: number;
          salvage_value?: number;
          useful_life_years: number;
          depreciation_method?: "straight_line" | "declining_balance";
          declining_rate?: number | null;
          is_active?: boolean;
          disposed_at?: string | null;
          disposal_value?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<FixedAsset>;
        Relationships: [];
      };
      cattle_treatments: {
        Row: CattleTreatment;
        Insert: {
          id?: string;
          cattle_id: string;
          medicine_item_id?: string | null;
          dose_administered?: number | null;
          dose_unit?: string;
          vet_fee?: number;
          additional_medical_cost?: number;
          diagnosis?: string | null;
          notes?: string | null;
          treated_at?: string;
          created_at?: string;
        };
        Update: Partial<CattleTreatment>;
        Relationships: [];
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          unit: string;
          category: InventoryCategory;
          low_stock_threshold?: number | null;
          vendor_id?: string | null;
          is_active_roughage?: boolean | null;
          roughage_active_from?: string | null;
          is_discontinued?: boolean;
          created_at?: string;
        };
        Update: Partial<InventoryItem>;
        Relationships: [];
      };
      inventory_transactions: {
        Row: InventoryTransaction;
        Insert: {
          id?: string;
          item_id: string;
          type: TransactionType;
          qty: number;
          unit_cost?: number | null;
          cattle_id?: string | null;
          recorded_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<InventoryTransaction>;
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          }
        ];
      };
      cost_entries: {
        Row: CostEntry;
        Insert: {
          id?: string;
          business_id: string;
          type: CostType;
          entry_class?: CostEntryClass;
          category: string;
          amount: number;
          recorded_at: string;
          description?: string | null;
          cattle_id?: string | null;
          created_at?: string;
        };
        Update: Partial<CostEntry>;
        Relationships: [];
      };
      sales: {
        Row: Sale;
        Insert: {
          id?: string;
          cattle_id: string;
          sold_at: string;
          sale_price_total: number;
          buyer_name?: string | null;
          weight_at_sale_kg?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Sale>;
        Relationships: [
          {
            foreignKeyName: "sales_cattle_id_fkey";
            columns: ["cattle_id"];
            isOneToOne: false;
            referencedRelation: "cattle";
            referencedColumns: ["id"];
          }
        ];
      };
      feed_recipes: {
        Row: FeedRecipe;
        Insert: { id?: string; business_id: string; name: string; output_qty?: number; output_unit?: string; is_active?: boolean | null; active_until?: string | null; notes?: string | null; deleted_at?: string | null; created_at?: string };
        Update: Partial<FeedRecipe>;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: RecipeIngredient;
        Insert: { id?: string; recipe_id: string; item_id: string; qty_per_batch: number; created_at?: string };
        Update: Partial<RecipeIngredient>;
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "feed_recipes";
            referencedColumns: ["id"];
          }
        ];
      };
      supplement_rules: {
        Row: SupplementRule;
        Insert: { id?: string; business_id: string; feed_item_id: string; supplement_item_id: string; qty_per_100: number; created_at?: string };
        Update: Partial<SupplementRule>;
        Relationships: [];
      };
      medicine_protocols: {
        Row: MedicineProtocol;
        Insert: { id?: string; item_id: string; dose_per_100kg_weight: number; frequency_days?: number | null; notes?: string | null; created_at?: string };
        Update: Partial<MedicineProtocol>;
        Relationships: [];
      };
      financial_locks: {
        Row: FinancialLock;
        Insert: { id?: string; business_id: string; locked_until: string; created_by?: string | null; created_at?: string };
        Update: Partial<FinancialLock>;
        Relationships: [];
      };
      business_users: {
        Row: BusinessUser;
        Insert: { id?: string; business_id: string; user_id: string; role?: UserRole; created_at?: string };
        Update: Partial<BusinessUser>;
        Relationships: [];
      };
      management_fee_rates: {
        Row: ManagementFeeRate;
        Insert: { id?: string; business_id: string; rate_percent: number; effective_from: string; created_at?: string };
        Update: Partial<ManagementFeeRate>;
        Relationships: [];
      };
      market_prices: {
        Row: MarketPrice;
        Insert: { id?: string; business_id: string; date: string; price_per_kg: number; notes?: string | null; created_at?: string };
        Update: Partial<MarketPrice>;
        Relationships: [];
      };
      liabilities: {
        Row: Liability;
        Insert: { id?: string; business_id: string; name: string; category?: string; principal: number; outstanding: number; recorded_at?: string; due_date?: string | null; lender?: string | null; notes?: string | null; settled_at?: string | null; created_at?: string };
        Update: Partial<Liability>;
        Relationships: [];
      };
      loans: {
        Row: Loan;
        Insert: { id?: string; business_id: string; lender_name: string; principal_amount: number; interest_rate_pct?: number; loan_date: string; due_date?: string | null; purpose?: string | null; status?: "active" | "paid"; notes?: string | null; created_at?: string; deleted_at?: string | null };
        Update: Partial<Loan>;
        Relationships: [];
      };
      loan_payments: {
        Row: LoanPayment;
        Insert: { id?: string; loan_id: string; amount: number; paid_at: string; notes?: string | null; created_at?: string };
        Update: Partial<LoanPayment>;
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_user_business_role: {
        Args: { p_user_id: string };
        Returns: { role: string };
      };
      sell_cattle: {
        Args: {
          p_cattle_id: string;
          p_sale_price_total: number;
          p_weight_at_sale_kg: number;
          p_sold_at: string;
          p_buyer_name: string | null;
        };
        Returns: string;
      };
      revert_cattle_sale: {
        Args: {
          p_cattle_id: string;
          p_sale_id: string;
          p_reason: string;
        };
        Returns: void;
      };
      get_inventory_stats: {
        Args: { p_business_id: string; p_30_days_ago: string };
        Returns: {
          item_id: string;
          total_stock: number;
          total_consumed: number;
          consumed_last_30d: number;
        }[];
      };
      get_monthly_consumptions: {
        Args: { p_business_id: string };
        Returns: {
          month_yr: string;
          category: string;
          total_cost: number;
        }[];
      };
      get_cattle_consumptions: {
        Args: { p_business_id: string };
        Returns: {
          cattle_id: string;
          category: string;
          total_cost: number;
        }[];
      };
    };
    Enums: {
      business_type: BusinessType;
      user_role: UserRole;
      cattle_status: "active" | "sold" | "dead" | "stolen";
      cattle_gender: CattleGender;
      inventory_category: InventoryCategory;
      transaction_type: TransactionType;
      cost_type: CostType;
      photo_type: PhotoType;
      health_event_type: HealthEventType;
      vendor_type: VendorType;
      partner_type: PartnerType;
      partner_transaction_type: PartnerTransactionType;
    };
  };
};
