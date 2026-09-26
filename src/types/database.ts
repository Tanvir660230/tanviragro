export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enum types ────────────────────────────────────────────────────

export type BusinessType = "cattle" | "poultry" | "fish" | "crop" | "other";
export type UserRole = "owner" | "manager" | "veterinarian" | "staff" | "viewer" | "worker";
export type CattleStatus = "active" | "sold" | "dead" | "stolen" | "quarantined" | "culled" | "archived";
export type CattleGender = "male" | "female";
export type InseminationType = "AI" | "natural";
export type BreedingStatus = "open" | "inseminated" | "pregnant" | "calved" | "failed";
export type HealthRecordType = "vaccine" | "deworming" | "checkup" | "treatment" | "disease_outbreak" | "surgery" | "other";
export type InventoryCategory = "feed" | "medicine" | "equipment" | "other" | "roughage";
export type TransactionType = "purchase" | "consumption";
/** Meaning of a ledger row; `type` only carries direction (purchase = IN, consumption = OUT). */
export type MovementType =
  | "purchase" | "opening_balance" | "own_production" | "feed_mix_output" | "adjustment_in" | "return"
  | "consumption_reversal"
  | "consumption" | "feed_mix_input" | "wastage" | "adjustment_out" | "purchase_reversal";

/** How a weight was obtained. Growth is computed from measured weights only. */
export type WeightType = "measured" | "estimated";
export type InitialWeightType = WeightType | "unknown";

/** Accounting group of an expense category (decides the account, not the name). */
export type ExpenseKind = "utility" | "labor" | "rent" | "transport" | "repair" | "veterinary" | "general";

export type ExpenseCategory = {
  id: string;
  business_id: string;
  kind: ExpenseKind;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type CostEntryAudit = {
  id: string;
  cost_entry_id: string;
  business_id: string;
  action: "insert" | "update" | "soft_delete" | "restore";
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
};
/** Where a row’s unit_cost came from (set by the database trigger for OUT rows). */
export type CostSource =
  | "invoice" | "wac" | "mix_inputs" | "zero_confirmed" | "zero_unconfirmed"
  | "missing" | "manual" | "legacy" | "correction";
export type CostType = "fixed" | "variable";
export type CostEntryClass = "expense" | "asset";
export type PhotoType = "purchase" | "current" | "medical" | "breeding" | "other";
export type HealthEventType = "vaccine" | "checkup" | "deworming" | "treatment" | "other";
export type VendorType = "cattle" | "feed" | "medicine" | "other";
export type PartnerType = "capital" | "labor" | "hybrid";
/** advance: taken against future profit · loan_in / loan_repay: a partner's loan to the farm (migration 20260927100000) */
export type PartnerTransactionType = "investment" | "withdrawal" | "profit" | "loss_allocation" | "advance" | "loan_in" | "loan_repay";

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
  farm_id?: string | null;
  pen_id?: string | null;
  tag_id: string;
  electronic_id?: string | null; // RFID/EID
  breed: string | null;
  breed_id?: string | null;
  category_id?: string | null;
  gender: CattleGender;
  dob: string | null;
  purchase_date: string;
  purchase_price: number;
  initial_weight_kg: number;
  /** measured | estimated | unknown (recorded before the distinction existed) */
  initial_weight_type: InitialWeightType;
  target_weight_kg: number | null;
  expected_daily_gain_kg: number | null;
  manual_feed_override: { roughageKg?: number } | null;
  status: CattleStatus;
  dam_id?: string | null; // Mother ID
  sire_id?: string | null; // Father ID
  notes: string | null;
  vendor_id: string | null;
  is_quarantined: boolean;
  is_qurbani_marked: boolean;
  withdrawal_end_date?: string | null;
  insurance_provider: string | null;
  insurance_amount: number | null;
  insurance_expiry: string | null;
  deleted_at: string | null;
  updated_at: string | null;
  created_at: string;
};

