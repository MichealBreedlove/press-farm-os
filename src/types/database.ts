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
          role: "admin" | "chef";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: "admin" | "chef";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: "admin" | "chef";
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
          chef_notes: string | null;
          internal_notes: string | null;
          source: string | null;
          is_archived: boolean;
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
          chef_notes?: string | null;
          internal_notes?: string | null;
          source?: string | null;
          is_archived?: boolean;
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
          chef_notes?: string | null;
          internal_notes?: string | null;
          source?: string | null;
          is_archived?: boolean;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity_requested?: number;
          quantity_fulfilled?: number | null;
          is_shorted?: boolean;
          shortage_reason?: string | null;
          unit_price_at_order?: number | null;
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
