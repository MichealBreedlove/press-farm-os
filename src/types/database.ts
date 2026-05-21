/**
 * Press Farm OS — Supabase Database Types
 *
 * Manually maintained until `supabase gen types` is run against the actual project.
 * After connecting Supabase: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      farms: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          monthly_operating_cost: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          monthly_operating_cost?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          monthly_operating_cost?: number | null;
          updated_at?: string;
        };
      };
      restaurants: {
        Row: {
          id: string;
          farm_id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          farm_id: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          farm_id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "admin" | "chef" | "receiver";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: "admin" | "chef" | "receiver";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: "admin" | "chef" | "receiver";
          is_active?: boolean;
          updated_at?: string;
        };
      };
      restaurant_users: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          restaurant_id?: string;
        };
      };
      items: {
        Row: {
          id: string;
          farm_id: string;
          name: string;
          category: ItemCategory;
          unit_type: UnitType;
          default_price: number | null;
          unit_prices: Record<string, number> | null;
          chef_notes: string | null;
          internal_notes: string | null;
          source: string | null;
          is_archived: boolean;
          is_event_item: boolean;
          is_press_bar_item: boolean;
          show_in_regular_menu: boolean;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          farm_id: string;
          name: string;
          category: ItemCategory;
          unit_type: UnitType;
          default_price?: number | null;
          unit_prices?: Record<string, number> | null;
          chef_notes?: string | null;
          internal_notes?: string | null;
          source?: string | null;
          is_archived?: boolean;
          is_event_item?: boolean;
          is_press_bar_item?: boolean;
          show_in_regular_menu?: boolean;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          farm_id?: string;
          name?: string;
          category?: ItemCategory;
          unit_type?: UnitType;
          default_price?: number | null;
          unit_prices?: Record<string, number> | null;
          chef_notes?: string | null;
          internal_notes?: string | null;
          source?: string | null;
          is_archived?: boolean;
          is_event_item?: boolean;
          is_press_bar_item?: boolean;
          show_in_regular_menu?: boolean;
          sort_order?: number | null;
          updated_at?: string;
        };
      };
      delivery_dates: {
        Row: {
          id: string;
          date: string;
          day_of_week: DayOfWeek;
          ordering_open: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          day_of_week: DayOfWeek;
          ordering_open?: boolean;
          created_at?: string;
        };
        Update: {
          date?: string;
          day_of_week?: DayOfWeek;
          ordering_open?: boolean;
        };
      };
      availability_items: {
        Row: {
          id: string;
          item_id: string;
          restaurant_id: string;
          delivery_date: string;
          status: AvailabilityStatus;
          limited_qty: number | null;
          cycle_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          restaurant_id: string;
          delivery_date: string;
          status?: AvailabilityStatus;
          limited_qty?: number | null;
          cycle_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: AvailabilityStatus;
          limited_qty?: number | null;
          cycle_notes?: string | null;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          chef_id: string;
          delivery_date: string;
          status: OrderStatus;
          freeform_notes: string | null;
          submitted_at: string | null;
          fulfilled_at: string | null;
          closed_for_ordering: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          chef_id: string;
          delivery_date: string;
          status?: OrderStatus;
          freeform_notes?: string | null;
          submitted_at?: string | null;
          fulfilled_at?: string | null;
          closed_for_ordering?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: OrderStatus;
          freeform_notes?: string | null;
          submitted_at?: string | null;
          fulfilled_at?: string | null;
          closed_for_ordering?: boolean;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          availability_item_id: string;
          quantity_requested: number;
          quantity_fulfilled: number | null;
          is_shorted: boolean;
          shortage_reason: string | null;
          unit_price_at_order: number | null;
          unit_type: string | null;
          size_label: string | null;
          color_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          availability_item_id: string;
          quantity_requested: number;
          quantity_fulfilled?: number | null;
          is_shorted?: boolean;
          shortage_reason?: string | null;
          unit_price_at_order?: number | null;
          unit_type?: string | null;
          size_label?: string | null;
          color_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity_requested?: number;
          quantity_fulfilled?: number | null;
          is_shorted?: boolean;
          shortage_reason?: string | null;
          unit_price_at_order?: number | null;
          unit_type?: string | null;
          size_label?: string | null;
          color_key?: string | null;
          updated_at?: string;
        };
      };
      price_history: {
        Row: {
          id: string;
          item_id: string;
          price: number;
          effective_date: string;
          set_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          price: number;
          effective_date: string;
          set_by: string;
          created_at?: string;
        };
        Update: never;
      };
      price_catalog: {
        Row: {
          id: string;
          item_id: string;
          unit: UnitType;
          price_per_unit: number;
          effective_date: string;
          source: PriceSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          unit: UnitType;
          price_per_unit: number;
          effective_date?: string;
          source?: PriceSource;
          created_at?: string;
        };
        Update: {
          price_per_unit?: number;
          source?: PriceSource;
        };
      };
      deliveries: {
        Row: {
          id: string;
          delivery_date: string;
          restaurant_id: string;
          status: DeliveryStatus;
          total_value: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          delivery_date: string;
          restaurant_id: string;
          status?: DeliveryStatus;
          total_value?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: DeliveryStatus;
          total_value?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      delivery_items: {
        Row: {
          id: string;
          delivery_id: string;
          item_id: string;
          quantity: number;
          unit: UnitType;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          item_id: string;
          quantity: number;
          unit: UnitType;
          unit_price: number;
          created_at?: string;
        };
        Update: {
          quantity?: number;
          unit?: UnitType;
          unit_price?: number;
        };
      };
      farm_expenses: {
        Row: {
          id: string;
          farm_id: string;
          date: string;
          category: string;
          description: string | null;
          amount: number;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          farm_id: string;
          date: string;
          category: string;
          description?: string | null;
          amount: number;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          category?: string;
          description?: string | null;
          amount?: number;
          receipt_url?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          type: NotificationType;
          recipient_id: string;
          order_id: string | null;
          channel: NotificationChannel;
          subject: string | null;
          body_preview: string | null;
          sent_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: NotificationType;
          recipient_id: string;
          order_id?: string | null;
          channel?: NotificationChannel;
          subject?: string | null;
          body_preview?: string | null;
          sent_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          sent_at?: string | null;
          error?: string | null;
        };
      };
    };
    Views: {
      financial_periods: {
        Row: {
          period_start: string;
          period_type: string;
          restaurant_id: string;
          restaurant_name: string;
          total_delivery_value: number;
          total_expenses: number;
          delivery_count: number;
        };
      };
      most_ordered_items: {
        Row: {
          item_id: string;
          item_name: string;
          category: ItemCategory;
          unit_type: UnitType;
          order_frequency: number;
          total_quantity_requested: number;
          total_quantity_fulfilled: number;
          total_value: number;
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      user_restaurant_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
    };
    Enums: Record<PropertyKey, never>;
  };
}

// ============================================
// Enum types used in the database
// ============================================

export type ItemCategory =
  | "flowers"
  | "micros_leaves"
  | "herbs_leaves"
  | "fruit_veg"
  | "kits"
  | "family_meal";

export type UnitType =
  | "ea"
  | "sm"
  | "lg"
  | "gb"
  | "lbs"
  | "bu"
  | "qt"
  | "bx"
  | "cs"
  | "pt"
  | "kit";

export type DayOfWeek =
  | "thursday"
  | "saturday"
  | "monday"
  | "custom";

export type AvailabilityStatus = "available" | "limited" | "unavailable";

export type OrderStatus =
  | "draft"
  | "submitted"
  | "in_progress"
  | "fulfilled"
  | "cancelled";

export type DeliveryStatus = "pending" | "logged" | "finalized";

export type PriceSource = "market" | "custom";

export type NotificationType =
  | "order_submitted"
  | "order_confirmed"
  | "shortage"
  | "fulfilled"
  | "availability_published";

export type NotificationChannel = "email" | "sms";

// ─── Seeds ──────────────────────────────────────────────────────────────
export interface SeedRow {
  id: string;
  farm_id: string;
  item_id: string;
  variety: string;
  initial_quantity: number;
  quantity_unit: string;
  packed_for_year: number | null;
  purchase_date: string | null;
  supplier: string | null;
  cost: number | null;
  status: "active" | "low" | "exhausted" | "discarded";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedSowingRow {
  id: string;
  seed_id: string;
  planting_id: string | null;
  amount_used: number;
  sown_on: string;
  notes: string | null;
  created_at: string;
}

export interface SeedGerminationTestRow {
  id: string;
  seed_id: string;
  tested_on: string;
  germination_pct: number;
  seeds_tested: number | null;
  notes: string | null;
  created_at: string;
}

// View shape — includes computed columns from seeds_with_on_hand
export interface SeedWithOnHandRow extends SeedRow {
  on_hand: number;
  is_low: boolean;
  last_sown_on: string | null;
  latest_germ_pct: number | null;
  latest_germ_tested_on: string | null;
}

// === Microgreens module (migration 045) ===

export type MicrogreenTrayStatus =
  | "soaking" | "blackout" | "light" | "harvesting" | "terminated" | "lost";

export interface MicrogreenCrop {
  id: string;
  farm_id: string;
  item_id: string | null;
  name: string;
  variety: string | null;
  seed_density_g_per_tray: number;
  presoak_hours: number;
  presprout_hours: number;
  bury_seed: boolean;
  weight_during_blackout: boolean;
  blackout_days: number;
  keep_in_blackout: boolean;
  ideal_harvest_day: number;
  harvest_min_days: number | null;
  harvest_max_days: number | null;
  expected_yield_oz_per_tray: number;
  // Migration 047: per-unit alternative yields, e.g. {"lg": 4, "sm": 8, "ea": 32}
  // One tray yields 4 LG OR 8 SM OR 32 EA, depending on packing decision.
  yield_per_tray: Record<string, number>;
  is_continuous_harvest: boolean;
  productive_life_days: number | null;
  growing_medium: string[];
  preferred_medium: string | null;
  tray_size: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenDemand {
  id: string;
  crop_id: string;
  restaurant_id: string | null;
  day_of_week: number; // 0-6, JS convention
  target_oz: number; // deprecated by migration 047 — use target_quantity + target_unit
  target_quantity: number | null;
  target_unit: "lg" | "sm" | "ea" | "gb" | null;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenBatch {
  id: string;
  crop_id: string;
  sow_date: string;
  soak_started_at: string | null;
  planned_blackout_end: string | null;
  planned_harvest_date: string;
  tray_count: number;
  seed_lot: string | null;
  notes: string | null;
  created_at: string;
}

export interface MicrogreenTray {
  id: string;
  batch_id: string;
  tray_label: string;
  status: MicrogreenTrayStatus;
  sow_date: string;
  blackout_start: string | null;
  light_start: string | null;
  harvesting_start: string | null;
  terminated_at: string | null;
  lost_reason: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenHarvest {
  id: string;
  tray_id: string;
  harvested_at: string;
  yield_oz: number;
  unit: string;
  delivery_id: string | null;
  restaurant_id: string | null;
  notes: string | null;
  created_at: string;
}