export type Farm = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  location: string | null;
  capacity: number | null;
  manager_id: string | null;
  notes: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Pen = {
  id: string;
  business_id: string;
  farm_id: string;
  name: string;
  code: string;
  type: "fattening" | "quarantine" | "nursery" | "maternity" | "isolation" | "general";
  capacity: number;
  current_occupancy: number;
  notes: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnimalBreed = {
  id: string;
  business_id: string | null;
  species: "cattle" | "buffalo" | "goat" | "sheep";
  name: string;
  code: string;
  description: string | null;
  origin_country: string | null;
  avg_daily_gain_kg: number | null;
  is_active: boolean;
  created_at: string;
};

export type AnimalCategory = {
  id: string;
  business_id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type DiseaseRecord = {
  id: string;
  business_id: string;
  cattle_id: string;
  disease_name: string;
  symptoms: string[];
  diagnosis_date: string;
  diagnosed_by_vet_id: string | null;
  severity: "mild" | "moderate" | "severe" | "critical";
  is_contagious: boolean;
  isolation_pen_id: string | null;
  status: "active" | "under_treatment" | "recovered" | "chronic" | "deceased";
  resolution_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BreedingRecordEntity = {
  id: string;
  business_id: string;
  cow_id: string;
  sire_id: string | null;
  sire_tag_or_breed: string;
  insemination_date: string;
  insemination_type: InseminationType;
  technician_name: string | null;
  status: BreedingStatus;
  pd_check_date: string | null;
  is_pregnant: boolean | null;
  pd_confirmed_at: string | null;
  expected_calving_date: string | null;
  actual_calving_date: string | null;
  dry_off_date: string | null;
  calf_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CattleDeathRecord = {
  id: string;
  business_id: string;
  cattle_id: string;
  death_date: string;
  cause_of_death: string;
  post_mortem_notes: string | null;
  certified_by_vet_id: string | null;
  estimated_casualty_loss_bdt: number;
  disposal_method: "burial" | "incineration" | "rendering" | "other";
  created_at: string;
};

export type DocumentAttachment = {
  id: string;
  business_id: string;
  entity_type: "cattle" | "health_event" | "breeding" | "sale" | "death" | "farm";
  entity_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type LivestockAuditLog = {
  id: string;
  business_id: string;
  entity_type: string;
  entity_id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "HEALTH_ADMINISTERED" | "BREEDING_EVENT" | "SALE" | "DEATH";
  actor_id: string;
  actor_role: UserRole;
  previous_state: Json | null;
  new_state: Json | null;
  ip_address?: string | null;
  timestamp: string;
};

export type WeightLog = {
  id: string;
  cattle_id: string;
  recorded_at: string;
  weight_kg: number;
  weight_type: WeightType;
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
  /** retired from this day: no share after it; history stays (migration 20260927090000) */
  left_at?: string | null;
  created_at: string;
};

/** A partner's share from a date until their next rule (migration 20260927090000). */
export type PartnerShareRule = {
  id: string;
  business_id: string;
  partner_id: string;
  effective_from: string;
  share_mode: "auto" | "manual";
  fixed_pct: number;
  bears_loss: boolean;
  note: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
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
  /** the expense this partner paid from their own pocket (migration 20260927100000) */
  cost_entry_id?: string | null;
};

/** A settlement cycle closed by the owner on a date (migration 20260927100000). */
export type PartnerCycle = {
  id: string;
  business_id: string;
  closed_on: string;
  note: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

/** A cash count written down by the owner (migration 20260927120000). */
export type CashCount = {
  id: string;
  business_id: string;
  counted_on: string;
  amount: number;
  expected: number | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
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
  /** kg in one stock unit; 1 for kg items, NULL = unknown (e.g. hay pieces) — never assumed */
  kg_per_unit: number | null;
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
  movement_type: MovementType;
  idempotency_key: string | null;
  reverses_id: string | null;
  /** herd consumption covering several days: first day covered (ends on recorded_at) */
  covers_from: string | null;
  cost_source: CostSource;
  is_estimate: boolean;
  created_by: string | null;
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
  category_id: string | null;
  attachment_path: string | null;
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
  /** payment record (cost entry, entry_class = asset) — cash is counted there, value/depreciation here */
  source_cost_entry_id: string | null;
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
      farms: {
        Row: Farm;
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          code: string;
          location?: string | null;
          capacity?: number | null;
          manager_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Farm>;
        Relationships: [];
      };
      pens: {
        Row: Pen;
        Insert: {
          id?: string;
          business_id: string;
          farm_id: string;
          name: string;
          code: string;
          type?: "fattening" | "quarantine" | "nursery" | "maternity" | "isolation" | "general";
          capacity?: number;
          current_occupancy?: number;
          notes?: string | null;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Pen>;
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
          initial_weight_type?: InitialWeightType;
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
          weight_type?: WeightType;
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
      partner_share_rules: {
        Row: PartnerShareRule;
        Insert: { id?: string; business_id: string; partner_id: string; effective_from: string; share_mode: "auto" | "manual"; fixed_pct?: number; bears_loss?: boolean; note?: string | null; created_at?: string; created_by?: string | null; deleted_at?: string | null };
        Update: Partial<PartnerShareRule>;
        Relationships: [];
      };
      partner_cycles: {
        Row: PartnerCycle;
        Insert: { id?: string; business_id: string; closed_on: string; note?: string | null; snapshot?: Record<string, unknown>; created_at?: string; created_by?: string | null; deleted_at?: string | null };
        Update: Partial<PartnerCycle>;
        Relationships: [];
      };
      cash_counts: {
        Row: CashCount;
        Insert: { id?: string; business_id: string; counted_on: string; amount: number; expected?: number | null; note?: string | null; created_at?: string; created_by?: string | null; deleted_at?: string | null };
        Update: Partial<CashCount>;
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
          cost_entry_id?: string | null;
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
          source_cost_entry_id?: string | null;
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
          kg_per_unit?: number | null;
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
          movement_type?: MovementType;
          idempotency_key?: string | null;
          reverses_id?: string | null;
          cost_source?: CostSource;
          is_estimate?: boolean;
          created_by?: string | null;
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
          category_id?: string | null;
          attachment_path?: string | null;
          created_at?: string;
        };
        Update: Partial<CostEntry>;
        Relationships: [];
      };
      expense_categories: {
        Row: ExpenseCategory;
        Insert: {
          id?: string;
          business_id: string;
          kind: ExpenseKind;
          name: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<ExpenseCategory>;
        Relationships: [];
      };
      cost_entry_audit: {
        Row: CostEntryAudit;
        Insert: never;
        Update: never;
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
      feed_mix_batches: {
        Row: {
          id: string; business_id: string; output_item_id: string; mix_date: string; output_qty: number; input_qty: number;
          total_cost: number | null; note: string | null; created_at: string; created_by: string | null;
          undone_at: string | null; undone_by: string | null; undo_reason: string | null;
        };
        Insert: never;   // written only by produce_feed_mix / undo_feed_mix
        Update: never;
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
    Views: {
      /** feed usage period lines (migration 20260925130000) */
      v_feed_usage_lines: {
        Row: {
          line_id: string; period_id: string; business_id: string; target_type: "item" | "recipe";
          period_item_id: string | null; recipe_id: string | null; start_date: string; end_date: string | null;
          status: "open" | "closed" | "unreconciled"; rule_type: "weight_share" | "pct_live_weight" | "per_head"; rule_value: number | null;
          item_id: string; item_name: string; unit: string; category: InventoryCategory; kg_per_unit: number | null; share: number;
          closing_qty: number | null; available_qty: number | null; consumed_qty: number | null; gap_qty: number | null;
          consumed_value: number | null; cost_missing: boolean; days: number; actual_daily_qty: number | null;
        };
        Relationships: [];
      };
      /** signed stock and value per item (never clamped) — migration 20260925100000 */
      v_inventory_balance: {
        Row: {
          item_id: string; business_id: string; name: string; unit: string; category: InventoryCategory;
          kg_per_unit: number | null; qty_on_hand: number; value_on_hand: number;
          rows_missing_cost: number; rows_zero_unconfirmed: number; rows_estimated: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      open_feed_usage_period: {
        Args: { p_business_id: string; p_target_type: string; p_target_id: string; p_start: string; p_rule_type?: string; p_rule_value?: number | null; p_notes?: string | null; p_idempotency_key?: string | null };
        Returns: string;
      };
      close_feed_usage_period: {
        Args: { p_period_id: string; p_end_date: string; p_closing: { item_id: string; qty: number }[]; p_reason?: string | null };
        Returns: string;
      };
      cancel_feed_usage_period: {
        Args: { p_period_id: string; p_reason: string };
        Returns: undefined;
      };
      checkpoint_feed_usage_period: {
        Args: { p_period_id: string; p_date: string; p_closing: { item_id: string; qty: number }[] };
        Returns: string;
      };
      set_feed_usage_rule: {
        Args: { p_period_id: string; p_rule_type: string; p_rule_value?: number | null };
        Returns: undefined;
      };
      post_feed_auto_usage: {
        Args: { p_business_id: string; p_rows: { line_id: string; date: string; qty: number }[]; p_period_ids: string[]; p_through: string };
        Returns: number;
      };
      save_feed_chart: {
        Args: { p_business_id: string; p_target_type: string; p_target_id: string; p_effective_from: string; p_bands: { min_kg: number; max_kg: number | null; amount: number; basis: string }[]; p_notes?: string | null };
        Returns: string;
      };
      produce_feed_mix: {
        Args: { p_business_id: string; p_output_item_id: string; p_date: string; p_lines: { item_id: string; qty: number }[]; p_batch_id: string; p_output_qty?: number | null; p_note?: string | null };
        Returns: { batch_id: string; output_qty?: number; cost?: number | null; duplicate?: boolean };
      };
      undo_feed_mix: {
        Args: { p_batch_id: string; p_reason: string };
        Returns: undefined;
      };
      delete_feed_chart: {
        Args: { p_chart_id: string };
        Returns: undefined;
      };
      record_herd_feeding: {
        Args: { p_business_id: string; p_date: string; p_lines: { item_id: string; qty: number }[]; p_note?: string | null };
        Returns: number;
      };
      produce_feed_batch: {
        Args: {
          p_business_id: string; p_recipe_id: string; p_output_item_id: string;
          p_output_qty: number; p_date: string; p_batch_id: string;
        };
        Returns: number;
      };
      inventory_unit_cost_as_of: {
        Args: { p_item_id: string; p_as_of: string };
        Returns: number | null;
      };
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
