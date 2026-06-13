// Supabase database types.
// The `Database` type + helpers below are GENERATED from the live schema
// (supabase gen types). The app-level domain types/enums beneath the marker
// are hand-maintained and imported across the app — keep them in sync.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      availability_items: {
        Row: {
          available_colors: string | null
          available_sizes: string | null
          available_units: string | null
          created_at: string
          cycle_notes: string | null
          delivery_date: string
          id: string
          item_id: string
          limited_qty: number | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          available_colors?: string | null
          available_sizes?: string | null
          available_units?: string | null
          created_at?: string
          cycle_notes?: string | null
          delivery_date: string
          id?: string
          item_id: string
          limited_qty?: number | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          available_colors?: string | null
          available_sizes?: string | null
          available_units?: string | null
          created_at?: string
          cycle_notes?: string | null
          delivery_date?: string
          id?: string
          item_id?: string
          limited_qty?: number | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_items_delivery_date_fkey"
            columns: ["delivery_date"]
            isOneToOne: false
            referencedRelation: "delivery_dates"
            referencedColumns: ["date"]
          },
          {
            foreignKeyName: "availability_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "availability_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_plan_entries: {
        Row: {
          category: string
          created_at: string | null
          farm_id: string
          id: string
          item_name: string
          notes: string | null
          season: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          farm_id: string
          id?: string
          item_name: string
          notes?: string | null
          season: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          farm_id?: string
          id?: string
          item_name?: string
          notes?: string | null
          season?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_plan_entries_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          closed_at: string | null
          closed_by_name: string | null
          created_at: string
          delivery_date: string
          id: string
          notes: string | null
          restaurant_id: string
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_name?: string | null
          created_at?: string
          delivery_date: string
          id?: string
          notes?: string | null
          restaurant_id: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_name?: string | null
          created_at?: string
          delivery_date?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_dates: {
        Row: {
          created_at: string
          date: string
          day_of_week: string
          id: string
          ordering_open: boolean
        }
        Insert: {
          created_at?: string
          date: string
          day_of_week: string
          id?: string
          ordering_open?: boolean
        }
        Update: {
          created_at?: string
          date?: string
          day_of_week?: string
          id?: string
          ordering_open?: boolean
        }
        Relationships: []
      }
      delivery_items: {
        Row: {
          bonus_note: string | null
          created_at: string
          delivery_id: string
          id: string
          is_bonus: boolean | null
          item_id: string
          line_total: number
          quantity: number
          received_at: string | null
          size_label: string | null
          unit: string
          unit_price: number
        }
        Insert: {
          bonus_note?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          is_bonus?: boolean | null
          item_id: string
          line_total?: number
          quantity: number
          received_at?: string | null
          size_label?: string | null
          unit: string
          unit_price: number
        }
        Update: {
          bonus_note?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          is_bonus?: boolean | null
          item_id?: string
          line_total?: number
          quantity?: number
          received_at?: string | null
          size_label?: string | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      event_requests: {
        Row: {
          admin_response: string | null
          chef_id: string
          created_at: string
          event_group_id: string | null
          event_name: string | null
          id: string
          item_id: string
          needed_by_date: string
          notes: string | null
          order_item_id: string | null
          quantity: number
          responded_at: string | null
          responded_by: string | null
          restaurant_id: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          chef_id: string
          created_at?: string
          event_group_id?: string | null
          event_name?: string | null
          id?: string
          item_id: string
          needed_by_date: string
          notes?: string | null
          order_item_id?: string | null
          quantity: number
          responded_at?: string | null
          responded_by?: string | null
          restaurant_id: string
          status?: string
          unit: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          chef_id?: string
          created_at?: string
          event_group_id?: string | null
          event_name?: string | null
          id?: string
          item_id?: string
          needed_by_date?: string
          notes?: string | null
          order_item_id?: string | null
          quantity?: number
          responded_at?: string | null
          responded_by?: string | null
          restaurant_id?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_requests_chef_id_fkey"
            columns: ["chef_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "event_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          farm_id: string
          id: string
          receipt_url: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description?: string | null
          farm_id: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          farm_id?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_expenses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_notes: {
        Row: {
          category: string
          created_at: string | null
          date: string
          farm_id: string
          id: string
          text: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          date?: string
          farm_id: string
          id?: string
          text: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          date?: string
          farm_id?: string
          id?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_notes_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_settings: {
        Row: {
          created_at: string | null
          farm_id: string
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          farm_id: string
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          farm_id?: string
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_tasks: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          description: string | null
          due_date: string
          due_time: string | null
          farm_id: string
          generator_key: string | null
          id: string
          inbound_message_id: string | null
          item_id: string | null
          microgreen_batch_id: string | null
          microgreen_crop_id: string | null
          priority: number
          snoozed_until: string | null
          source: Database["public"]["Enums"]["farm_task_source"]
          source_ref: Json
          status: Database["public"]["Enums"]["farm_task_status"]
          suggestion_id: string | null
          superseded_at: string | null
          superseded_reason: string | null
          title: string
          type: Database["public"]["Enums"]["farm_task_type"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          due_time?: string | null
          farm_id: string
          generator_key?: string | null
          id?: string
          inbound_message_id?: string | null
          item_id?: string | null
          microgreen_batch_id?: string | null
          microgreen_crop_id?: string | null
          priority?: number
          snoozed_until?: string | null
          source: Database["public"]["Enums"]["farm_task_source"]
          source_ref?: Json
          status?: Database["public"]["Enums"]["farm_task_status"]
          suggestion_id?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          title: string
          type: Database["public"]["Enums"]["farm_task_type"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          due_time?: string | null
          farm_id?: string
          generator_key?: string | null
          id?: string
          inbound_message_id?: string | null
          item_id?: string | null
          microgreen_batch_id?: string | null
          microgreen_crop_id?: string | null
          priority?: number
          snoozed_until?: string | null
          source?: Database["public"]["Enums"]["farm_task_source"]
          source_ref?: Json
          status?: Database["public"]["Enums"]["farm_task_status"]
          suggestion_id?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          title?: string
          type?: Database["public"]["Enums"]["farm_task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_tasks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_tasks_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "farm_tasks_microgreen_batch_id_fkey"
            columns: ["microgreen_batch_id"]
            isOneToOne: false
            referencedRelation: "microgreen_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_tasks_microgreen_crop_id_fkey"
            columns: ["microgreen_crop_id"]
            isOneToOne: false
            referencedRelation: "microgreen_crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_tasks_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_pay_rates: {
        Row: {
          created_at: string | null
          effective_date: string
          farm_id: string
          flat_quarterly: number | null
          hourly_rate: number | null
          hours_per_week: number | null
          id: string
          note: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          farm_id: string
          flat_quarterly?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          note?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          farm_id?: string
          flat_quarterly?: number | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          note?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmer_pay_rates_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          address: string | null
          created_at: string
          id: string
          monthly_operating_cost: number | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          monthly_operating_cost?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          monthly_operating_cost?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inbound_messages: {
        Row: {
          created_at: string
          extracted_at: string | null
          extraction_error: string | null
          extraction_status: string
          farm_id: string
          from_email: string
          from_name: string | null
          html_body: string | null
          id: string
          in_reply_to: string | null
          matched_restaurant_id: string | null
          matched_user_id: string | null
          received_at: string
          resend_message_id: string
          status: string
          subject: string | null
          text_body: string | null
          to_email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          farm_id: string
          from_email: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          matched_restaurant_id?: string | null
          matched_user_id?: string | null
          received_at: string
          resend_message_id: string
          status?: string
          subject?: string | null
          text_body?: string | null
          to_email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          farm_id?: string
          from_email?: string
          from_name?: string | null
          html_body?: string | null
          id?: string
          in_reply_to?: string | null
          matched_restaurant_id?: string | null
          matched_user_id?: string | null
          received_at?: string
          resend_message_id?: string
          status?: string
          subject?: string | null
          text_body?: string | null
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_matched_restaurant_id_fkey"
            columns: ["matched_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_task_drafts: {
        Row: {
          confidence: string
          confirmed_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          inbound_message_id: string
          matched_item_id: string | null
          proposed_item_name: string
          proposed_schedule: Json
          reasoning: string | null
          status: string
          suggestion_id: string | null
          updated_at: string
        }
        Insert: {
          confidence: string
          confirmed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          inbound_message_id: string
          matched_item_id?: string | null
          proposed_item_name: string
          proposed_schedule: Json
          reasoning?: string | null
          status?: string
          suggestion_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: string
          confirmed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          inbound_message_id?: string
          matched_item_id?: string | null
          proposed_item_name?: string
          proposed_schedule?: Json
          reasoning?: string | null
          status?: string
          suggestion_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_task_drafts_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_task_drafts_matched_item_id_fkey"
            columns: ["matched_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_task_drafts_matched_item_id_fkey"
            columns: ["matched_item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inbox_task_drafts_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          chef_notes: string | null
          color: string | null
          created_at: string
          days_to_maturity: number | null
          default_price: number | null
          farm_id: string
          growing_notes: string | null
          growing_zone: string | null
          id: string
          image_url: string | null
          indoor_start_weeks: number | null
          internal_notes: string | null
          is_archived: boolean
          is_event_item: boolean
          is_press_bar_item: boolean
          name: string
          parent_item_id: string | null
          plant_spacing: string | null
          recurring_sow_active: boolean
          recurring_sow_anchor_date: string | null
          recurring_sow_interval_days: number | null
          recurring_sow_notes: string | null
          row_spacing: string | null
          season_note: string | null
          season_status: string | null
          seasonal_months: number[]
          show_in_regular_menu: boolean
          size: string | null
          soil_temp_min: number | null
          sort_order: number | null
          source: string | null
          sow_depth: string | null
          sow_method: string | null
          sun_requirement: string | null
          unit_prices: Json
          unit_type: string
          updated_at: string
          variety: string | null
        }
        Insert: {
          category: string
          chef_notes?: string | null
          color?: string | null
          created_at?: string
          days_to_maturity?: number | null
          default_price?: number | null
          farm_id: string
          growing_notes?: string | null
          growing_zone?: string | null
          id?: string
          image_url?: string | null
          indoor_start_weeks?: number | null
          internal_notes?: string | null
          is_archived?: boolean
          is_event_item?: boolean
          is_press_bar_item?: boolean
          name: string
          parent_item_id?: string | null
          plant_spacing?: string | null
          recurring_sow_active?: boolean
          recurring_sow_anchor_date?: string | null
          recurring_sow_interval_days?: number | null
          recurring_sow_notes?: string | null
          row_spacing?: string | null
          season_note?: string | null
          season_status?: string | null
          seasonal_months?: number[]
          show_in_regular_menu?: boolean
          size?: string | null
          soil_temp_min?: number | null
          sort_order?: number | null
          source?: string | null
          sow_depth?: string | null
          sow_method?: string | null
          sun_requirement?: string | null
          unit_prices?: Json
          unit_type: string
          updated_at?: string
          variety?: string | null
        }
        Update: {
          category?: string
          chef_notes?: string | null
          color?: string | null
          created_at?: string
          days_to_maturity?: number | null
          default_price?: number | null
          farm_id?: string
          growing_notes?: string | null
          growing_zone?: string | null
          id?: string
          image_url?: string | null
          indoor_start_weeks?: number | null
          internal_notes?: string | null
          is_archived?: boolean
          is_event_item?: boolean
          is_press_bar_item?: boolean
          name?: string
          parent_item_id?: string | null
          plant_spacing?: string | null
          recurring_sow_active?: boolean
          recurring_sow_anchor_date?: string | null
          recurring_sow_interval_days?: number | null
          recurring_sow_notes?: string | null
          row_spacing?: string | null
          season_note?: string | null
          season_status?: string | null
          seasonal_months?: number[]
          show_in_regular_menu?: boolean
          size?: string | null
          soil_temp_min?: number | null
          sort_order?: number | null
          source?: string | null
          sow_depth?: string | null
          sow_method?: string | null
          sun_requirement?: string | null
          unit_prices?: Json
          unit_type?: string
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      labor_entries: {
        Row: {
          created_at: string | null
          date: string
          farm_id: string
          hourly_rate: number | null
          hours: number
          id: string
          lunch_in: string | null
          lunch_out: string | null
          notes: string | null
          time_in: string | null
          time_out: string | null
          updated_at: string | null
          worker_name: string
        }
        Insert: {
          created_at?: string | null
          date: string
          farm_id: string
          hourly_rate?: number | null
          hours: number
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          time_in?: string | null
          time_out?: string | null
          updated_at?: string | null
          worker_name: string
        }
        Update: {
          created_at?: string | null
          date?: string
          farm_id?: string
          hourly_rate?: number | null
          hours?: number
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          time_in?: string | null
          time_out?: string | null
          updated_at?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_entries_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      microgreen_batches: {
        Row: {
          created_at: string
          crop_id: string
          id: string
          notes: string | null
          planned_blackout_end: string | null
          planned_harvest_date: string
          seed_lot: string | null
          soak_started_at: string | null
          sow_date: string
          tray_count: number
        }
        Insert: {
          created_at?: string
          crop_id: string
          id?: string
          notes?: string | null
          planned_blackout_end?: string | null
          planned_harvest_date: string
          seed_lot?: string | null
          soak_started_at?: string | null
          sow_date: string
          tray_count: number
        }
        Update: {
          created_at?: string
          crop_id?: string
          id?: string
          notes?: string | null
          planned_blackout_end?: string | null
          planned_harvest_date?: string
          seed_lot?: string | null
          soak_started_at?: string | null
          sow_date?: string
          tray_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "microgreen_batches_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "microgreen_crops"
            referencedColumns: ["id"]
          },
        ]
      }
      microgreen_crops: {
        Row: {
          blackout_days: number
          bury_seed: boolean
          created_at: string
          expected_yield_oz_per_tray: number
          farm_id: string
          growing_medium: string[]
          harvest_max_days: number | null
          harvest_min_days: number | null
          harvest_stage: Database["public"]["Enums"]["microgreen_harvest_stage"]
          id: string
          ideal_harvest_day: number
          is_active: boolean
          is_continuous_harvest: boolean
          item_id: string | null
          keep_in_blackout: boolean
          name: string
          notes: string | null
          preferred_medium: string | null
          presoak_hours: number
          presprout_hours: number
          productive_life_days: number | null
          seed_density_g_per_tray: number
          tray_size: string
          updated_at: string
          variety: string | null
          weight_during_blackout: boolean
          yield_per_tray: Json
        }
        Insert: {
          blackout_days?: number
          bury_seed?: boolean
          created_at?: string
          expected_yield_oz_per_tray: number
          farm_id: string
          growing_medium?: string[]
          harvest_max_days?: number | null
          harvest_min_days?: number | null
          harvest_stage?: Database["public"]["Enums"]["microgreen_harvest_stage"]
          id?: string
          ideal_harvest_day: number
          is_active?: boolean
          is_continuous_harvest?: boolean
          item_id?: string | null
          keep_in_blackout?: boolean
          name: string
          notes?: string | null
          preferred_medium?: string | null
          presoak_hours?: number
          presprout_hours?: number
          productive_life_days?: number | null
          seed_density_g_per_tray: number
          tray_size?: string
          updated_at?: string
          variety?: string | null
          weight_during_blackout?: boolean
          yield_per_tray?: Json
        }
        Update: {
          blackout_days?: number
          bury_seed?: boolean
          created_at?: string
          expected_yield_oz_per_tray?: number
          farm_id?: string
          growing_medium?: string[]
          harvest_max_days?: number | null
          harvest_min_days?: number | null
          harvest_stage?: Database["public"]["Enums"]["microgreen_harvest_stage"]
          id?: string
          ideal_harvest_day?: number
          is_active?: boolean
          is_continuous_harvest?: boolean
          item_id?: string | null
          keep_in_blackout?: boolean
          name?: string
          notes?: string | null
          preferred_medium?: string | null
          presoak_hours?: number
          presprout_hours?: number
          productive_life_days?: number | null
          seed_density_g_per_tray?: number
          tray_size?: string
          updated_at?: string
          variety?: string | null
          weight_during_blackout?: boolean
          yield_per_tray?: Json
        }
        Relationships: [
          {
            foreignKeyName: "microgreen_crops_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microgreen_crops_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microgreen_crops_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      microgreen_demand: {
        Row: {
          created_at: string
          crop_id: string
          day_of_week: number
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          restaurant_id: string | null
          target_oz: number | null
          target_quantity: number | null
          target_unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          day_of_week: number
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          target_oz?: number | null
          target_quantity?: number | null
          target_unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          day_of_week?: number
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          target_oz?: number | null
          target_quantity?: number | null
          target_unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "microgreen_demand_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "microgreen_crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microgreen_demand_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      microgreen_harvests: {
        Row: {
          created_at: string
          delivery_id: string | null
          harvested_at: string
          id: string
          notes: string | null
          restaurant_id: string | null
          tray_id: string
          unit: string
          yield_oz: number
        }
        Insert: {
          created_at?: string
          delivery_id?: string | null
          harvested_at?: string
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          tray_id: string
          unit?: string
          yield_oz: number
        }
        Update: {
          created_at?: string
          delivery_id?: string | null
          harvested_at?: string
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          tray_id?: string
          unit?: string
          yield_oz?: number
        }
        Relationships: [
          {
            foreignKeyName: "microgreen_harvests_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microgreen_harvests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microgreen_harvests_tray_id_fkey"
            columns: ["tray_id"]
            isOneToOne: false
            referencedRelation: "microgreen_trays"
            referencedColumns: ["id"]
          },
        ]
      }
      microgreen_trays: {
        Row: {
          batch_id: string
          blackout_start: string | null
          created_at: string
          harvesting_start: string | null
          id: string
          light_start: string | null
          location: string | null
          lost_reason: string | null
          notes: string | null
          sow_date: string
          status: Database["public"]["Enums"]["microgreen_tray_status"]
          terminated_at: string | null
          tray_label: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          blackout_start?: string | null
          created_at?: string
          harvesting_start?: string | null
          id?: string
          light_start?: string | null
          location?: string | null
          lost_reason?: string | null
          notes?: string | null
          sow_date: string
          status: Database["public"]["Enums"]["microgreen_tray_status"]
          terminated_at?: string | null
          tray_label: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          blackout_start?: string | null
          created_at?: string
          harvesting_start?: string | null
          id?: string
          light_start?: string | null
          location?: string | null
          lost_reason?: string | null
          notes?: string | null
          sow_date?: string
          status?: Database["public"]["Enums"]["microgreen_tray_status"]
          terminated_at?: string | null
          tray_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "microgreen_trays_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "microgreen_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_preview: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          recipient_id: string
          sent_at: string | null
          subject: string | null
          type: string
        }
        Insert: {
          body_preview?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          recipient_id: string
          sent_at?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          body_preview?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          recipient_id?: string
          sent_at?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          delivery_date: string | null
          detail: Json
          id: string
          order_id: string | null
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          delivery_date?: string | null
          detail?: Json
          id?: string
          order_id?: string | null
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          delivery_date?: string | null
          detail?: Json
          id?: string
          order_id?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          availability_item_id: string
          color_key: string | null
          created_at: string
          created_by: string | null
          id: string
          is_shorted: boolean
          menu_section: string | null
          order_id: string
          picked_at: string | null
          quantity_fulfilled: number | null
          quantity_requested: number
          received_at: string | null
          shortage_reason: string | null
          size_label: string | null
          unit_price_at_order: number | null
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          availability_item_id: string
          color_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_shorted?: boolean
          menu_section?: string | null
          order_id: string
          picked_at?: string | null
          quantity_fulfilled?: number | null
          quantity_requested: number
          received_at?: string | null
          shortage_reason?: string | null
          size_label?: string | null
          unit_price_at_order?: number | null
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          availability_item_id?: string
          color_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_shorted?: boolean
          menu_section?: string | null
          order_id?: string
          picked_at?: string | null
          quantity_fulfilled?: number | null
          quantity_requested?: number
          received_at?: string | null
          shortage_reason?: string | null
          size_label?: string | null
          unit_price_at_order?: number | null
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_availability_item_id_fkey"
            columns: ["availability_item_id"]
            isOneToOne: false
            referencedRelation: "availability_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          chef_id: string
          closed_for_ordering: boolean
          created_at: string
          delivery_date: string
          freeform_notes: string | null
          fulfilled_at: string | null
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          last_submission_token: string | null
          restaurant_id: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          chef_id: string
          closed_for_ordering?: boolean
          created_at?: string
          delivery_date: string
          freeform_notes?: string | null
          fulfilled_at?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_submission_token?: string | null
          restaurant_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          chef_id?: string
          closed_for_ordering?: boolean
          created_at?: string
          delivery_date?: string
          freeform_notes?: string | null
          fulfilled_at?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_submission_token?: string | null
          restaurant_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_chef_id_fkey"
            columns: ["chef_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_date_fkey"
            columns: ["delivery_date"]
            isOneToOne: false
            referencedRelation: "delivery_dates"
            referencedColumns: ["date"]
          },
          {
            foreignKeyName: "orders_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      plantings: {
        Row: {
          avg_price: number | null
          avg_yield: number | null
          bed_feet: number | null
          beds: number | null
          category: string | null
          container_type: string | null
          created_at: string | null
          crop_name: string
          days_to_maturity: number | null
          farm_id: string
          growing_location: string | null
          harvest_end: string | null
          harvest_start: string | null
          harvest_unit: string | null
          id: string
          item_id: string | null
          location: string | null
          notes: string | null
          planting_stock: string | null
          projected_revenue: number | null
          quantity: number | null
          quantity_unit: string | null
          season: number | null
          seed_id: string | null
          sow_date: string | null
          sowing_method: string | null
          status: string | null
          termination_date: string | null
          transplant_date: string | null
          updated_at: string | null
          variety: string | null
        }
        Insert: {
          avg_price?: number | null
          avg_yield?: number | null
          bed_feet?: number | null
          beds?: number | null
          category?: string | null
          container_type?: string | null
          created_at?: string | null
          crop_name: string
          days_to_maturity?: number | null
          farm_id: string
          growing_location?: string | null
          harvest_end?: string | null
          harvest_start?: string | null
          harvest_unit?: string | null
          id?: string
          item_id?: string | null
          location?: string | null
          notes?: string | null
          planting_stock?: string | null
          projected_revenue?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          season?: number | null
          seed_id?: string | null
          sow_date?: string | null
          sowing_method?: string | null
          status?: string | null
          termination_date?: string | null
          transplant_date?: string | null
          updated_at?: string | null
          variety?: string | null
        }
        Update: {
          avg_price?: number | null
          avg_yield?: number | null
          bed_feet?: number | null
          beds?: number | null
          category?: string | null
          container_type?: string | null
          created_at?: string | null
          crop_name?: string
          days_to_maturity?: number | null
          farm_id?: string
          growing_location?: string | null
          harvest_end?: string | null
          harvest_start?: string | null
          harvest_unit?: string | null
          id?: string
          item_id?: string | null
          location?: string | null
          notes?: string | null
          planting_stock?: string | null
          projected_revenue?: number | null
          quantity?: number | null
          quantity_unit?: string | null
          season?: number | null
          seed_id?: string | null
          sow_date?: string | null
          sowing_method?: string | null
          status?: string | null
          termination_date?: string | null
          transplant_date?: string | null
          updated_at?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "plantings_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds_with_on_hand"
            referencedColumns: ["id"]
          },
        ]
      }
      price_catalog: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          item_id: string
          price_per_unit: number
          source: string
          unit: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          item_id: string
          price_per_unit: number
          source?: string
          unit: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          item_id?: string
          price_per_unit?: number
          source?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_catalog_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_catalog_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          item_id: string
          price: number
          set_by: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          item_id: string
          price: number
          set_by: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          item_id?: string
          price?: number
          set_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "price_history_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      receiver_notify_log: {
        Row: {
          created_at: string
          delivery_date: string
          extra_count: number
          failed_count: number
          fulfilled_orders_count: number
          id: string
          pending_count: number
          ready_count: number
          recipients_count: number
          sent_at: string
          sent_by: string
          short_count: number
          succeeded_count: number
        }
        Insert: {
          created_at?: string
          delivery_date: string
          extra_count?: number
          failed_count?: number
          fulfilled_orders_count?: number
          id?: string
          pending_count?: number
          ready_count?: number
          recipients_count?: number
          sent_at?: string
          sent_by: string
          short_count?: number
          succeeded_count?: number
        }
        Update: {
          created_at?: string
          delivery_date?: string
          extra_count?: number
          failed_count?: number
          fulfilled_orders_count?: number
          id?: string
          pending_count?: number
          ready_count?: number
          recipients_count?: number
          sent_at?: string
          sent_by?: string
          short_count?: number
          succeeded_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "receiver_notify_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_users: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_users_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_germination_tests: {
        Row: {
          created_at: string | null
          germination_pct: number
          id: string
          notes: string | null
          seed_id: string
          seeds_tested: number | null
          tested_on: string
        }
        Insert: {
          created_at?: string | null
          germination_pct: number
          id?: string
          notes?: string | null
          seed_id: string
          seeds_tested?: number | null
          tested_on?: string
        }
        Update: {
          created_at?: string | null
          germination_pct?: number
          id?: string
          notes?: string | null
          seed_id?: string
          seeds_tested?: number | null
          tested_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_germination_tests_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_germination_tests_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds_with_on_hand"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_sowings: {
        Row: {
          amount_used: number
          created_at: string | null
          id: string
          notes: string | null
          planting_id: string | null
          seed_id: string
          sown_on: string
        }
        Insert: {
          amount_used: number
          created_at?: string | null
          id?: string
          notes?: string | null
          planting_id?: string | null
          seed_id: string
          sown_on?: string
        }
        Update: {
          amount_used?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          planting_id?: string | null
          seed_id?: string
          sown_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_sowings_planting_id_fkey"
            columns: ["planting_id"]
            isOneToOne: false
            referencedRelation: "plantings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_sowings_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_sowings_seed_id_fkey"
            columns: ["seed_id"]
            isOneToOne: false
            referencedRelation: "seeds_with_on_hand"
            referencedColumns: ["id"]
          },
        ]
      }
      seeds: {
        Row: {
          cost: number | null
          created_at: string | null
          farm_id: string
          id: string
          initial_quantity: number
          item_id: string
          notes: string | null
          packed_for_year: number | null
          purchase_date: string | null
          quantity_unit: string
          status: string
          supplier: string | null
          updated_at: string | null
          variety: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          farm_id: string
          id?: string
          initial_quantity: number
          item_id: string
          notes?: string | null
          packed_for_year?: number | null
          purchase_date?: string | null
          quantity_unit: string
          status?: string
          supplier?: string | null
          updated_at?: string | null
          variety: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          farm_id?: string
          id?: string
          initial_quantity?: number
          item_id?: string
          notes?: string | null
          packed_for_year?: number | null
          purchase_date?: string | null
          quantity_unit?: string
          status?: string
          supplier?: string | null
          updated_at?: string | null
          variety?: string
        }
        Relationships: [
          {
            foreignKeyName: "seeds_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeds_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeds_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      suggestions: {
        Row: {
          author: string | null
          created_at: string | null
          farm_id: string
          id: string
          inbound_message_id: string | null
          source: string
          status: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          farm_id: string
          id?: string
          inbound_message_id?: string | null
          source?: string
          status?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          farm_id?: string
          id?: string
          inbound_message_id?: string | null
          source?: string
          status?: string | null
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_inbound_message_id_fkey"
            columns: ["inbound_message_id"]
            isOneToOne: false
            referencedRelation: "inbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      financial_periods: {
        Row: {
          delivery_count: number | null
          period_start: string | null
          period_type: string | null
          restaurant_id: string | null
          restaurant_name: string | null
          total_delivery_value: number | null
          total_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      most_ordered_items: {
        Row: {
          category: string | null
          item_id: string | null
          item_name: string | null
          order_frequency: number | null
          total_quantity_fulfilled: number | null
          total_quantity_requested: number | null
          total_value: number | null
          unit_type: string | null
        }
        Relationships: []
      }
      seeds_with_on_hand: {
        Row: {
          cost: number | null
          created_at: string | null
          farm_id: string | null
          id: string | null
          initial_quantity: number | null
          is_low: boolean | null
          item_id: string | null
          last_sown_on: string | null
          latest_germ_pct: number | null
          latest_germ_tested_on: string | null
          notes: string | null
          on_hand: number | null
          packed_for_year: number | null
          purchase_date: string | null
          quantity_unit: string | null
          status: string | null
          supplier: string | null
          updated_at: string | null
          variety: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seeds_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeds_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seeds_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "most_ordered_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
    }
    Functions: {
      match_inbound_sender: {
        Args: { p_email: string }
        Returns: {
          restaurant_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      farm_task_source:
        | "manual"
        | "microgreens-auto"
        | "recurring-item"
        | "inbox-confirmed"
      farm_task_status:
        | "open"
        | "completed"
        | "superseded"
        | "cancelled"
        | "snoozed"
      farm_task_type:
        | "sow"
        | "transplant"
        | "harvest"
        | "terminate"
        | "maintenance"
        | "inventory"
        | "delivery-prep"
        | "chef-request"
        | "custom"
      microgreen_harvest_stage: "cotyledon" | "true_leaf" | "baby_green"
      microgreen_tray_status:
        | "soaking"
        | "blackout"
        | "light"
        | "harvesting"
        | "terminated"
        | "lost"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      farm_task_source: [
        "manual",
        "microgreens-auto",
        "recurring-item",
        "inbox-confirmed",
      ],
      farm_task_status: [
        "open",
        "completed",
        "superseded",
        "cancelled",
        "snoozed",
      ],
      farm_task_type: [
        "sow",
        "transplant",
        "harvest",
        "terminate",
        "maintenance",
        "inventory",
        "delivery-prep",
        "chef-request",
        "custom",
      ],
      microgreen_harvest_stage: ["cotyledon", "true_leaf", "baby_green"],
      microgreen_tray_status: [
        "soaking",
        "blackout",
        "light",
        "harvesting",
        "terminated",
        "lost",
      ],
    },
  },
} as const

// ===========================================================================
// Hand-maintained app domain types & enums (not part of generated Database)
// ===========================================================================

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

export type MicrogreenHarvestStage = "cotyledon" | "true_leaf" | "baby_green";

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
  harvest_stage: MicrogreenHarvestStage;
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
  target_unit: "lg" | "sm" | "ea" | null;
  interval_weeks: number; // 1 = weekly (default), 2 = every other week, etc. — migration 065
  effective_from: string | null; // also the recurrence anchor when interval_weeks > 1
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

// ─── Farm Tasks (migration 062) ───────────────────────────────────────

export type FarmTaskSource =
  | "manual"
  | "microgreens-auto"
  | "recurring-item"
  | "inbox-confirmed";

export type FarmTaskType =
  | "sow"
  | "transplant"
  | "harvest"
  | "terminate"
  | "maintenance"
  | "inventory"
  | "delivery-prep"
  | "chef-request"
  | "custom";

export type FarmTaskStatus =
  | "open"
  | "completed"
  | "superseded"
  | "cancelled"
  | "snoozed";

export interface FarmTask {
  id: string;
  farm_id: string;
  title: string;
  description: string | null;
  type: FarmTaskType;
  source: FarmTaskSource;
  source_ref: Record<string, unknown>;
  generator_key: string | null;
  due_date: string;
  due_time: string | null;
  priority: 1 | 2 | 3 | 4;
  status: FarmTaskStatus;
  snoozed_until: string | null;
  completed_at: string | null;
  superseded_at: string | null;
  superseded_reason: string | null;
  completion_notes: string | null;
  item_id: string | null;
  microgreen_crop_id: string | null;
  microgreen_batch_id: string | null;
  inbound_message_id: string | null;
  suggestion_id: string | null;
  created_at: string;
  updated_at: string;
}

export type InboxTaskDraftStatus = "pending" | "confirmed" | "dismissed" | "edited";
export type InboxTaskDraftConfidence = "high" | "medium" | "low";

export interface InboxTaskDraftScheduleItem {
  task_type: "sow" | "transplant" | "harvest" | "maintenance";
  offset_days_from_today: number;
  title: string;
  description: string;
}

export interface InboxTaskDraft {
  id: string;
  inbound_message_id: string;
  suggestion_id: string | null;
  proposed_item_name: string;
  matched_item_id: string | null;
  proposed_schedule: InboxTaskDraftScheduleItem[];
  reasoning: string | null;
  confidence: InboxTaskDraftConfidence;
  status: InboxTaskDraftStatus;
  confirmed_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}
